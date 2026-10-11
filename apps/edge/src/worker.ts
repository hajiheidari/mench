import { DurableObject } from "cloudflare:workers";
import { WIRE } from "@mench/game-protocol";
import { Rooms, type RoomSnapshot } from "@mench/room-core";
import { Hub, type Peer, type PeerMemory, type RoomStore } from "./hub";

export interface Env {
  ASSETS: Fetcher;
  GAME_HUB: DurableObjectNamespace<GameHub>;
  /** Comma-separated browser origins allowed to open game sockets. */
  ALLOWED_ORIGINS?: string;
}

const STALE_MS = 30000;
const HEARTBEAT_CHECK_MS = 15000;

class StorageRooms implements RoomStore {
  constructor(private readonly storage: DurableObjectStorage) {}
  async load() {
    const rows = await this.storage.list<RoomSnapshot>({ prefix: "room:" });
    return [...rows.values()];
  }
  async save(code: string, snapshot: RoomSnapshot | null) {
    if (snapshot) await this.storage.put(`room:${code}`, snapshot);
    else await this.storage.delete(`room:${code}`);
  }
}

function peerOf(socket: WebSocket, sid: string): Peer {
  return {
    sid,
    send: (text) => socket.send(text),
    close: (code, reason) => socket.close(code, reason),
    remember: (memory) => socket.serializeAttachment(memory),
  };
}

/** The single room owner. WebSockets hibernate; state lives in Durable Object storage. */
export class GameHub extends DurableObject<Env> {
  private readonly hub: Hub;
  private ready: Promise<void>;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.hub = new Hub(new Rooms(), new StorageRooms(ctx.storage));
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(WIRE.PING, WIRE.PONG),
    );
    this.ready = ctx.blockConcurrencyWhile(async () => {
      await this.hub.restore(
        ctx.getWebSockets().map((socket) => {
          const memory = socket.deserializeAttachment() as PeerMemory | null;
          return {
            peer: peerOf(socket, memory?.sid ?? crypto.randomUUID()),
            memory,
          };
        }),
      );
      await this.schedule();
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    if (request.headers.get("Upgrade") !== "websocket")
      return new Response("Expected WebSocket", { status: 426 });
    if (this.hub.full) return new Response("SERVER_FULL", { status: 503 });
    const [client, server] = Object.values(new WebSocketPair()) as [
      WebSocket,
      WebSocket,
    ];
    this.ctx.acceptWebSocket(server);
    this.hub.open(peerOf(server, crypto.randomUUID()));
    await this.schedule();
    return new Response(null, { status: 101, webSocket: client });
  }

  private sid(socket: WebSocket): string | null {
    return (socket.deserializeAttachment() as PeerMemory | null)?.sid ?? null;
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    await this.ready;
    const sid = this.sid(socket);
    if (!sid) return;
    if (typeof message !== "string" || message.length > 16384) {
      socket.close(1009, "MESSAGE_TOO_LARGE");
      await this.hub.closed(sid);
      return;
    }
    if (message === WIRE.PING) {
      socket.send(WIRE.PONG);
      return;
    }
    await this.hub.message(peerOf(socket, sid), message);
    await this.schedule();
  }

  async webSocketClose(socket: WebSocket) {
    await this.ready;
    const sid = this.sid(socket);
    if (sid) await this.hub.closed(sid);
    await this.schedule();
  }

  async webSocketError(socket: WebSocket) {
    await this.webSocketClose(socket);
  }

  async alarm() {
    await this.ready;
    // Phones that vanish without closing stop pinging; release their seats.
    const now = Date.now();
    for (const socket of this.ctx.getWebSockets()) {
      const seen = this.ctx.getWebSocketAutoResponseTimestamp(socket);
      const sid = this.sid(socket);
      if (seen && now - seen.getTime() > STALE_MS && sid) {
        try {
          socket.close(4001, "HEARTBEAT_TIMEOUT");
        } catch {
          /* Already closing. */
        }
        await this.hub.closed(sid);
      }
    }
    await this.hub.tick();
    await this.schedule();
  }

  private async schedule() {
    const now = Date.now();
    let next = this.hub.nextWake(now);
    if (this.ctx.getWebSockets().length)
      next = Math.min(next ?? Infinity, now + HEARTBEAT_CHECK_MS);
    if (next === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > next || current < now)
      await this.ctx.storage.setAlarm(Math.max(next, now + 50));
  }
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === WIRE.PATH) {
      const origin = request.headers.get("Origin");
      const allowed = (env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      // Native apps send no Origin; browsers must come from the game's own pages.
      if (origin && origin !== url.origin && !allowed.includes(origin))
        return new Response("Forbidden origin", { status: 403 });
      return env.GAME_HUB.get(env.GAME_HUB.idFromName("global")).fetch(request);
    }
    if (url.pathname === "/healthz")
      return Response.json({ ok: true, service: "mench-edge" });
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS))
      headers.set(key, value);
    if (url.pathname === "/sw.js" || url.pathname.endsWith(".webmanifest"))
      headers.set("Cache-Control", "no-cache");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
