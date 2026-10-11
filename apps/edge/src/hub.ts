import {
  EVENTS,
  type PublicRoom,
  type Reply,
  type ServerFrame,
} from "@mench/game-protocol";
import { Rooms, commandSchema, type RoomSnapshot } from "@mench/room-core";

/** A connected client as the hub sees it; the Durable Object adapts WebSockets to this. */
export interface Peer {
  readonly sid: string;
  send(text: string): void;
  close(code: number, reason: string): void;
  /** Durable per-socket state that survives Durable Object hibernation. */
  remember(state: PeerMemory): void;
}
export interface PeerMemory {
  sid: string;
  queued?: { name: string };
}
export interface RoomStore {
  load(): Promise<RoomSnapshot[]>;
  save(code: string, snapshot: RoomSnapshot | null): Promise<void>;
}
export interface HubLimits {
  commandBudget: number;
  maxPeers: number;
  maxQueue: number;
}

/**
 * Casual online play on a single owner (one Durable Object): private rooms,
 * invite codes, casual quick match, reconnect and turn timers. Accounts and
 * ranked games stay on the Node API; here they are refused explicitly.
 */
export class Hub {
  private readonly peers = new Map<string, Peer>();
  private readonly queue = new Map<string, { name: string }>();
  private readonly budgets = new Map<
    string,
    { count: number; since: number }
  >();
  private tail = Promise.resolve();
  constructor(
    readonly rooms: Rooms,
    private readonly store: RoomStore,
    private readonly limits: HubLimits = {
      commandBudget: 100,
      maxPeers: 5000,
      maxQueue: 1000,
    },
  ) {}

  get peerCount() {
    return this.peers.size;
  }
  get full() {
    return this.peers.size >= this.limits.maxPeers;
  }

  /** Rebuilds rooms after a cold start; seats without a live socket become disconnected. */
  async restore(live: { peer: Peer; memory: PeerMemory | null }[]) {
    const snapshots = await this.store.load();
    this.rooms.restore(snapshots, false);
    for (const { peer, memory } of live) {
      this.peers.set(peer.sid, peer);
      if (memory?.queued) this.queue.set(peer.sid, memory.queued);
    }
    for (const snapshot of snapshots)
      if (!this.rooms.rooms.has(snapshot.code))
        await this.store.save(snapshot.code, null);
    for (const sid of [...this.rooms.sessions.keys()])
      if (!this.peers.has(sid)) {
        const room = this.rooms.disconnect(sid);
        if (room) await this.persist(room.code);
      }
  }

  open(peer: Peer) {
    this.peers.set(peer.sid, peer);
    peer.remember({ sid: peer.sid });
  }

  message(peer: Peer, text: string): Promise<void> {
    const budget = this.budgets.get(peer.sid) ?? {
      count: 0,
      since: Date.now(),
    };
    if (Date.now() - budget.since > 10000) {
      budget.count = 0;
      budget.since = Date.now();
    }
    budget.count++;
    this.budgets.set(peer.sid, budget);
    let frame: { t?: unknown; id?: unknown; command?: unknown };
    try {
      frame = JSON.parse(text) as typeof frame;
    } catch {
      return Promise.resolve();
    }
    if (frame.t !== "cmd" || typeof frame.id !== "number")
      return Promise.resolve();
    const id = frame.id;
    const ack = (reply: Reply) =>
      this.sendFrame(peer.sid, { t: "ack", id, reply });
    if (budget.count > this.limits.commandBudget) {
      ack({ ok: false, error: "RATE_LIMITED" });
      return Promise.resolve();
    }
    const parsed = commandSchema.safeParse(frame.command);
    if (!parsed.success) {
      ack({ ok: false, error: "INVALID_COMMAND" });
      return Promise.resolve();
    }
    return this.serial(() => this.command(peer, parsed.data, ack));
  }

  closed(sid: string): Promise<void> {
    if (!this.peers.has(sid)) return Promise.resolve();
    this.peers.delete(sid);
    this.queue.delete(sid);
    this.budgets.delete(sid);
    return this.serial(async () => {
      const room = this.rooms.disconnect(sid);
      if (room) {
        await this.persist(room.code);
        this.broadcast(room);
      }
    });
  }

  /** Applies turn timeouts and expiry; returns when the next alarm is needed. */
  tick(): Promise<void> {
    return this.serial(async () => {
      const before = [...this.rooms.rooms.keys()];
      const changed = this.rooms.tick();
      for (const code of before)
        if (!this.rooms.rooms.has(code)) await this.store.save(code, null);
      for (const room of changed) {
        await this.persist(room.code);
        this.broadcast(room);
      }
    });
  }

  nextWake(now: number): number | null {
    let next: number | null = null;
    for (const room of this.rooms.rooms.values())
      if (room.deadline !== null && room.state?.phase !== "finished")
        next = Math.min(next ?? Infinity, room.deadline);
    // Hourly sweep removes abandoned lobbies and day-old rooms.
    if (this.rooms.rooms.size) next = Math.min(next ?? Infinity, now + 3600000);
    return next;
  }

  private serial(job: () => Promise<void>): Promise<void> {
    const next = this.tail.then(job);
    this.tail = next.catch(() => undefined);
    return next;
  }

  private sendFrame(sid: string, frame: ServerFrame) {
    try {
      this.peers.get(sid)?.send(JSON.stringify(frame));
    } catch {
      /* A socket closing mid-send is handled by its close event. */
    }
  }

