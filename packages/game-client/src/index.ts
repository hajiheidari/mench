import {
  socketIoTransport,
  webSocketTransport,
  type Transport,
  type TransportKind,
} from "./transport";
import {
  EVENTS,
  type Command,
  type Intent,
  type PublicRoom,
  type Reply,
} from "@mench/game-protocol";
export interface Session {
  code: string;
  token: string;
  playerId: string;
}
export interface ClientState {
  room: PublicRoom | null;
  playerId: string | null;
  connected: boolean;
  queued: boolean;
  busy: boolean;
  error: string;
}
export interface ClientOptions {
  url?: string;
  session?: Session | null;
  token?: string;
  /** "websocket" talks to the edge server; Socket.IO is the Node API default. */
  transport?: TransportKind;
  requestId: () => string;
  save: (session: Session | null) => void;
}
export class GameClient {
  readonly commitments = new Map<string, string>();
  readonly nonces = new Map<string, string>();
  state: ClientState = {
    room: null,
    playerId: null,
    connected: false,
    queued: false,
    busy: false,
    error: "",
  };
  private readonly listeners = new Set<(state: ClientState) => void>();
  private readonly socket: Transport;
  private session: Session | null;
  constructor(private readonly options: ClientOptions) {
    this.session = options.session ?? null;
    const handlers = {
      connect: () => {
        this.update({ connected: true, error: "" });
        if (this.session)
          void this.send({
            type: "resume",
            code: this.session.code,
            token: this.session.token,
          }).then((reply) => {
            if (reply && !reply.ok) {
              // An old room that ended or expired: forget it quietly.
              this.session = null;
              options.save(null);
              this.update({ room: null, playerId: null, error: "" });
            }
          });
      },
      disconnect: () => this.update({ connected: false, queued: false }),
      error: () => this.update({ error: "CONNECTION_FAILED" }),
      event: (name: string, data: unknown) => this.event(name, data),
    };
    this.socket =
      options.transport === "websocket"
        ? webSocketTransport(handlers, options.url)
        : socketIoTransport(handlers, options.url, options.token);
  }
  private event(name: string, data: unknown) {
    if (name === EVENTS.SNAPSHOT)
      this.adopt({ ok: true, room: data as PublicRoom });
    else if (name === EVENTS.MATCHED) this.adopt(data as Reply);
    else if (name === EVENTS.REPLACED) {
      this.socket.disconnect();
      this.update({ connected: false, error: "SESSION_REPLACED" });
    } else if (name === EVENTS.AUTH_REVOKED) {
      this.session = null;
      this.options.save(null);
      this.socket.disconnect();
      this.update({
        connected: false,
        queued: false,
        room: null,
        playerId: null,
        error: "UNAUTHENTICATED",
      });
    }
  }
  subscribe(listener: (state: ClientState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
  connect() {
    this.socket.connect();
  }
  close() {
    this.socket.dispose();
    this.listeners.clear();
  }
  private update(patch: Partial<ClientState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
  private adopt(reply: Reply) {
    if (!reply.ok) {
      this.update({ error: reply.error });
      return;
    }
    if (reply.room) {
      if (reply.room.commitment)
        this.commitments.set(
          reply.room.commitment.hash,
          reply.room.commitment.hash,
        );
      const old = this.state.room;
      const room =
        old?.code === reply.room.code &&
        old.matchId === reply.room.matchId &&
        (old.revision ?? old.state?.version ?? 0) >
          (reply.room.revision ?? reply.room.state?.version ?? 0)
          ? old
          : reply.room;
      if (reply.token && reply.playerId) {
        this.session = {
          code: room.code,
          token: reply.token,
          playerId: reply.playerId,
        };
        this.options.save(this.session);
      }
      this.update({
        room,
        playerId: reply.playerId ?? this.state.playerId,
        queued: false,
      });
    } else if (reply.queued !== undefined)
      this.update({ queued: reply.queued });
  }
  async send(payload: Intent): Promise<Reply | undefined> {
    if (!this.socket.connected) {
      this.update({ error: "CONNECTION_FAILED" });
      return;
    }
    if (this.state.busy && payload.type !== "resume") return;
    this.update({ busy: true, error: "" });
    try {
      const requestId = this.options.requestId();
      const command: Command = { version: 1, requestId, payload };
      let reply: Reply;
      try {
        reply = await this.socket.request(command, 5000);
      } catch {
        if (!this.socket.connected) throw Error("CONNECTION_FAILED");
        reply = await this.socket.request(command, 5000);
      }
      this.adopt(reply);
      if (reply.ok && payload.type === "leave") {
        this.session = null;
        this.options.save(null);
        this.update({ room: null, playerId: null });
      }
      return reply;
    } catch {
      this.update({ error: "CONNECTION_FAILED" });
      return;
    } finally {
      this.update({ busy: false });
    }
  }
}
export { websocketUrl, type TransportKind } from "./transport";
export { readSocial, sendSocial } from "./social";
export { readRankings } from "./rankings";
export { readEconomy, buyCosmetic, equipCosmetic } from "./economy";
export {
  listTournaments,
  readTournament,
  createTournament,
  sendTournament,
} from "./tournaments";
export { readAdmin, sendAdmin } from "./admin";

export { readHistory, readTranscript } from "./history";
export {
  WalletClient,
  WalletRequestError,
  type WalletView,
  type WalletItem,
  type WalletStore,
  type WalletCredentials,
} from "./wallet";
