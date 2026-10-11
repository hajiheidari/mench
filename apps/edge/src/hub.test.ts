import { expect, test } from "vitest";
import { currentPlayer, legalMoves } from "@mench/game-engine";
import type { PublicRoom, Reply, ServerFrame } from "@mench/game-protocol";
import { Rooms, type RoomSnapshot } from "@mench/room-core";
import { Hub, type Peer, type PeerMemory, type RoomStore } from "./hub";

class MemoryStore implements RoomStore {
  readonly data = new Map<string, RoomSnapshot>();
  async load() {
    return [...this.data.values()].map((row) => structuredClone(row));
  }
  async save(code: string, snapshot: RoomSnapshot | null) {
    if (snapshot) this.data.set(code, structuredClone(snapshot));
    else this.data.delete(code);
  }
}
class FakePeer implements Peer {
  frames: ServerFrame[] = [];
  memory: PeerMemory | null = null;
  closed: string | null = null;
  private id = 0;
  constructor(readonly sid: string) {}
  send(text: string) {
    this.frames.push(JSON.parse(text) as ServerFrame);
  }
  close(_code: number, reason: string) {
    this.closed = reason;
  }
  remember(memory: PeerMemory) {
    this.memory = memory;
  }
  async ask(hub: Hub, payload: object): Promise<Reply> {
    const id = ++this.id;
    await hub.message(
      this,
      JSON.stringify({
        t: "cmd",
        id,
        command: { version: 1, requestId: crypto.randomUUID(), payload },
      }),
    );
    const ack = this.frames.find((f) => f.t === "ack" && f.id === id);
    if (!ack || ack.t !== "ack") throw Error("no ack");
    return ack.reply;
  }
  lastRoom(): PublicRoom | null {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const frame = this.frames[i]!;
      if (frame.t === "event" && frame.name === "v1:snapshot")
        return frame.data as PublicRoom;
    }
    return null;
  }
}
const nonce = () => "ab".repeat(32);

async function lobby(capacity = 2, commandBudget = 100) {
  const store = new MemoryStore();
  const hub = new Hub(new Rooms(), store, {
    commandBudget,
    maxPeers: 100,
    maxQueue: 100,
  });
  const peers = Array.from(
    { length: capacity },
    (_, i) => new FakePeer(`s${i}`),
  );
  for (const peer of peers) hub.open(peer);
  const created = await peers[0]!.ask(hub, {
    type: "create",
    name: "Host",
    capacity,
  });
  if (!created.ok || !created.room) throw Error("create failed");
  const code = created.room.code;
  for (const peer of peers.slice(1)) {
    const joined = await peer.ask(hub, { type: "join", name: "Guest", code });
    expect(joined.ok).toBe(true);
  }
  return { hub, store, peers, code, token: created.token! };
}

test("plays a complete two-player match to a shared authoritative winner", async () => {
  const { hub, peers, code } = await lobby(2, 1e6);
  expect((await peers[1]!.ask(hub, { type: "start" })).ok).toBe(false);
  const started = await peers[0]!.ask(hub, { type: "start" });
  expect(started.ok).toBe(true);
  const ids = new Map<string, FakePeer>();
  const room = hub.rooms.rooms.get(code)!;
  room.members.forEach((m, i) => ids.set(m.id, peers[i]!));
  for (let step = 0; step < 5000 && room.state!.phase !== "finished"; step++) {
    const state = room.state!;
    const actor = ids.get(currentPlayer(state).id)!;
    const reply =
      state.phase === "roll"
        ? await actor.ask(hub, {
            type: "roll",
            nonce: nonce(),
            expectedVersion: state.version,
          })
        : await actor.ask(hub, {
            type: "move",
            pawn: legalMoves(state)[0]!,
            expectedVersion: state.version,
          });
    expect(reply).toMatchObject({ ok: true });
  }
  expect(room.state!.phase).toBe("finished");
  const winner = room.state!.winner;
  expect(winner).toBeTruthy();
  // Both clients received the same final snapshot.
  expect(peers[0]!.lastRoom()!.state!.winner).toBe(winner);
  expect(peers[1]!.lastRoom()!.state!.winner).toBe(winner);
});

test("rate limits command floods per socket", async () => {
  const { hub, peers } = await lobby(2, 5);
  const replies = [];
  for (let i = 0; i < 6; i++)
    replies.push(await peers[1]!.ask(hub, { type: "start" }));
  expect(replies.at(-1)).toEqual({ ok: false, error: "RATE_LIMITED" });
});

