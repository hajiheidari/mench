import type { FastifyInstance } from "fastify";
import type { Database } from "./database";
import { resolveAccount } from "./auth";
export function registerRankings(app: FastifyInstance, db: Database) {
  app.get("/api/rankings", async () => {
    const result = await db.pool.query(
      "SELECT u.id,u.display_name AS name,r.rating,r.games,r.wins FROM ratings r JOIN users u ON u.id=r.user_id WHERE r.games>0 ORDER BY r.rating DESC,r.games DESC,u.id LIMIT 100",
    );
    return { players: result.rows };
  });
  app.get("/api/rankings/me", async (req, reply) => {
    const raw = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : req.cookies.mench_session;
    const account = await resolveAccount(db, raw);
    if (!account) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const result = await db.pool.query(
      "SELECT rating,games,wins FROM ratings WHERE user_id=$1",
      [account.id],
    );
    return result.rows[0] ?? { rating: 1000, games: 0, wins: 0 };
  });
}
