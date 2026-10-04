import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { attachRealtime } from "./realtime";
import { registerAuth } from "./auth";
import type { Database } from "./database";
import { Rooms } from "./rooms";
import { registerSocial } from "./social";
import { registerRankings } from "./rankings";
import { registerEconomy } from "./economy";
import { registerTournaments } from "./tournaments";
export function createApp(
  rooms = new Rooms(),
  commandBudget = 100,
  database?: Database,
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
  if (database) registerAuth(app, database);
  if (database) registerSocial(app, database, rooms);
  if (database) registerRankings(app, database);
  if (database) registerEconomy(app, database);
  if (database) registerTournaments(app, database);
  const realtime = attachRealtime(app, rooms, commandBudget, database);
  app.get("/health", async (_req, reply) =>
    realtime.isHealthy()
      ? { status: "ok", protocolVersion: 1 }
      : reply.code(503).send({ status: "unavailable", protocolVersion: 1 }),
  );
  return app;
}
