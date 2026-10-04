import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  createTournament,
  joinTournament,
  startTournament,
  linkMatch,
  completeMatch,
  type TournamentState,
} from "@mench/tournament";
import type { Database } from "./database";
import type { RoomSnapshot } from "./rooms";
import { resolveAccount } from "./auth";
interface Row {
  id: string;
  owner: string | null;
  snapshot: TournamentState;
  created_at: string;
}
const params = z.object({ id: z.string().uuid() }).strict();
const create = z
  .object({
    capacity: z.union([
      z.literal(4),
      z.literal(8),
      z.literal(16),
      z.literal(32),
    ]),
  })
  .strict();
const mutation = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join") }).strict(),
  z.object({ type: z.literal("leave") }).strict(),
  z.object({ type: z.literal("start") }).strict(),
  z.object({ type: z.literal("cancel") }).strict(),
  z
    .object({
      type: z.literal("link"),
      matchId: z.string().regex(/^r[0-4]m[0-9]{1,2}$/),
      code: z.string().regex(/^[A-F0-9]{10}$/),
    })
    .strict(),
]);
const domainErrors = new Set([
  "INVALID_INPUT",
  "NOT_FOUND",
  "FORBIDDEN",
  "TOURNAMENT_STARTED",
  "TOURNAMENT_FULL",
  "WAITING_FOR_PLAYERS",
  "TOURNAMENT_INACTIVE",
  "MATCH_UNAVAILABLE",
  "MATCH_ALREADY_LINKED",
  "SOCIAL_LIMIT",
  "INTERACTION_UNAVAILABLE",
]);
async function publicView(client: Pick<pg.PoolClient, "query">, row: Row) {
  const profiles = await client.query(
    "SELECT id,display_name AS name FROM users WHERE id=ANY($1::uuid[])",
    [row.snapshot.players],
  );
  return {
    ...row.snapshot,
    id: row.id,
    owner: row.owner,
    profiles: profiles.rows,
  };
}
export async function advanceTournament(
  client: pg.PoolClient,
  gameId: string,
  winner: string | null,
) {
  const linked = await client.query<{ tournament_id: string }>(
    "SELECT tournament_id FROM tournament_games WHERE game_id=$1",
    [gameId],
  );
  if (!linked.rows[0]) return;
  const row = (
    await client.query<Row>(
      "SELECT * FROM tournaments WHERE id=$1 FOR UPDATE",
      [linked.rows[0].tournament_id],
    )
  ).rows[0]!;
  if (row.snapshot.phase !== "running" || !winner) return;
  const snapshot = completeMatch(row.snapshot, gameId, winner);
  await client.query(
    "UPDATE tournaments SET snapshot=$2,updated_at=now() WHERE id=$1",
    [row.id, JSON.stringify(snapshot)],
  );
}
export function registerTournaments(app: FastifyInstance, db: Database) {
  const identify = (req: FastifyRequest) =>
    resolveAccount(
      db,
      req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : req.cookies.mench_session,
    );
  app.get("/api/tournaments", async (req, reply) => {
    const user = await identify(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const rows = await db.pool.query<Row>(
      "SELECT * FROM tournaments WHERE owner=$1 OR snapshot->'players' ? $1::text ORDER BY created_at DESC LIMIT 20",
      [user.id],
    );
    return {
      tournaments: rows.rows.map((row) => ({
        id: row.id,
        capacity: row.snapshot.capacity,
        phase: row.snapshot.phase,
      })),
    };
  });
  app.get("/api/tournaments/:id", async (req, reply) => {
    const user = await identify(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const input = params.safeParse(req.params);
    if (!input.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const row = (
      await db.pool.query<Row>("SELECT * FROM tournaments WHERE id=$1", [
        input.data.id,
      ])
    ).rows[0];
    if (!row) return reply.code(404).send({ error: "NOT_FOUND" });
    if (
      row.snapshot.phase !== "lobby" &&
      !row.snapshot.players.includes(user.id) &&
      row.owner !== user.id
    )
      return reply.code(403).send({ error: "FORBIDDEN" });
    return publicView(db.pool, row);
  });
  app.post(
    "/api/tournaments",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const user = await identify(req);
      if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
      const input = create.safeParse(req.body);
      if (!input.success)
        return reply.code(400).send({ error: "INVALID_INPUT" });
      const client = await db.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
          user.id,
        ]);
        const existing = await client.query(
          "SELECT 1 FROM tournaments WHERE owner=$1 AND snapshot->>'phase' IN ('lobby','running')",
          [user.id],
        );
        if (existing.rowCount) throw Error("SOCIAL_LIMIT");
        const id = randomUUID();
        const snapshot = createTournament(input.data.capacity, user.id);
        const row = (
          await client.query<Row>(
            "INSERT INTO tournaments(id,owner,snapshot) VALUES($1,$2,$3) RETURNING *",
            [id, user.id, JSON.stringify(snapshot)],
          )
        ).rows[0]!;
        await client.query("COMMIT");
        return reply.code(201).send(await publicView(client, row));
      } catch (error) {
        await client.query("ROLLBACK");
        if (error instanceof Error && domainErrors.has(error.message))
          return reply.code(409).send({ error: error.message });
        throw error;
      } finally {
        client.release();
      }
    },
  );
  app.post("/api/tournaments/:id", async (req, reply) => {
    const user = await identify(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const target = params.safeParse(req.params);
    const input = mutation.safeParse(req.body);
    if (!target.success || !input.success)
      return reply.code(400).send({ error: "INVALID_INPUT" });
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      // Match-room lock precedes tournament lock, the same order as final settlement.
      let room: RoomSnapshot | undefined;
      if (input.data.type === "link")
        room = (
          await client.query<{ snapshot: RoomSnapshot }>(
            "SELECT snapshot FROM room_snapshots WHERE code=$1 FOR UPDATE",
            [input.data.code],
          )
        ).rows[0]?.snapshot;
      const row = (
        await client.query<Row>(
          "SELECT * FROM tournaments WHERE id=$1 FOR UPDATE",
          [target.data.id],
        )
      ).rows[0];
      if (!row) throw Error("NOT_FOUND");
      let snapshot = structuredClone(row.snapshot);
      switch (input.data.type) {
        case "join": {
          const blocked = await client.query(
            "SELECT 1 FROM user_blocks WHERE (blocker=$1 AND blocked=ANY($2::uuid[])) OR (blocked=$1 AND blocker=ANY($2::uuid[]))",
            [user.id, snapshot.players],
          );
          if (blocked.rowCount) throw Error("INTERACTION_UNAVAILABLE");
          snapshot = joinTournament(snapshot, user.id);
          break;
        }
        case "leave":
          if (snapshot.phase !== "lobby") throw Error("TOURNAMENT_STARTED");
          if (row.owner === user.id) throw Error("FORBIDDEN");
          snapshot.players = snapshot.players.filter((p) => p !== user.id);
          break;
        case "start": {
          if (row.owner !== user.id) throw Error("FORBIDDEN");
          const users = await client.query(
            "SELECT id FROM users WHERE id=ANY($1::uuid[])",
            [snapshot.players],
          );
          if (users.rowCount !== snapshot.capacity)
            throw Error("WAITING_FOR_PLAYERS");
          const blocked = await client.query(
            "SELECT 1 FROM user_blocks WHERE blocker=ANY($1::uuid[]) AND blocked=ANY($1::uuid[])",
            [snapshot.players],
          );
          if (blocked.rowCount) throw Error("INTERACTION_UNAVAILABLE");
          snapshot = startTournament(snapshot);
          break;
        }
        case "cancel":
          if (row.owner !== user.id) throw Error("FORBIDDEN");
          if (snapshot.phase !== "lobby") throw Error("TOURNAMENT_STARTED");
          snapshot.phase = "cancelled";
          break;
        case "link": {
          const matchId = input.data.matchId;
          const match = snapshot.rounds.flat().find((m) => m.id === matchId);
          if (!match || !match.players.includes(user.id))
            throw Error("FORBIDDEN");
          if (
            !room ||
            room.state ||
            room.capacity !== 2 ||
            room.ranked ||
            !room.matchId ||
            room.members.length !== 2
          )
            throw Error("MATCH_UNAVAILABLE");
          const accounts = room.members.map((m) => m.accountId).sort();
          if (
            accounts.some(
              (id, index) => !id || id !== [...match.players].sort()[index],
            )
          )
            throw Error("MATCH_UNAVAILABLE");
          snapshot = linkMatch(
            snapshot,
            input.data.matchId,
            room.matchId,
            room.code,
          );
          const linked =
            (
              await client.query<{ tournament_id: string; match_id: string }>(
                "INSERT INTO tournament_games(game_id,tournament_id,match_id,room_code) VALUES($1,$2,$3,$4) ON CONFLICT(game_id) DO NOTHING RETURNING tournament_id,match_id",
                [room.matchId, row.id, input.data.matchId, room.code],
              )
            ).rows[0] ??
            (
              await client.query<{ tournament_id: string; match_id: string }>(
                "SELECT tournament_id,match_id FROM tournament_games WHERE game_id=$1",
                [room.matchId],
              )
            ).rows[0]!;
          if (
            linked.tournament_id !== row.id ||
            linked.match_id !== input.data.matchId
          )
            throw Error("MATCH_ALREADY_LINKED");
          break;
        }
      }
      await client.query(
        "UPDATE tournaments SET snapshot=$2,updated_at=now() WHERE id=$1",
        [row.id, JSON.stringify(snapshot)],
      );
      await client.query("COMMIT");
      return publicView(client, { ...row, snapshot });
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
  });
}
