import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { attachRealtime } from "./realtime";
import { Rooms } from "./rooms";
export function createApp(rooms = new Rooms(), commandBudget = 100) {
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
  app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  app.get("/health", async () => ({ status: "ok", protocolVersion: 1 }));
  attachRealtime(app, rooms, commandBudget);
  return app;
}