test("refuses ranked play, bad input and spoofed turns", async () => {
  const { hub, peers } = await lobby(2);
  const extra = new FakePeer("x");
  hub.open(extra);
  expect(
    await extra.ask(hub, {
      type: "create",
      name: "R",
      capacity: 2,
      ranked: true,
    }),
  ).toEqual({ ok: false, error: "RANKED_UNAVAILABLE" });
  expect(
    await extra.ask(hub, { type: "create", name: "", capacity: 9 }),
  ).toEqual({ ok: false, error: "INVALID_COMMAND" });
  await peers[0]!.ask(hub, { type: "start" });
  const roll = await peers[1]!.ask(hub, {
    type: "roll",
    nonce: nonce(),
    expectedVersion: 0,
  });
  expect(roll.ok).toBe(false);
});

test("a dropped player resumes the same seat with the invite token", async () => {
  const { hub, peers, code, token } = await lobby(2);
  await peers[0]!.ask(hub, { type: "start" });
  await hub.closed("s0");
  expect(peers[1]!.lastRoom()!.players[0]!.connected).toBe(false);
  const back = new FakePeer("s0b");
  hub.open(back);
  const resumed = await back.ask(hub, { type: "resume", code, token });
  expect(resumed).toMatchObject({ ok: true });
  expect(peers[1]!.lastRoom()!.players[0]!.connected).toBe(true);
});

test("quick match pairs two queued players, survives hibernation of the queue", async () => {
  const store = new MemoryStore();
  const hub = new Hub(new Rooms(), store);
  const a = new FakePeer("a");
  hub.open(a);
  expect(await a.ask(hub, { type: "queue", name: "A" })).toMatchObject({
    queued: true,
  });
  expect(a.memory).toEqual({ sid: "a", queued: { name: "A" } });
  // The Durable Object hibernates; a fresh hub restores the queue from socket memory.
  const woke = new Hub(new Rooms(), store);
  await woke.restore([{ peer: a, memory: a.memory }]);
  const b = new FakePeer("b");
  woke.open(b);
  const matched = await b.ask(woke, { type: "queue", name: "B" });
  expect(matched.ok && matched.room?.state).toBeTruthy();
  expect(a.frames.some((f) => f.t === "event" && f.name === "v1:matched")).toBe(
    true,
  );
});

test("quick match accepts flagged names and cancelling leaves the queue", async () => {
  const hub = new Hub(new Rooms(), new MemoryStore());
  const a = new FakePeer("a");
  const b = new FakePeer("b");
  hub.open(a);
  hub.open(b);
  expect(await a.ask(hub, { type: "queue", name: "🇮🇷 Sara_7" })).toMatchObject({
    ok: true,
    queued: true,
  });
  expect(await a.ask(hub, { type: "cancelQueue" })).toMatchObject({
    queued: false,
  });
  // Nobody is waiting any more, so the next player queues instead of matching.
  expect(await b.ask(hub, { type: "queue", name: "🇹🇷 Emre" })).toMatchObject({
    queued: true,
  });
  const matched = await a.ask(hub, { type: "queue", name: "🇮🇷 Sara_7" });
  expect(matched.ok && matched.room?.players.map((p) => p.name)).toEqual([
    "🇹🇷 Emre",
    "🇮🇷 Sara_7",
  ]);
});

test("a restart keeps the match and marks seats without sockets disconnected", async () => {
  const { store, peers, code, hub } = await lobby(2);
  await peers[0]!.ask(hub, { type: "start" });
  const version = hub.rooms.rooms.get(code)!.state!.version;
  const restarted = new Hub(new Rooms(), store);
  await restarted.restore([{ peer: peers[1]!, memory: { sid: "s1" } }]);
  const room = restarted.rooms.rooms.get(code)!;
  expect(room.state!.version).toBeGreaterThanOrEqual(version);
  expect(room.members[0]!.socketId).toBeNull();
  expect(room.members[1]!.socketId).toBe("s1");
  expect(store.data.get(code)!.members[0]!.socketId).toBeNull();
});

test("turn deadlines drive the alarm and time out idle turns", async () => {
  let now = 1000;
  const store = new MemoryStore();
  const hub = new Hub(new Rooms(() => now, 30000, 45000), store);
  const a = new FakePeer("a");
  const b = new FakePeer("b");
  hub.open(a);
  hub.open(b);
  const created = await a.ask(hub, { type: "create", name: "A", capacity: 2 });
  if (!created.ok || !created.room) throw Error();
  await b.ask(hub, { type: "join", name: "B", code: created.room.code });
  await a.ask(hub, { type: "start" });
  expect(hub.nextWake(now)).toBe(31000);
  const turn = hub.rooms.rooms.get(created.room.code)!.state!.turn;
  now = 31001;
  await hub.tick();
  expect(hub.rooms.rooms.get(created.room.code)!.state!.turn).not.toBe(turn);
});
