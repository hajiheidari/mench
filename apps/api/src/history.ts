import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Database } from "./database";
import { resolveAccount } from "./auth";
import type { GameHistory, GameTranscript } from "@mench/game-protocol";
interface StoredResult {
  state: GameTranscript["finalState"];
  ranked: boolean;
  players: { id: string; name: string; accountId?: string }[];
  transcript?: GameTranscript | null;
}
export function registerHistory(app: FastifyInstance, db: Database) {
  app.get("/api/history", async (req, reply) => {
    const account = await resolveAccount(
      db,
      req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : req.cookies.mench_session,
    );
    if (!account) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const rows = await db.pool.query<{
      game_id: string;
      created_at: Date;
      result: StoredResult;
    }>(
      "SELECT game_id,created_at,result FROM game_results WHERE result->'players' @> $1::jsonb ORDER BY created_at DESC,game_id LIMIT 50",
      [JSON.stringify([{ accountId: account.id }])],
    );
    return {
      games: rows.rows.map((row) => ({
        id: row.game_id,
        createdAt: row.created_at.toISOString(),
        ranked: row.result.ranked,
        won: row.result.players.some(
          (p) => p.accountId === account.id && p.id === row.result.state.winner,
        ),
        players: row.result.players.map(({ id, name }) => ({ id, name })),
        replayAvailable: Boolean(row.result.transcript),
      })),
    } satisfies GameHistory;
  });
  app.get("/api/history/:id", async (req, reply) => {
    const account = await resolveAccount(
      db,
      req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : req.cookies.mench_session,
    );
    if (!account) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const params = z.object({ id: z.string().uuid() }).safeParse(req.params);
    if (!params.success)
      return reply.code(400).send({ error: "INVALID_REQUEST" });
    const rows = await db.pool.query<{ result: StoredResult }>(
      "SELECT result FROM game_results WHERE game_id=$1 AND result->'players' @> $2::jsonb",
      [params.data.id, JSON.stringify([{ accountId: account.id }])],
    );
    const result = rows.rows[0]?.result;
    if (!result) return reply.code(404).send({ error: "NOT_FOUND" });
    if (!result.transcript)
      return reply.code(409).send({ error: "REPLAY_UNAVAILABLE" });
    return result.transcript;
  });
}
