import { io, type Socket } from "socket.io-client";
import {
  EVENTS,
  WIRE,
  type Command,
  type Reply,
  type ServerFrame,
} from "@mench/game-protocol";
export interface TransportHandlers {
  connect: () => void;
  disconnect: () => void;
  error: () => void;
  event: (name: string, data: unknown) => void;
}
/** Carries protocol commands and server events; the room logic stays transport-agnostic. */
export interface Transport {
  readonly connected: boolean;
  connect(): void;
  disconnect(): void;
  request(command: Command, timeoutMs: number): Promise<Reply>;
  dispose(): void;
}
export type TransportKind = "socket.io" | "websocket";

export function socketIoTransport(
  handlers: TransportHandlers,
  url?: string,
  token?: string,
): Transport {
  const socket: Socket = io(url, {
    autoConnect: false,
    ...(token ? { extraHeaders: { Authorization: `Bearer ${token}` } } : {}),
  });
  socket.on("connect", handlers.connect);
  socket.on("disconnect", handlers.disconnect);
  socket.on("connect_error", handlers.error);
  for (const name of Object.values(EVENTS))
    socket.on(name, (data: unknown) => handlers.event(name, data));
  return {
    get connected() {
      return socket.connected;
    },
    connect: () => socket.connect(),
    disconnect: () => socket.disconnect(),
    request: async (command, timeoutMs) =>
      (await socket
        .timeout(timeoutMs)
        .emitWithAck(EVENTS.COMMAND, command)) as Reply,
    dispose: () => {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}

/** Resolves the realtime endpoint: an explicit API origin or the page origin. */
export function websocketUrl(url?: string): string {
  const base = new URL(
    url ??
      (typeof location === "undefined" ? "http://localhost" : location.href),
  );
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = WIRE.PATH;
  base.search = "";
  base.hash = "";
  return base.href;
}

/**
 * Plain WebSocket transport for the edge server (Cloudflare Durable Object).
 * It reconnects with backoff and treats a missed heartbeat as a lost connection,
 * so a phone switching networks resumes its seat instead of waiting for TCP.
 */
export function webSocketTransport(
  handlers: TransportHandlers,
  url?: string,
  timing = { heartbeatMs: 10000, deadMs: 25000, maxBackoffMs: 5000 },
): Transport {
  const endpoint = websocketUrl(url);
  let socket: WebSocket | null = null;
  let open = false;
  let wanted = false;
  let attempts = 0;
  let nextId = 1;
  let lastSeen = 0;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const pending = new Map<
    number,
    { resolve: (reply: Reply) => void; reject: (error: Error) => void }
  >();
  const failPending = () => {
    for (const { reject } of pending.values())
      reject(new Error("CONNECTION_FAILED"));
    pending.clear();
  };
  const dropped = (current: WebSocket) => {
    if (socket !== current) return;
    socket = null;
    clearInterval(heartbeat);
    const wasOpen = open;
    open = false;
    failPending();
    if (wasOpen) handlers.disconnect();
    else handlers.error();
    if (!wanted) return;
    const delay = Math.min(timing.maxBackoffMs, 250 * 2 ** attempts++);
    retry = setTimeout(start, delay);
  };
  function start() {
    clearTimeout(retry);
    if (socket || !wanted) return;
    let current: WebSocket;
    try {
      current = new WebSocket(endpoint);
    } catch {
      handlers.error();
      retry = setTimeout(start, timing.maxBackoffMs);
      return;
    }
    socket = current;
    current.onopen = () => {
      if (socket !== current) return;
      open = true;
      attempts = 0;
      lastSeen = Date.now();
      heartbeat = setInterval(() => {
        if (Date.now() - lastSeen > timing.deadMs) {
          current.close();
          dropped(current);
          return;
        }
        if (current.readyState === 1) current.send(WIRE.PING);
      }, timing.heartbeatMs);
      handlers.connect();
    };
    current.onmessage = (message: MessageEvent) => {
      if (socket !== current) return;
      lastSeen = Date.now();
      if (typeof message.data !== "string" || message.data === WIRE.PONG)
        return;
      let frame: ServerFrame;
      try {
        frame = JSON.parse(message.data) as ServerFrame;
      } catch {
        return;
      }
      if (frame.t === "ack") {
        pending.get(frame.id)?.resolve(frame.reply);
        pending.delete(frame.id);
      } else if (frame.t === "event") handlers.event(frame.name, frame.data);
    };
    current.onclose = () => dropped(current);
    current.onerror = () => {
      current.close();
      dropped(current);
    };
  }
  const wake = () => {
    if (!wanted) return;
    if (!socket) {
      attempts = 0;
      start();
    } else if (open && socket.readyState === 1) socket.send(WIRE.PING);
  };
  // The browser knows the network is gone before any heartbeat could.
  const lost = () => {
    const current = socket;
    if (!current) return;
    current.close();
    dropped(current);
  };
  const listen = (on: boolean) => {
    const target = globalThis as {
      addEventListener?: (name: string, fn: () => void) => void;
      removeEventListener?: (name: string, fn: () => void) => void;
    };
    const method = on ? target.addEventListener : target.removeEventListener;
    method?.call(globalThis, "online", wake);
    method?.call(globalThis, "focus", wake);
    method?.call(globalThis, "offline", lost);
  };
  const transport: Transport = {
    get connected() {
      return open;
    },
    connect: () => {
      if (!wanted) listen(true);
      wanted = true;
      start();
    },
    disconnect: () => {
      wanted = false;
      listen(false);
      clearTimeout(retry);
      const current = socket;
      if (current) {
        current.close();
        dropped(current);
      }
    },
    request: (command, timeoutMs) =>
      new Promise<Reply>((resolve, reject) => {
        if (!socket || !open) {
          reject(new Error("CONNECTION_FAILED"));
          return;
        }
        const id = nextId++;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("TIMEOUT"));
        }, timeoutMs);
        pending.set(id, {
          resolve: (reply) => {
            clearTimeout(timer);
            resolve(reply);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });
        socket.send(JSON.stringify({ t: "cmd", id, command }));
      }),
    dispose: () => transport.disconnect(),
  };
  return transport;
}
