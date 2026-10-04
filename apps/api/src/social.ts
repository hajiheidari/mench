import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Database } from "./database";
import { resolveAccount } from "./auth";
import type { Rooms } from "./rooms";
export async function canInteract(db: Database, first: string, second: string) {
  const blocked = await db.pool.query(
    "SELECT 1 FROM user_blocks WHERE (blocker=$1 AND blocked=$2) OR (blocker=$2 AND blocked=$1)",
    [first, second],
  );
  return blocked.rowCount === 0;
}
const params = z.object({ id: z.string().uuid() }).strict();
const mutation = z.discriminatedUnion("type", [
  z.object({ type: z.literal("request") }).strict(),
  z.object({ type: z.literal("accept") }).strict(),
  z.object({ type: z.literal("remove") }).strict(),
  z.object({ type: z.literal("block") }).strict(),
  z.object({ type: z.literal("unblock") }).strict(),
  z
    .object({
      type: z.literal("report"),
      reason: z.enum(["abuse", "cheating", "spam"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("invite"),
      code: z.string().regex(/^[A-F0-9]{10}$/),
    })
    .strict(),
]);
class SocialError extends Error {}
export function registerSocial(
  app: FastifyInstance,
  db: Database,
  rooms: Rooms,
) {
  async function identify(req: FastifyRequest, reply: FastifyReply) {
    const raw = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : req.cookies.mench_session;
    const account = await resolveAccount(db, raw);
    if (!account) reply.code(401).send({ error: "UNAUTHENTICATED" });
    return account;
  }
  app.get("/api/social", async (req, reply) => {
    const account = await identify(req, reply);
    if (!account) return;
    const [friends, blocks, recent, invites] = await Promise.all([
      db.pool.query<{
        id: string;
        name: string;
        accepted: boolean;
        incoming: boolean;
      }>(
        "SELECT u.id,u.display_name AS name,f.accepted,(f.recipient=$1) AS incoming FROM friendships f JOIN users u ON u.id=CASE WHEN f.requester=$1 THEN f.recipient ELSE f.requester END WHERE f.requester=$1 OR f.recipient=$1 ORDER BY f.created_at DESC LIMIT 100",
        [account.id],
      ),
      db.pool.query(
        "SELECT u.id,u.display_name AS name FROM user_blocks b JOIN users u ON u.id=b.blocked WHERE b.blocker=$1 ORDER BY b.created_at DESC LIMIT 500",
        [account.id],
      ),
      db.pool.query(
        "SELECT u.id,u.display_name AS name FROM recent_opponents r JOIN users u ON u.id=r.opponent WHERE r.player=$1 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker=$1 AND b.blocked=u.id) OR (b.blocker=u.id AND b.blocked=$1)) ORDER BY r.played_at DESC LIMIT 20",
        [account.id],
      ),
      db.pool.query(
        "SELECT u.id,u.display_name AS name,i.room_code AS code FROM friend_invites i JOIN users u ON u.id=i.sender JOIN room_snapshots r ON r.code=i.room_code WHERE i.recipient=$1 AND i.expires_at>now() AND r.snapshot->'state'='null'::jsonb ORDER BY i.expires_at DESC LIMIT 20",
        [account.id],
      ),
    ]);
    const online = new Set(rooms.identities.values());
    return {
      friends: friends.rows.map((f) => ({
        ...f,
        online: f.accepted && online.has(f.id),
      })),
      blocks: blocks.rows,
      recent: recent.rows,
      invites: invites.rows,
    };
  });
  app.post(
    "/api/social/:id",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const account = await identify(req, reply);
      if (!account) return;
      const target = params.safeParse(req.params);
      const input = mutation.safeParse(req.body);
      if (!target.success || !input.success || target.data.id === account.id)
        return reply.code(400).send({ error: "INVALID_INPUT" });
      const other = target.data.id;
      const client = await db.pool.connect();
      try {
        await client.query("BEGIN");
        // Lock both user rows in canonical order: blocks and requests cannot race.
        const users = await client.query(
          "SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
          [[account.id, other]],
        );
        if (users.rowCount !== 2) throw new SocialError("NOT_FOUND");
        const kind = input.data.type;
        if (["request", "accept", "invite"].includes(kind)) {
          const blocked = await client.query(
            "SELECT 1 FROM user_blocks WHERE (blocker=$1 AND blocked=$2) OR (blocker=$2 AND blocked=$1)",
            [account.id, other],
          );
          if (blocked.rowCount)
            throw new SocialError("INTERACTION_UNAVAILABLE");
        }
        switch (kind) {
          case "request": {
            const count = await client.query<{ count: string }>(
              "SELECT GREATEST((SELECT count(*) FROM friendships WHERE requester=$1 OR recipient=$1),(SELECT count(*) FROM friendships WHERE requester=$2 OR recipient=$2)) AS count",
              [account.id, other],
            );
            if (Number(count.rows[0]!.count) >= 100)
              throw new SocialError("SOCIAL_LIMIT");
            await client.query(
              "INSERT INTO friendships(requester,recipient) VALUES($1,$2) ON CONFLICT DO NOTHING",
              [account.id, other],
            );
            break;
          }
          case "accept": {
            const result = await client.query(
              "UPDATE friendships SET accepted=true WHERE requester=$1 AND recipient=$2",
              [other, account.id],
            );
            if (!result.rowCount) throw new SocialError("REQUEST_NOT_FOUND");
            break;
          }
          case "remove":
            await client.query(
              "DELETE FROM friendships WHERE (requester=$1 AND recipient=$2) OR (requester=$2 AND recipient=$1)",
              [account.id, other],
            );
            await client.query(
              "DELETE FROM friend_invites WHERE (sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1)",
              [account.id, other],
            );
            break;
          case "block": {
            const count = await client.query<{ count: string }>(
              "SELECT count(*) FROM user_blocks WHERE blocker=$1",
              [account.id],
            );
            if (Number(count.rows[0]!.count) >= 500)
              throw new SocialError("SOCIAL_LIMIT");
            await client.query(
              "INSERT INTO user_blocks(blocker,blocked) VALUES($1,$2) ON CONFLICT DO NOTHING",
              [account.id, other],
            );
            await client.query(
              "DELETE FROM friendships WHERE (requester=$1 AND recipient=$2) OR (requester=$2 AND recipient=$1)",
              [account.id, other],
            );
            await client.query(
              "DELETE FROM friend_invites WHERE (sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1)",
              [account.id, other],
            );
            break;
          }
          case "unblock":
            await client.query(
              "DELETE FROM user_blocks WHERE blocker=$1 AND blocked=$2",
              [account.id, other],
            );
            break;
          case "report": {
            const count = await client.query<{ count: string }>(
              "SELECT count(*) FROM user_reports WHERE reporter=$1 AND created_at>now()-interval '1 hour'",
              [account.id],
            );
            if (Number(count.rows[0]!.count) >= 10)
              throw new SocialError("SOCIAL_LIMIT");
            await client.query(
              "INSERT INTO user_reports(id,reporter,subject,reason) VALUES($1,$2,$3,$4)",
              [
                randomUUID(),
                account.id,
                other,
                input.data.type === "report" ? input.data.reason : "abuse",
              ],
            );
            break;
          }
          case "invite": {
            if (input.data.type !== "invite")
              throw new SocialError("INVALID_INPUT");
            const room = rooms.rooms.get(input.data.code);
            if (
              !room ||
              room.state ||
              !room.members.some(
                (m) => m.id === room.hostId && m.accountId === account.id,
              )
            )
              throw new SocialError("INVITE_UNAVAILABLE");
            const friend = await client.query(
              "SELECT 1 FROM friendships WHERE accepted AND ((requester=$1 AND recipient=$2) OR (requester=$2 AND recipient=$1))",
              [account.id, other],
            );
            if (!friend.rowCount)
              throw new SocialError("INTERACTION_UNAVAILABLE");
            await client.query(
              "INSERT INTO friend_invites(sender,recipient,room_code) VALUES($1,$2,$3) ON CONFLICT(sender,recipient,room_code) DO UPDATE SET expires_at=now()+interval '1 hour'",
              [account.id, other, room.code],
            );
            break;
          }
        }
        await client.query("COMMIT");
        return { ok: true };
      } catch (error) {
        await client.query("ROLLBACK");
        if (error instanceof SocialError)
          return reply
            .code(error.message === "NOT_FOUND" ? 404 : 409)
            .send({ error: error.message });
        throw error;
      } finally {
        client.release();
      }
    },
  );
}
