import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { EVENTS, type Reply } from "@mench/game-protocol";
import type { Database } from "./database";
import { resolveAccount } from "./auth";
import { Rooms } from "./rooms";
const name = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(/^[\p{L}\p{N} _-]+$/u);
const code = z.string().regex(/^[A-F0-9]{10}$/);
const version = z.number().int().min(0);
const schema = z
  .object({
    version: z.literal(1),
    requestId: z.string().uuid(),
    payload: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("create"),
          name,
          capacity: z.number().int().min(2).max(4),
        })
        .strict(),
      z.object({ type: z.literal("join"), name, code }).strict(),
      z
        .object({
          type: z.literal("resume"),
          code,
          token: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict(),
      z.object({ type: z.literal("start") }).strict(),
      z
        .object({
          type: z.literal("roll"),
          nonce: z.string().regex(/^[a-f0-9]{64}$/),
          expectedVersion: version,
        })
        .strict(),
      z
        .object({
          type: z.literal("move"),
          pawn: z.number().int().min(0).max(3),
          expectedVersion: version,
        })
        .strict(),
      z.object({ type: z.literal("leave") }).strict(),
      z.object({ type: z.literal("queue"), name }).strict(),
      z.object({ type: z.literal("cancelQueue") }).strict(),
    ]),
  })
  .strict();
export function attachRealtime(
  app: FastifyInstance,
  rooms = new Rooms(),
  commandBudget = 100,
  database?: Database,
) {
  const allowed = (
    process.env.ALLOWED_ORIGINS ??
    "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:3200,http://127.0.0.1:4173"
  ).split(",");
  const io = new Server(app.server, {
    maxHttpBufferSize: 16384,
    pingInterval: 5000,
    pingTimeout: 10000,
    cors: { origin: allowed },
    allowRequest: (req, callback) =>
      callback(
        null,
        !req.headers.origin || allowed.includes(req.headers.origin),
      ),
  });
  if (database)
    io.use(async (socket, next) => {
      try {
        const header = socket.handshake.headers.authorization;
        const raw = header?.startsWith("Bearer ")
          ? header.slice(7)
          : socket.handshake.headers.cookie?.match(
              /(?:^|;\s*)mench_session=([a-f0-9]{64})(?:;|$)/,
            )?.[1];
        const account = await resolveAccount(database, raw);
        if (account) rooms.identities.set(socket.id, account.id);
        next();
      } catch {
        next(new Error("AUTH_UNAVAILABLE"));
      }
    });
  const queue = new Map<string, string>();
  const broadcast = (room: ReturnType<Rooms["public"]>) =>
    io.to(room.code).emit(EVENTS.SNAPSHOT, room);
  io.on("connection", (socket) => {
    let requests = 0;
    let window = Date.now();
    socket.on(EVENTS.COMMAND, (input: unknown, ack: unknown) => {
      if (typeof ack !== "function") return;
      const reply = (r: Reply) => ack(r);
      if (Date.now() - window > 10000) {
        window = Date.now();
        requests = 0;
      }
      if (++requests > commandBudget) {
        reply({ ok: false, error: "RATE_LIMITED" });
        return;
      }
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        reply({ ok: false, error: "INVALID_COMMAND" });
        return;
      }
      const { requestId, payload } = parsed.data;
      const session = rooms.sessions.get(socket.id);
      const cached = session?.member.replies.get(requestId);
      if (cached) {
        reply(cached);
        return;
      }
      try {
        let result: Reply;
        switch (payload.type) {
          case "create":
            result = rooms.create(socket.id, payload.name, payload.capacity);
            break;
          case "join":
            result = rooms.join(socket.id, payload.name, payload.code);
            break;
          case "resume": {
            const resumed = rooms.resume(
              socket.id,
              payload.code,
              payload.token,
            );
            result = resumed.reply;
            if (resumed.replaced) {
              io.sockets.sockets.get(resumed.replaced)?.emit(EVENTS.REPLACED);
              io.sockets.sockets.get(resumed.replaced)?.disconnect(true);
            }
            break;
          }
          case "start":
            result = { ok: true, room: rooms.start(socket.id) };
            break;
          case "roll":
            result = {
              ok: true,
              room: rooms.roll(
                socket.id,
                payload.nonce,
                payload.expectedVersion,
              ),
            };
            break;
          case "move":
            result = {
              ok: true,
              room: rooms.move(
                socket.id,
                payload.pawn,
                payload.expectedVersion,
              ),
            };
            break;
          case "leave": {
            queue.delete(socket.id);
            const room = rooms.session(socket.id).room;
            socket.leave(room.code);
            const snapshot = rooms.leave(socket.id);
            if (snapshot) broadcast(snapshot);
            result = { ok: true, room: null };
            break;
          }
          case "cancelQueue":
            queue.delete(socket.id);
            result = { ok: true, room: null, queued: false };
            break;
          case "queue": {
            if (rooms.sessions.has(socket.id))
              throw new Error("ALREADY_JOINED");
            const opponent = [...queue.keys()].find(
              (id) => id !== socket.id && io.sockets.sockets.has(id),
            );
            if (!opponent) {
              if (queue.size >= 1000) throw new Error("QUEUE_FULL");
              queue.set(socket.id, payload.name);
              result = { ok: true, room: null, queued: true };
              break;
            }
            const otherName = queue.get(opponent)!;
            queue.delete(opponent);
            const other = rooms.create(opponent, otherName, 2);
            if (!other.ok || !other.room) throw new Error("MATCH_ERROR");
            const theirs = io.sockets.sockets.get(opponent)!;
            theirs.join(other.room.code);

            result = rooms.join(socket.id, payload.name, other.room.code);
            const started = rooms.start(opponent);
            theirs.emit(EVENTS.MATCHED, { ...other, room: started });
            if (result.ok) result = { ...result, room: started };
            break;
          }
        }
        const active = rooms.sessions.get(socket.id);
        if (active) {
          active.member.replies.set(requestId, result);
          if (active.member.replies.size > 1000)
            active.member.replies.delete(
              active.member.replies.keys().next().value!,
            );
          socket.join(active.room.code);
        }
        reply(result);
        if (result.ok && result.room) broadcast(result.room);
      } catch (error) {
        reply({
          ok: false,
          error: error instanceof Error ? error.message : "REQUEST_FAILED",
        });
      }
    });
    socket.on("disconnect", () => {
      queue.delete(socket.id);
      rooms.identities.delete(socket.id);
      const snapshot = rooms.disconnect(socket.id);
      if (snapshot) broadcast(snapshot);
    });
  });
  const timer = setInterval(() => rooms.tick().forEach(broadcast), 500);
  timer.unref();
  app.addHook("onClose", async () => {
    clearInterval(timer);
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });
  return { io, rooms };
}
