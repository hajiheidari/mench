import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Database } from "./database";
import type { Rooms } from "./rooms";
import type { TournamentState } from "@mench/tournament";
import { resolveAccount, type SessionRevocation } from "./auth";
const requestId = z.string().uuid();
const reason = z.enum(["abuse", "cheating", "spam"]);
const schema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("suspend"),
      requestId,
      userId: z.string().uuid(),
      days: z.number().int().min(1).max(30),
      reason,
    })
    .strict(),
  z
    .object({
      type: z.literal("unsuspend"),
      requestId,
      userId: z.string().uuid(),
      reason,
    })
    .strict(),
  z
    .object({
      type: z.literal("report"),
      requestId,
      reportId: z.string().uuid(),
      status: z.enum(["dismissed", "actioned"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("cancelTournament"),
      requestId,
      tournamentId: z.string().uuid(),
      reason,
    })
    .strict(),
]);
const domainErrors = new Set([
  "NOT_FOUND",
  "FORBIDDEN",
  "REQUEST_ID_REUSED",
  "TOURNAMENT_INACTIVE",
]);
export function registerAdmin(
  app: FastifyInstance,
  db: Database,
  rooms: Rooms,
  adminIds: readonly string[],
  revoke: (revocation: SessionRevocation) => void,
  isHealthy: () => boolean,
) {
  const allowed = new Set(adminIds);
  for (const id of allowed)
    if (!z.string().uuid().safeParse(id).success)
      throw Error("INVALID_ADMIN_CONFIGURATION");
  const identify = async (req: FastifyRequest) => {
    const user = await resolveAccount(
      db,
      req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : req.cookies.mench_session,
    );
    return user && allowed.has(user.id) ? user : null;
  };
  app.get("/api/admin/me", async (req, reply) =>
    (await identify(req))
      ? { allowed: true }
      : reply.code(403).send({ error: "FORBIDDEN" }),
  );
  app.get("/api/admin", async (req, reply) => {
    if (!(await identify(req)))
      return reply.code(403).send({ error: "FORBIDDEN" });
    const [users, reports, ledger, audit, tournaments] = await Promise.all([
      db.pool.query(
        "SELECT id,display_name AS name,banned_until FROM users ORDER BY created_at DESC LIMIT 50",
      ),
      db.pool.query(
        "SELECT id,reporter,subject,reason,status,created_at FROM user_reports ORDER BY created_at DESC LIMIT 50",
      ),
      db.pool.query(
        "SELECT wallet_id,kind,delta,metadata,created_at FROM wallet_ledger ORDER BY created_at DESC LIMIT 50",
      ),
      db.pool.query(
        "SELECT actor_id,subject_id,reference_id,action,metadata,created_at FROM admin_audit ORDER BY created_at DESC LIMIT 50",
      ),
      db.pool.query(
        "SELECT id,snapshot->>'phase' AS phase,(snapshot->>'capacity')::integer AS capacity FROM tournaments WHERE snapshot->>'phase' IN ('lobby','running') ORDER BY created_at DESC LIMIT 20",
      ),
    ]);
    return {
      users: users.rows,
      reports: reports.rows,
      ledger: ledger.rows,
      audit: audit.rows,
      tournaments: tournaments.rows,
      health: {
        healthy: isHealthy(),
        rooms: rooms.rooms.size,
        activeGames: [...rooms.rooms.values()].filter(
          (r) => r.state && r.state.phase !== "finished",
        ).length,
      },
    };
  });
  app.post(
    "/api/admin",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const actor = await identify(req);
      if (!actor) return reply.code(403).send({ error: "FORBIDDEN" });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "INVALID_INPUT" });
      const input = parsed.data;
      const hash = createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex");
      if (
        (input.type === "suspend" || input.type === "unsuspend") &&
        allowed.has(input.userId)
      )
        return reply.code(403).send({ error: "FORBIDDEN" });
      const client = await db.pool.connect();
      let revocation: SessionRevocation | undefined;
      try {
        await client.query("BEGIN");
        const userIds = [
          actor.id,
          ...(input.type === "suspend" || input.type === "unsuspend"
            ? [input.userId]
            : []),
        ];
        const users = await client.query(
          "SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
          [userIds],
        );
        if (users.rowCount !== userIds.length) throw Error("NOT_FOUND");
        const prior = (
          await client.query<{ payload_hash: string }>(
            "SELECT payload_hash FROM admin_audit WHERE actor_id=$1 AND request_id=$2",
            [actor.id, input.requestId],
          )
        ).rows[0];
        if (prior) {
          if (prior.payload_hash !== hash) throw Error("REQUEST_ID_REUSED");
          await client.query("COMMIT");
          return { ok: true };
        }
        let subject: string | null = null;
        let reference: string | null = null;
        let metadata: object = {};
        switch (input.type) {
          case "suspend":
            await client.query(
              "UPDATE users SET banned_until=now()+$2::integer*interval '1 day' WHERE id=$1",
              [input.userId, input.days],
            );
            await client.query("DELETE FROM sessions WHERE user_id=$1", [
              input.userId,
            ]);
            subject = input.userId;
            metadata = { days: input.days, reason: input.reason };
            revocation = { accountId: input.userId };
            break;
          case "unsuspend":
            await client.query(
              "UPDATE users SET banned_until=NULL WHERE id=$1",
              [input.userId],
            );
            subject = input.userId;
            metadata = { reason: input.reason };
            break;
          case "report": {
            const updated = await client.query(
              "UPDATE user_reports SET status=$2,resolved_at=now(),resolved_by=$3 WHERE id=$1 RETURNING id",
              [input.reportId, input.status, actor.id],
            );
            if (!updated.rowCount) throw Error("NOT_FOUND");
            reference = input.reportId;
            metadata = { status: input.status };
            break;
          }
          case "cancelTournament": {
            const tournament = (
              await client.query<{ snapshot: TournamentState }>(
                "SELECT snapshot FROM tournaments WHERE id=$1 FOR UPDATE",
                [input.tournamentId],
              )
            ).rows[0];
            if (!tournament) throw Error("NOT_FOUND");
            if (!["lobby", "running"].includes(tournament.snapshot.phase))
              throw Error("TOURNAMENT_INACTIVE");
            tournament.snapshot.phase = "cancelled";
            await client.query(
              "UPDATE tournaments SET snapshot=$2,updated_at=now() WHERE id=$1",
              [input.tournamentId, JSON.stringify(tournament.snapshot)],
            );
            reference = input.tournamentId;
            metadata = { reason: input.reason };
            break;
          }
        }
        await client.query(
          "INSERT INTO admin_audit(actor_id,subject_id,reference_id,request_id,payload_hash,action,metadata) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            actor.id,
            subject,
            reference,
            input.requestId,
            hash,
            input.type,
            JSON.stringify(metadata),
          ],
        );
        await client.query("COMMIT");
        if (revocation) revoke(revocation);
        app.log.info({
          event: "admin_action",
          action: input.type,
          actor: actor.id,
        });
        return { ok: true };
      } catch (error) {
        await client.query("ROLLBACK");
        if (error instanceof Error && domainErrors.has(error.message))
          return reply
            .code(
              error.message === "FORBIDDEN"
                ? 403
                : error.message === "NOT_FOUND"
                  ? 404
                  : 409,
            )
            .send({ error: error.message });
        throw error;
      } finally {
        client.release();
      }
    },
  );
}
