import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { attachRealtime } from "./realtime";
import { registerAuth } from "./auth";
import type { Database } from "./database";
import { Rooms } from "./rooms";
import { registerSocial } from "./social";
import { registerHistory } from "./history";
import { registerRankings } from "./rankings";
import { registerEconomy } from "./economy";
import { registerTournaments } from "./tournaments";
import { registerAdmin } from "./admin";
export function createApp(
  rooms = new Rooms(),
  commandBudget = 100,
  database?: Database,
  options: { adminUserIds?: readonly string[]; maxConnections?: number } = {},
) {
  const app = Fastify({
    logger: {
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.token",
      ],
    },
    bodyLimit: 16384,
  });
  app.register(cors, {
    origin: (
      process.env.ALLOWED_ORIGINS ??
      "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:3200,http://127.0.0.1:4173"
    ).split(","),
    credentials: true,
  });
  app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  if (database) app.addHook("onClose", async () => database.close());
  const realtime = attachRealtime(
    app,
    rooms,
    commandBudget,
    database,
    options.maxConnections,
  );
  if (database) registerAuth(app, database, realtime.revoke);
  if (database) registerSocial(app, database, rooms);
  if (database) registerRankings(app, database);
  if (database) registerHistory(app, database);
  if (database) registerEconomy(app, database);
  if (database) registerTournaments(app, database);
  if (database)
    registerAdmin(
      app,
      database,
      rooms,
      options.adminUserIds ??
        (process.env.ADMIN_USER_IDS ?? "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      realtime.revoke,
      realtime.isHealthy,
    );
  app.get("/health/live", async () => ({ status: "ok", protocolVersion: 1 }));
  app.get("/health", async (_req, reply) => {
    if (realtime.isHealthy()) {
      try {
        if (database) await database.pool.query("SELECT 1");
        return { status: "ok", protocolVersion: 1 };
      } catch {
        /* readiness must reflect database availability */
      }
    }
    return reply.code(503).send({ status: "unavailable", protocolVersion: 1 });
  });
  return app;
}
