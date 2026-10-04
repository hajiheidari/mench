import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { EVENTS, type Reply } from "@mench/game-protocol";
import type { Database } from "./database";
import { resolveAccount } from "./auth";
import { Rooms } from "./rooms";
import { canInteract } from "./social";
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
          ranked: z.boolean().optional(),
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
      z
        .object({
          type: z.literal("queue"),
          name,
          ranked: z.boolean().optional(),
        })
        .strict(),
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

  const queue = new Map<string, { name: string; ranked: boolean }>();
  let healthy = true;
  let tail = Promise.resolve();
  let pendingJobs = 0;
  const enqueue = (job: () => Promise<void>) => {
    if (pendingJobs >= 2000) return Promise.reject(new Error("SERVER_BUSY"));
    pendingJobs++;
    const next = tail.then(job).finally(() => {
      pendingJobs--;
    });
    tail = next.catch((error) => {
      app.log.error({
        event: "room_actor_failure",
        message: error instanceof Error ? error.message : "unknown",
      });
    });
    return next;
  };
  if (database)
    app.addHook("onReady", async () =>
      rooms.restore(await database.loadRooms(), true),
    );
  const broadcast = (room: ReturnType<Rooms["public"]>) =>
    io.to(room.code).emit(EVENTS.SNAPSHOT, room);
  const persist = async (
    code: string,
    kind: string,
    data: Record<string, unknown>,
    requestId?: string,
  ) => {
    if (!database) return;
    const room = rooms.rooms.get(code);
    await database.saveRoom(code, room ? rooms.exportRoom(room) : null, {
      kind,
      data,
      ...(requestId ? { requestId } : {}),
    });
  };
  io.on("connection", (socket) => {
    let requests = 0;
    let window = Date.now();
    socket.on(EVENTS.COMMAND, (input: unknown, ack: unknown) => {
      if (typeof ack !== "function") return;
      if (Date.now() - window > 10000) {
        window = Date.now();
        requests = 0;
      }
      if (++requests > commandBudget) {
        ack({ ok: false, error: "RATE_LIMITED" });
        return;
      }
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        ack({ ok: false, error: "INVALID_COMMAND" });
        return;
      }
      void enqueue(async () => {
        if (!socket.connected) {
          return;
        }
        if (!healthy) {
          ack({ ok: false, error: "PERSISTENCE_UNAVAILABLE" });
          return;
        }
        const { requestId, payload } = parsed.data;
        const fingerprint = JSON.stringify(payload);
        const session = rooms.sessions.get(socket.id);
        const cached = session?.member.replies.get(requestId);
        if (cached) {
          if (cached.payload !== fingerprint) {
            ack({ ok: false, error: "REQUEST_ID_REUSED" });
            return;
          }
          const result = structuredClone(cached.reply);
          if (result.ok && result.room)
            result.room.proofs = structuredClone(
              session!.room.proofs.slice(0, cached.proofCount),
            );
          ack(result);
          return;
        }
        const backup = database
          ? rooms.checkpoint([
              ...(session ? [session.room.code] : []),
              ...(payload.type === "join" || payload.type === "resume"
                ? [payload.code]
                : []),
            ])
          : null;
        let code = session?.room.code;
        const effects: (() => void)[] = [];
        let writing = false;
        try {
          let result: Reply;
          switch (payload.type) {
            case "create":
              if (payload.ranked && !database)
                throw new Error("RANKED_UNAVAILABLE");
              result = rooms.create(
                socket.id,
                payload.name,
                payload.capacity,
                payload.ranked ?? false,
              );
              break;
            case "join":
              if (database) {
                const account = rooms.identities.get(socket.id);
                const targetRoom = rooms.rooms.get(payload.code);
                if (account && targetRoom)
                  for (const member of targetRoom.members)
                    if (
                      member.accountId &&
                      !(await canInteract(database, account, member.accountId))
                    )
                      throw new Error("INTERACTION_UNAVAILABLE");
              }
              result = rooms.join(socket.id, payload.name, payload.code);
              break;
            case "resume": {
              const resumed = rooms.resume(
                socket.id,
                payload.code,
                payload.token,
              );
              result = resumed.reply;
              if (resumed.replaced)
                effects.push(() => {
                  io.sockets.sockets
                    .get(resumed.replaced!)
                    ?.emit(EVENTS.REPLACED);
                  io.sockets.sockets.get(resumed.replaced!)?.disconnect(true);
                });
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
              const oldRoom = rooms.session(socket.id).room;
              code = oldRoom.code;
              const snapshot = rooms.leave(socket.id);
              effects.push(() => {
                socket.leave(oldRoom.code);
                if (snapshot) broadcast(snapshot);
              });
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
              let opponent: string | undefined;
              const account = rooms.identities.get(socket.id);
              const ranked = payload.ranked ?? false;
              if (ranked && (!database || !account))
                throw new Error("RANKED_UNAVAILABLE");
              for (const id of queue.keys()) {
                if (queue.get(id)!.ranked !== ranked) continue;
                if (id === socket.id || !io.sockets.sockets.has(id)) continue;
                const otherAccount = rooms.identities.get(id);
                if (
                  account &&
                  otherAccount &&
                  (account === otherAccount ||
                    (database &&
                      !(await canInteract(database, account, otherAccount))))
                )
                  continue;
                opponent = id;
                break;
              }
              if (!opponent) {
                if (queue.size >= 1000) throw new Error("QUEUE_FULL");
                queue.set(socket.id, { name: payload.name, ranked });
                result = { ok: true, room: null, queued: true };
                break;
              }
              const otherName = queue.get(opponent)!.name;
              queue.delete(opponent);
              const other = rooms.create(opponent, otherName, 2, ranked);
              if (!other.ok || !other.room) throw new Error("MATCH_ERROR");
              const theirs = io.sockets.sockets.get(opponent)!;
              result = rooms.join(socket.id, payload.name, other.room.code);
              const started = rooms.start(opponent);
              effects.push(() => {
                theirs.join(started.code);
                theirs.emit(EVENTS.MATCHED, { ...other, room: started });
              });
              if (result.ok) result = { ...result, room: started };
              break;
            }
          }
          const active = rooms.sessions.get(socket.id);
          code = active?.room.code ?? code;
          if (code) {
            writing = true;
            await persist(
              code,
              payload.type,
              {
                playerId: active?.member.id ?? session?.member.id,
                ...(payload.type === "roll"
                  ? { proof: active?.room.proofs.at(-1) }
                  : payload.type === "move"
                    ? { pawn: payload.pawn }
                    : {}),
                version: active?.room.state?.version ?? null,
              },
              requestId,
            );
            writing = false;
          }
          if (active) {
            const compact = structuredClone(result);
            let proofCount = 0;
            if (compact.ok && compact.room) {
              proofCount = compact.room.proofs.length;
              compact.room.proofs = [];
            }
            active.member.replies.set(requestId, {
              payload: fingerprint,
              reply: compact,
              proofCount,
            });
            if (active.member.replies.size > 128)
              active.member.replies.delete(
                active.member.replies.keys().next().value!,
              );
            socket.join(active.room.code);
          }
          effects.forEach((effect) => effect());
          ack(result);
          if (result.ok && result.room) broadcast(result.room);
          app.log.info({
            event: payload.type === "roll" ? "dice_rolled" : "room_command",
            kind: payload.type,
            code,
            version: active?.room.state?.version ?? null,
          });
        } catch (error) {
          if (backup) rooms.rollback(backup);
          if (writing) {
            healthy = false;
            app.log.error({ event: "room_persistence_failed" });
            ack({ ok: false, error: "PERSISTENCE_UNAVAILABLE" });
          } else
            ack({
              ok: false,
              error: error instanceof Error ? error.message : "REQUEST_FAILED",
            });
        }
      }).catch(() => ack({ ok: false, error: "SERVER_BUSY" }));
    });
    socket.on("disconnect", () => {
      queue.delete(socket.id);
      rooms.identities.delete(socket.id);
      void enqueue(async () => {
        const snapshot = rooms.disconnect(socket.id);
        if (snapshot) {
          try {
            if (healthy)
              await persist(snapshot.code, "disconnect", {
                version: snapshot.state?.version ?? null,
              });
          } catch {
            healthy = false;
            app.log.error({ event: "room_persistence_failed" });
          }
          if (healthy) broadcast(snapshot);
        }
      }).catch(() => {
        healthy = false;
        app.log.error({ event: "room_disconnect_queue_failed" });
      });
    });
  });
  let tickPending = false;
  const timer = setInterval(() => {
    if (tickPending || !healthy) return;
    tickPending = true;
    void enqueue(async () => {
      try {
        const previousCodes = [...rooms.rooms.keys()];
        const snapshots = rooms.tick();
        for (const code of previousCodes)
          if (!rooms.rooms.has(code)) await persist(code, "expired", {});
        for (const snapshot of snapshots) {
          await persist(snapshot.code, "timeout", {
            version: snapshot.state?.version ?? null,
          });
          broadcast(snapshot);
        }
      } catch {
        healthy = false;
        app.log.error({ event: "room_persistence_failed" });
      } finally {
        tickPending = false;
      }
    }).catch(() => {
      tickPending = false;
    });
  }, 500);
  timer.unref();
  app.addHook("preClose", async () => {
    clearInterval(timer);
    io.disconnectSockets(true);
    io.engine.close();
    await tail;
  });
  app.addHook("onClose", async () => {
    clearInterval(timer);
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await tail;
  });
  return { io, rooms, isHealthy: () => healthy };
}