  private broadcast(room: PublicRoom) {
    const live = this.rooms.rooms.get(room.code);
    for (const member of live?.members ?? [])
      if (member.socketId)
        this.sendFrame(member.socketId, {
          t: "event",
          name: EVENTS.SNAPSHOT,
          data: room,
        });
  }

  private async persist(code: string) {
    const room = this.rooms.rooms.get(code);
    await this.store.save(code, room ? this.rooms.exportRoom(room) : null);
  }

  private async command(
    peer: Peer,
    data: ReturnType<typeof commandSchema.parse>,
    ack: (reply: Reply) => void,
  ) {
    const sid = peer.sid;
    if (!this.peers.has(sid)) return;
    const { requestId, payload } = data;
    const fingerprint = JSON.stringify(payload);
    const session = this.rooms.sessions.get(sid);
    const cached = session?.member.replies.get(requestId);
    if (cached) {
      if (cached.payload !== fingerprint) {
        ack({ ok: false, error: "REQUEST_ID_REUSED" });
        return;
      }
      const result = structuredClone(cached.reply);
      if (result.ok && result.room)
        result.room.proofs = structuredClone(
          session!.room.proofs.slice(
            cached.proofOffset,
            cached.proofOffset + cached.proofCount,
          ),
        );
      ack(result);
      return;
    }
    const touched = new Set<string>();
    if (session) touched.add(session.room.code);
    if (payload.type === "join" || payload.type === "resume")
      touched.add(payload.code);
    const backup = this.rooms.checkpoint([...touched]);
    const queueBackup = new Map(this.queue);
    const effects: (() => void)[] = [];
    let result: Reply;
    try {
      switch (payload.type) {
        case "create":
          if (payload.ranked) throw new Error("RANKED_UNAVAILABLE");
          result = this.rooms.create(sid, payload.name, payload.capacity);
          break;
        case "join":
          result = this.rooms.join(sid, payload.name, payload.code);
          break;
        case "resume": {
          const resumed = this.rooms.resume(sid, payload.code, payload.token);
          result = resumed.reply;
          const replaced = resumed.replaced;
          if (replaced)
            effects.push(() => {
              this.sendFrame(replaced, {
                t: "event",
                name: EVENTS.REPLACED,
                data: null,
              });
              this.peers.get(replaced)?.close(4000, "SESSION_REPLACED");
            });
          break;
        }
        case "start":
          result = { ok: true, room: this.rooms.start(sid) };
          break;
        case "roll":
          result = {
            ok: true,
            room: this.rooms.roll(sid, payload.nonce, payload.expectedVersion),
          };
          break;
        case "move":
          result = {
            ok: true,
            room: this.rooms.move(sid, payload.pawn, payload.expectedVersion),
          };
          break;
        case "leave": {
          this.dequeue(peer);
          const snapshot = this.rooms.leave(sid);
          if (snapshot) effects.push(() => this.broadcast(snapshot));
          result = { ok: true, room: null };
          break;
        }
        case "cancelQueue":
          this.dequeue(peer);
          result = { ok: true, room: null, queued: false };
          break;
        case "queue": {
          if (payload.ranked) throw new Error("RANKED_UNAVAILABLE");
          if (this.rooms.sessions.has(sid)) throw new Error("ALREADY_JOINED");
          const opponent = [...this.queue.keys()].find(
            (id) => id !== sid && this.peers.has(id),
          );
          if (!opponent) {
            if (this.queue.size >= this.limits.maxQueue)
              throw new Error("QUEUE_FULL");
            this.queue.set(sid, { name: payload.name });
            peer.remember({ sid, queued: { name: payload.name } });
            result = { ok: true, room: null, queued: true };
            break;
          }
          const otherName = this.queue.get(opponent)!.name;
          const other = this.peers.get(opponent)!;
          this.dequeue(other);
          const created = this.rooms.create(opponent, otherName, 2);
          if (!created.ok || !created.room) throw new Error("MATCH_ERROR");
          touched.add(created.room.code);
          result = this.rooms.join(sid, payload.name, created.room.code);
          const started = this.rooms.start(opponent);
          effects.push(() =>
            this.sendFrame(opponent, {
              t: "event",
              name: EVENTS.MATCHED,
              data: { ...created, room: started },
            }),
          );
          if (result.ok) result = { ...result, room: started };
          break;
        }
      }
    } catch (error) {
      this.rooms.rollback(backup);
      this.queue.clear();
      for (const [id, entry] of queueBackup) this.queue.set(id, entry);
      ack({
        ok: false,
        error: error instanceof Error ? error.message : "REQUEST_FAILED",
      });
      return;
    }
    const active = this.rooms.sessions.get(sid);
    if (active) touched.add(active.room.code);
    try {
      for (const code of touched) await this.persist(code);
    } catch {
      this.rooms.rollback(backup);
      ack({ ok: false, error: "PERSISTENCE_UNAVAILABLE" });
      return;
    }
    if (active) {
      const compact = structuredClone(result);
      let proofCount = 0;
      let proofOffset = 0;
      if (compact.ok && compact.room) {
        proofCount = compact.room.proofs.length;
        proofOffset = compact.room.proofOffset ?? 0;
        compact.room.proofs = [];
      }
      active.member.replies.set(requestId, {
        payload: fingerprint,
        reply: compact,
        proofCount,
        proofOffset,
      });
      if (active.member.replies.size > 128)
        active.member.replies.delete(
          active.member.replies.keys().next().value!,
        );
    }
    effects.forEach((effect) => effect());
    ack(result);
    if (result.ok && result.room) this.broadcast(result.room);
  }

  private dequeue(peer: Peer) {
    if (this.queue.delete(peer.sid)) peer.remember({ sid: peer.sid });
  }
}
