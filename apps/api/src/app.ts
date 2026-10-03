import Fastify from "fastify";
export function createApp() {
  const app = Fastify({
    logger: { redact: ["req.headers.authorization", "req.headers.cookie"] },
    bodyLimit: 16384,
  });
  app.get("/health", async () => ({ status: "ok", protocolVersion: 1 }));
  return app;
}
