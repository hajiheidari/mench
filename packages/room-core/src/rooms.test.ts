import { expect, test } from "vitest";
import { Rooms } from "./rooms";
import { verifyProof } from "@mench/fair-dice";
function setup(capacity = 2) {
  let now = 100;
  const service = new Rooms(() => now, 30000, 45000);
  const a = service.create("a", "Alpha", capacity);
  if (!a.ok || !a.room) throw Error();
  for (let i = 1; i < capacity; i++)
    service.join(String(i), "Beta", a.room.code);
  service.start("a");
  return {
    service,
    code: a.room.code,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
test("authority, hidden seeds, stale commands and commitment verification", () => {
  const { service, code } = setup();
  const room = service.rooms.get(code)!;
  const snapshot = service.public(room);
  expect(JSON.stringify(snapshot)).not.toContain("tokenHash");
  expect(snapshot.commitment).not.toHaveProperty("seed");
  expect(() => service.roll("1", "aa".repeat(32), 0)).toThrow("NOT_YOUR_TURN");
  const result = service.roll("a", "aa".repeat(32), 0);
  const proof = result.proofs[0]!;
  expect(verifyProof(proof, snapshot.commitment!.hash, "aa".repeat(32))).toBe(
    true,
  );
  expect(() => service.move("a", 0, 0)).toThrow("STALE_VERSION");
});
test("reconnect after 2,10,30 seconds restores state and replaces old session", () => {
  for (const ms of [2000, 10000, 30000]) {
    const { service, code, advance } = setup();
    const old = service.rooms.get(code)!;
    const member = service.session("a").member;
    const before = structuredClone(old.state);
    service.disconnect("a");
    advance(ms);
    expect(service.tick()).toHaveLength(0);
    expect(old.state!.players[0]!.pawns).toEqual(before!.players[0]!.pawns);
    expect(member.disconnectedAt).not.toBeNull();
  }
});
test("resume capability verifies token and one simultaneous session", () => {
  const service = new Rooms();
  const reply = service.create("a", "Alpha", 2);
  if (!reply.ok || !reply.token || !reply.room) throw Error();
  expect(() => service.resume("b", reply.room!.code, "ff".repeat(32))).toThrow(
    "INVALID_SESSION",
  );
  const resumed = service.resume("b", reply.room.code, reply.token);
  expect(resumed.replaced).toBe("a");
  expect(service.sessions.has("a")).toBe(false);
  expect(service.disconnect("a")).toBeNull();
  expect(
    service.public(service.rooms.get(reply.room.code)!).players[0]!.connected,
  ).toBe(true);
});
test("timeout after grace advances turn without moving pawns", () => {
  const { service, code, advance } = setup();
  service.disconnect("a");
  advance(44999);
  expect(service.tick()).toHaveLength(0);
  advance(1);
  const result = service.tick()[0]!;
  expect(result.state!.turn).toBe(1);
  expect(result.state!.players[0]!.pawns).toEqual([-1, -1, -1, -1]);
  expect(service.rooms.get(code)!.pending!.context.playerId).toBe(
    result.players[1]!.id,
  );
});
test("host transfer and full-room checks", () => {
  const service = new Rooms();
  const a = service.create("a", "Alpha", 2);
  if (!a.ok || !a.room) throw Error();
  service.join("b", "Beta", a.room.code);
  expect(() => service.join("c", "Gamma", a.room!.code)).toThrow("ROOM_FULL");
  expect(() => service.start("b")).toThrow("HOST_ONLY");
  service.leave("a");
  expect(service.session("b").room.hostId).toBe(service.session("b").member.id);
});
test("wonBy names only the winning seat of a finished match", () => {
  const service = new Rooms();
  const host = service.create("a", "Alpha", 2);
  if (!host.ok || !host.token || !host.room) throw Error();
  const guest = service.join("b", "Beta", host.room.code);
  if (!guest.ok || !guest.token) throw Error();
  service.start("a");
  const room = service.rooms.get(host.room.code)!;
  expect(service.wonBy(room.code, host.token)).toBeNull();
  room.state = { ...room.state!, phase: "finished", winner: guest.playerId! };
  expect(service.wonBy(room.code, host.token)).toBeNull();
  expect(service.wonBy(room.code, guest.token)).toEqual({
    matchId: room.matchId,
    playerId: guest.playerId,
  });
  expect(service.wonBy("NOPE", guest.token)).toBeNull();
});
