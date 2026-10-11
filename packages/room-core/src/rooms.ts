import { randomBytes, randomUUID, createHash } from "node:crypto";
import {
  applyAction,
  createGame,
  currentPlayer,
  type GameState,
} from "@mench/game-engine";
import {
  commitment,
  reveal,
  secureSeed,
  toHex,
  type DiceContext,
  type DiceProof,
} from "@mench/fair-dice";
import type { PublicRoom, Reply } from "@mench/game-protocol";
interface Member {
  accountId: string | null;
  id: string;
  name: string;
  tokenHash: string;
  socketId: string | null;
  disconnectedAt: number | null;
  replies: Map<
    string,
    { payload: string; reply: Reply; proofCount: number; proofOffset: number }
  >;
}
interface Pending {
  seed: string;
  context: DiceContext;
  hash: string;
}
export interface Room {
  code: string;
  revision: number;
  matchId: string;
  ranked: boolean;
  hostId: string;
  capacity: number;
  members: Member[];
  state: GameState | null;
  pending: Pending | null;
  proofs: DiceProof[];
  deadline: number | null;
  createdAt: number;
}
export interface RoomSnapshot extends Omit<Room, "members"> {
  storageVersion: 1;
  proofOffset?: number;
  members: Omit<Member, "replies">[];
}
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export class RoomError extends Error {}
export class Rooms {
  readonly identities = new Map<string, string>();
  readonly rooms = new Map<string, Room>();
  readonly sessions = new Map<string, { room: Room; member: Member }>();
  constructor(
    readonly now = () => Date.now(),
    readonly turnMs = 30000,
    readonly graceMs = 45000,
  ) {}
  exportRoom(room: Room): RoomSnapshot {
    return structuredClone({
      ...room,
      storageVersion: 1,
      proofs: room.proofs.slice(-16),
      proofOffset: Math.max(0, room.proofs.length - 16),
      members: room.members.map(({ replies, ...member }) => {
        void replies;
        return member;
      }),
    });
  }
  exportAll(): RoomSnapshot[] {
    return [...this.rooms.values()].map((room) => this.exportRoom(room));
  }
  checkpoint(codes: readonly string[]): {
    rooms: Room[];
    existing: Set<string>;
  } {
    return {
      rooms: structuredClone(
        [...new Set(codes)].flatMap((code) => {
          const room = this.rooms.get(code);
          return room ? [room] : [];
        }),
      ),
      existing: new Set(this.rooms.keys()),
    };
  }
  rollback(checkpoint: ReturnType<Rooms["checkpoint"]>): void {
    const restoring = new Set(checkpoint.rooms.map((room) => room.code));
    for (const [code] of this.rooms)
      if (!checkpoint.existing.has(code)) {
        this.rooms.delete(code);
        restoring.add(code);
      }
    for (const [socketId, session] of this.sessions)
      if (restoring.has(session.room.code)) this.sessions.delete(socketId);
    for (const room of checkpoint.rooms) {
      this.rooms.set(room.code, room);
      for (const member of room.members)
        if (member.socketId)
          this.sessions.set(member.socketId, { room, member });
    }
  }
  restore(snapshots: RoomSnapshot[], afterRestart: boolean): void {
    this.rooms.clear();
    this.sessions.clear();
    for (const snapshot of snapshots) {
      if (snapshot.storageVersion !== 1)
        throw new RoomError("UNKNOWN_STORAGE_VERSION");
      if (this.now() - snapshot.createdAt > 24 * 3600000) continue;
      const room: Room = {
        ...structuredClone(snapshot),
        matchId: snapshot.matchId ?? randomUUID(),
        revision: (snapshot.revision ?? 0) + (afterRestart ? 1 : 0),
        ranked: snapshot.ranked ?? false,
        members: snapshot.members.map((m) => ({
          ...structuredClone(m),
          replies: new Map(),
        })),
      };
      for (const member of room.members) {
        if (afterRestart) {
          member.socketId = null;
          member.disconnectedAt = this.now();
          if (room.state && room.state.phase !== "finished")
            room.state = applyAction(room.state, {
              type: "connection",
              playerId: member.id,
              connected: false,
            });
        } else if (member.socketId)
          this.sessions.set(member.socketId, { room, member });
      }
      if (afterRestart && room.state && room.state.phase !== "finished")
        room.deadline = this.now() + this.graceMs;
      this.rooms.set(room.code, room);
    }
  }
  public(room: Room): PublicRoom {
    return {
      code: room.code,
      revision: room.revision,
      matchId: room.matchId,
      ranked: room.ranked,
      hostId: room.hostId,
      capacity: room.capacity,
      players: room.members.map((m) => ({
        id: m.id,
        name: m.name,
        connected: m.socketId !== null,
      })),
      state: room.state ? structuredClone(room.state) : null,
      deadline: room.deadline,
      commitment: room.pending
        ? { hash: room.pending.hash, context: room.pending.context }
        : null,
      proofs: structuredClone(room.proofs.slice(-16)),
      proofOffset: Math.max(0, room.proofs.length - 16),
    };
  }
  private add(room: Room, socketId: string, name: string): Reply {
    if (this.sessions.has(socketId)) throw new RoomError("ALREADY_JOINED");
    const accountId = this.identities.get(socketId) ?? null;
    if (room.ranked && !accountId) throw new RoomError("UNAUTHENTICATED");
    if (accountId && room.members.some((m) => m.accountId === accountId))
      throw new RoomError("ALREADY_JOINED");
    const token = toHex(randomBytes(32));
    const member: Member = {
      accountId,
      id: randomUUID(),
      name,
      tokenHash: tokenHash(token),
      socketId,
      disconnectedAt: null,
      replies: new Map(),
    };
    room.members.push(member);
    room.revision++;
    if (!room.hostId) room.hostId = member.id;
    this.sessions.set(socketId, { room, member });
    return { ok: true, room: this.public(room), playerId: member.id, token };
  }
  create(
    socketId: string,
    name: string,
    capacity: number,
    ranked = false,
  ): Reply {
    if (ranked && (!this.identities.has(socketId) || capacity !== 2))
      throw new RoomError("RANKED_UNAVAILABLE");
    if (this.rooms.size >= 1000) throw new RoomError("SERVER_FULL");
    if (this.sessions.has(socketId)) throw new RoomError("ALREADY_JOINED");
    let code: string;
    do {
      code = toHex(randomBytes(5)).toUpperCase();
    } while (this.rooms.has(code));
    const room: Room = {
      code,
      revision: 0,
      matchId: randomUUID(),
      ranked,
      hostId: "",
      capacity,
      members: [],
      state: null,
      pending: null,
      proofs: [],
      deadline: null,
      createdAt: this.now(),
    };
    this.rooms.set(code, room);
    return this.add(room, socketId, name);
  }
  join(socketId: string, name: string, code: string): Reply {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError("ROOM_NOT_FOUND");
    if (room.state) throw new RoomError("ALREADY_STARTED");
    if (room.members.length >= room.capacity) throw new RoomError("ROOM_FULL");
    return this.add(room, socketId, name);
  }
  resume(
    socketId: string,
    code: string,
    token: string,
  ): { reply: Reply; replaced: string | null } {
    const room = this.rooms.get(code);
    const member = room?.members.find((m) => m.tokenHash === tokenHash(token));
    if (!room || !member) throw new RoomError("INVALID_SESSION");
    if (member.accountId && this.identities.get(socketId) !== member.accountId)
      throw new RoomError("UNAUTHENTICATED");
    if (
      this.sessions.has(socketId) &&
      this.sessions.get(socketId)?.member !== member
    )
      throw new RoomError("ALREADY_JOINED");
    const replaced = member.socketId;
    if (replaced) this.sessions.delete(replaced);
    member.socketId = socketId;
    member.disconnectedAt = null;
    this.sessions.set(socketId, { room, member });
    if (room.state && room.state.phase !== "finished")
      room.state = applyAction(room.state, {
        type: "connection",
        playerId: member.id,
        connected: true,
      });
    room.revision++;
    return {
      reply: { ok: true, room: this.public(room), playerId: member.id },
      replaced: replaced !== socketId ? replaced : null,
    };
  }
  session(socketId: string) {
    const s = this.sessions.get(socketId);
    if (!s) throw new RoomError("NOT_JOINED");
    return s;
  }
  private prepare(room: Room): void {
    if (!room.state || room.state.phase === "finished") {
      room.pending = null;
      room.deadline = null;
      return;
    }
    room.deadline = this.now() + this.turnMs;
    if (room.state.phase === "roll") {
      const context: DiceContext = {
        gameId: room.code,
        roll: room.proofs.length,
        playerId: currentPlayer(room.state).id,
        version: room.state.version,
      };
      const seed = secureSeed();
      room.pending = { seed, context, hash: commitment(seed, context) };
    } else room.pending = null;
  }
  start(socketId: string): PublicRoom {
    const { room, member } = this.session(socketId);
    if (member.id !== room.hostId) throw new RoomError("HOST_ONLY");
    if (room.state) throw new RoomError("ALREADY_STARTED");
    if (
      room.members.length !== room.capacity ||
      room.members.some((m) => !m.socketId)
    )
      throw new RoomError("WAITING_FOR_PLAYERS");
    room.state = createGame(room.members.map((m) => m.id));
    room.revision++;
    this.prepare(room);
    return this.public(room);
  }
  roll(socketId: string, nonce: string, expectedVersion: number): PublicRoom {
    const { room, member } = this.session(socketId);
    if (!room.state || !room.pending) throw new RoomError("NOT_ROLL_PHASE");
    if (room.state.version !== expectedVersion)
      throw new RoomError("STALE_VERSION");
    if (currentPlayer(room.state).id !== member.id)
      throw new RoomError("NOT_YOUR_TURN");
    const proof = reveal(room.pending.seed, room.pending.context, nonce);
    room.state = applyAction(room.state, {
      type: "roll",
      playerId: member.id,
      value: proof.value,
    });
    room.proofs.push(proof);
    room.revision++;
    this.prepare(room);
    return this.public(room);
  }
  move(socketId: string, pawn: number, expectedVersion: number): PublicRoom {
    const { room, member } = this.session(socketId);
    if (!room.state) throw new RoomError("NOT_STARTED");
    if (room.state.version !== expectedVersion)
      throw new RoomError("STALE_VERSION");
    room.state = applyAction(room.state, {
      type: "move",
      playerId: member.id,
      pawn,
    });
    room.revision++;
    this.prepare(room);
    return this.public(room);
  }
  disconnect(socketId: string): PublicRoom | null {
    const s = this.sessions.get(socketId);
    if (!s) return null;
    this.sessions.delete(socketId);
    const { room, member } = s;
    if (member.socketId !== socketId) return null;
    member.socketId = null;
    member.disconnectedAt = this.now();
    room.revision++;
    if (room.state && room.state.phase !== "finished") {
      room.state = applyAction(room.state, {
        type: "connection",
        playerId: member.id,
        connected: false,
      });
      if (currentPlayer(room.state).id === member.id)
        room.deadline = Math.max(room.deadline ?? 0, this.now() + this.graceMs);
    }
    return this.public(room);
  }
  leave(socketId: string): PublicRoom | null {
    const { room, member } = this.session(socketId);
    if (room.state) {
      member.tokenHash = secureSeed();
      return this.disconnect(socketId);
    }
    this.sessions.delete(socketId);
    room.members = room.members.filter((m) => m.id !== member.id);
    room.revision++;
    if (!room.members.length) {
      this.rooms.delete(room.code);
      return null;
    }
    if (room.hostId === member.id) room.hostId = room.members[0]!.id;
    return this.public(room);
  }
  tick(): PublicRoom[] {
    const changed: PublicRoom[] = [];
    for (const room of this.rooms.values()) {
      if (
        this.now() - room.createdAt > 24 * 3600000 ||
        (!room.state &&
          this.now() - room.createdAt > 3600000 &&
          room.members.every((m) => !m.socketId))
      ) {
        for (const m of room.members)
          if (m.socketId) this.sessions.delete(m.socketId);
        this.rooms.delete(room.code);
        continue;
      }
      if (
        room.state &&
        room.state.phase !== "finished" &&
        room.deadline !== null &&
        this.now() >= room.deadline
      ) {
        room.state = applyAction(room.state, {
          type: "timeout",
          playerId: currentPlayer(room.state).id,
        });
        room.revision++;
        this.prepare(room);
        const active = room.members.find(
          (m) => m.id === currentPlayer(room.state!).id,
        );
        if (
          active?.disconnectedAt !== null &&
          active?.disconnectedAt !== undefined
        )
          room.deadline = Math.max(
            room.deadline ?? 0,
            active.disconnectedAt + this.graceMs,
          );
        changed.push(this.public(room));
      }
    }
    return changed;
  }
}
