import { io, type Socket } from "socket.io-client";
import {
  EVENTS,
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
  private readonly socket: Socket;
  private session: Session | null;
  constructor(private readonly options: ClientOptions) {
    this.session = options.session ?? null;
    this.socket = io(options.url, {
      autoConnect: false,
      ...(options.token
        ? { extraHeaders: { Authorization: `Bearer ${options.token}` } }
        : {}),
    });
    this.socket.on("connect", () => {
      this.update({ connected: true, error: "" });
      if (this.session)
        void this.send({
          type: "resume",
          code: this.session.code,
          token: this.session.token,
        }).then((reply) => {
          if (reply && !reply.ok) {
            this.session = null;
            options.save(null);
            this.update({ room: null, playerId: null });
          }
        });
    });
    this.socket.on("disconnect", () =>
      this.update({ connected: false, queued: false }),
    );
    this.socket.on("connect_error", () =>
      this.update({ error: "CONNECTION_FAILED" }),
    );
    this.socket.on(EVENTS.SNAPSHOT, (room: PublicRoom) =>
      this.adopt({ ok: true, room }),
    );
    this.socket.on(EVENTS.MATCHED, (reply: Reply) => this.adopt(reply));
    this.socket.on(EVENTS.REPLACED, () => {
      this.socket.disconnect();
      this.update({ connected: false, error: "SESSION_REPLACED" });
    });
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
    this.socket.removeAllListeners();
    this.socket.disconnect();
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
        old.state &&
        reply.room.state &&
        old.state.version > reply.room.state.version
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
      const command = { version: 1, requestId, payload };
      let reply: Reply;
      try {
        reply = (await this.socket
          .timeout(5000)
          .emitWithAck(EVENTS.COMMAND, command)) as Reply;
      } catch {
        if (!this.socket.connected) throw Error("CONNECTION_FAILED");
        reply = (await this.socket
          .timeout(5000)
          .emitWithAck(EVENTS.COMMAND, command)) as Reply;
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
export { readSocial, sendSocial } from "./social";
