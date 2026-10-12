import { DurableObject } from "cloudflare:workers";
import { WIRE } from "@mench/game-protocol";
import { Rooms, type RoomSnapshot } from "@mench/room-core";
import { Hub, type Peer, type PeerMemory, type RoomStore } from "./hub";
import {
  WalletError,
  buy,
  claimDaily,
  equip,
  newWallet,
  sameHash,
  sha256Hex,
  view,
  type WalletState,
} from "./wallet";

export interface Env {
  ASSETS: Fetcher;
  GAME_HUB: DurableObjectNamespace<GameHub>;
  WALLET: DurableObjectNamespace<Wallet>;
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

/**
 * One Durable Object per wallet (named by its id): requests for the same
 * wallet run one at a time, so coins can never be spent twice.
 */
export class Wallet extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.split("/").pop() ?? "";
    const token = request.headers.get("X-Wallet-Token") ?? "";
    if (!/^[a-f0-9]{64}$/.test(token))
      return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const hash = await sha256Hex(token);
    const now = Date.now();
    let state = await this.ctx.storage.get<WalletState>("w");
    if (action === "create") {
      if (state) return Response.json({ error: "EXISTS" }, { status: 409 });
      state = newWallet(hash, now);
      await this.ctx.storage.put("w", state);
      return Response.json({ wallet: view(state, now) });
    }
    if (!state || !sameHash(state.tokenHash, hash))
      return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    let granted = 0;
    try {
      const body =
        request.method === "POST"
          ? ((await request.json().catch(() => ({}))) as { sku?: unknown })
          : {};
      if (action === "daily") granted = claimDaily(state, now);
      else if (action === "buy") buy(state, body.sku);
      else if (action === "equip") equip(state, body.sku);
      else if (action !== "wallet")
        return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    } catch (error) {
      if (error instanceof WalletError)
        return Response.json(
          { error: error.message, wallet: view(state, now) },
          { status: 409 },
        );
      throw error;
    }
    if (action !== "wallet") await this.ctx.storage.put("w", state);
    return Response.json({ wallet: view(state, now), granted });
  }
}

const WALLET_ACTIONS = new Set(["wallet", "create", "daily", "buy", "equip"]);

/**
 * /api/wallet/<action>. Headers X-Wallet-Id (UUID) and X-Wallet-Token (64 hex,
 * generated on the device). Browsers on another allowed origin (the espadna.ir
 * copy) get CORS headers.
 */
async function walletRoute(
  request: Request,
  env: Env,
  url: URL,
  allowed: string[],
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const cors: Record<string, string> =
    origin && origin !== url.origin && allowed.includes(origin)
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers":
            "Content-Type, X-Wallet-Id, X-Wallet-Token",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          Vary: "Origin",
        }
      : {};
  if (origin && origin !== url.origin && !allowed.includes(origin))
    return new Response("Forbidden origin", { status: 403 });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  const action =
    url.pathname.slice("/api/wallet".length).replace(/^\//, "") || "wallet";
  const id = request.headers.get("X-Wallet-Id") ?? "";
  if (
    !WALLET_ACTIONS.has(action) ||
    !/^[0-9a-f-]{36}$/.test(id) ||
    (action !== "wallet" && request.method !== "POST")
  )
    return Response.json(
      { error: "BAD_REQUEST" },
      { status: 400, headers: cors },
    );
  const stub = env.WALLET.get(env.WALLET.idFromName(id));
  const response = await stub.fetch(
    new Request(`https://wallet/${action}`, {
      method: request.method,
      headers: request.headers,
      body: request.method === "POST" ? await request.text() : null,
    }),
  );
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, headers });
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const allowed = (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (
      url.pathname === "/api/wallet" ||
      url.pathname.startsWith("/api/wallet/")
    )
      return walletRoute(request, env, url, allowed);
    if (url.pathname === WIRE.PATH) {
      const origin = request.headers.get("Origin");
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
