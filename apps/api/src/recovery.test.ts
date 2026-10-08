import { verifyReplay } from "@mench/game-engine";
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { describe, expect, test, vi } from "vitest";
import { createApp } from "./app";
import { Database } from "./database";
import { Rooms } from "./rooms";
import {
  EVENTS,
  type Intent,
  type Reply,
  type PublicRoom,
} from "@mench/game-protocol";
import { verifyProof } from "@mench/fair-dice";
const url = process.env.TEST_DATABASE_URL;
async function connect(endpoint: string) {
  const socket = io(endpoint, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return socket;
}
async function command(socket: Socket, payload: Intent): Promise<Reply> {
  return socket.timeout(5000).emitWithAck(EVENTS.COMMAND, {
    version: 1,
    requestId: randomUUID(),
    payload,
  }) as Promise<Reply>;
}
function roomOf(reply: Reply): PublicRoom {
  if (!reply.ok || !reply.room) throw Error(JSON.stringify(reply));
  return reply.room;
}
async function listen(app: ReturnType<typeof createApp>) {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (!address || typeof address === "string") throw Error();
  return `http://127.0.0.1:${address.port}`;
}
describe.skipIf(!url)("PostgreSQL match recovery", () => {
  test("idle database connection errors fail readiness closed without dumping private pool details", async () => {
    const db = new Database(url!);
    await db.migrate();
    const app = createApp(undefined, 100, db);
    const endpoint = await listen(app);
    const socket = await connect(endpoint);
    try {
      db.pool.emit("error", new Error("injected idle connection failure"));
      expect((await app.inject({ url: "/health" })).statusCode).toBe(503);
      expect((await app.inject({ url: "/health/live" })).statusCode).toBe(200);
      expect(
        await command(socket, { type: "create", name: "Alpha", capacity: 2 }),
      ).toEqual({ ok: false, error: "PERSISTENCE_UNAVAILABLE" });
    } finally {
      socket.disconnect();
      await app.close();
    }
  });
  test("failed persistence never acknowledges or broadcasts an uncommitted room", async () => {
    const db = new Database(url!);
    await db.migrate();
    const rooms = new Rooms();
    const app = createApp(rooms, 100, db);
    const endpoint = await listen(app);
    const socket = await connect(endpoint);
    const baseline = rooms.exportAll();
    const snapshots: unknown[] = [];
    socket.on(EVENTS.SNAPSHOT, (snapshot: unknown) => snapshots.push(snapshot));
    const save = vi
      .spyOn(db, "saveRoom")
      .mockRejectedValue(new Error("injected database outage"));
    try {
      expect(
        await command(socket, { type: "create", name: "Alpha", capacity: 2 }),
      ).toEqual({ ok: false, error: "PERSISTENCE_UNAVAILABLE" });
      expect(rooms.exportAll()).toEqual(baseline);
      expect(snapshots).toHaveLength(0);
      expect(
        (await app.inject({ method: "GET", url: "/health" })).statusCode,
      ).toBe(503);
      expect((await app.inject({ url: "/health/live" })).statusCode).toBe(200);
      save.mockRestore();
      expect(
        await command(socket, { type: "create", name: "Alpha", capacity: 2 }),
      ).toEqual({ ok: false, error: "PERSISTENCE_UNAVAILABLE" });
      expect(rooms.exportAll()).toEqual(baseline);
    } finally {
      save.mockRestore();
      socket.disconnect();
      await app.close();
    }
  });
  test("restart preserves pawn progress, identities, revealed proof and unrevealed commitment", async () => {
    const db = new Database(url!);
    await db.migrate();
    const rooms = new Rooms();
    const app = createApp(rooms, 100, db);
    const endpoint = await listen(app);
    const first = await connect(endpoint);
    const peer = await connect(endpoint);
    let code = "";
    let app2: ReturnType<typeof createApp> | undefined;
    try {
      const created = await command(first, {
        type: "create",
        name: "Alpha",
        capacity: 2,
      });
      if (!created.ok || !created.room || !created.token || !created.playerId)
        throw Error();
      code = created.room.code;
      await command(peer, { type: "join", name: "Beta", code });
      let snapshot = roomOf(await command(first, { type: "start" }));
      const observed = snapshot.commitment!.hash;
      const nonce = "ab".repeat(32);
      snapshot = roomOf(
        await command(first, {
          type: "roll",
          nonce,
          expectedVersion: snapshot.state!.version,
        }),
      );
      const before = structuredClone(snapshot);
      const seedBefore = rooms.rooms.get(code)!.pending?.seed;
      await app.close();
      const secondDb = new Database(url!);
      await secondDb.migrate();
      const restoredRooms = new Rooms();
      app2 = createApp(restoredRooms, 100, secondDb);
      const endpoint2 = await listen(app2);
      const reconnect = await connect(endpoint2);
      try {
        const reply = await command(reconnect, {
          type: "resume",
          code,
          token: created.token,
        });
        const restored = roomOf(reply);
        expect(reply.ok && reply.playerId).toBe(created.playerId);
        expect(restored.state!.players.map((p) => p.pawns)).toEqual(
          before.state!.players.map((p) => p.pawns),
        );
        expect(restored.proofs).toEqual(before.proofs);
        expect(verifyProof(restored.proofs[0]!, observed, nonce)).toBe(true);
        expect(restored.commitment?.hash).toBe(before.commitment?.hash);
        expect(restoredRooms.rooms.get(code)!.pending?.seed).toBe(seedBefore);
        expect(restored.state!.version).toBeGreaterThan(before.state!.version);
        expect(restored.players[0]!.connected).toBe(true);
        const rows = await secondDb.pool.query<{ snapshot: unknown }>(
          "SELECT snapshot FROM room_snapshots WHERE code=$1",
          [code],
        );
        expect(JSON.stringify(rows.rows)).not.toContain(created.token);
        expect(JSON.stringify(rows.rows)).not.toContain("replies");
        const events = await secondDb.pool.query(
          "SELECT kind FROM room_events WHERE room_code=$1 AND kind='roll'",
          [code],
        );
        expect(events.rows).toHaveLength(1);
        const recorded = await secondDb.pool.query(
          "SELECT data FROM room_events WHERE room_code=$1 ORDER BY id",
          [code],
        );
        const initial = recorded.rows.find((r) => r.data.initialState).data
          .initialState;
        const actions = recorded.rows.flatMap(
          (r) => r.data.actions ?? (r.data.action ? [r.data.action] : []),
        );
        expect(verifyReplay(initial, actions, restored.state!)).toBe(true);
      } finally {
        reconnect.disconnect();
      }
    } finally {
      first.disconnect();
      peer.disconnect();
      await app.close();
      if (app2) await app2.close();
      const cleanup = new Database(url!);
      if (code)
        await cleanup.pool.query("DELETE FROM room_snapshots WHERE code=$1", [
          code,
        ]);
      await cleanup.close();
    }
  }, 15000);
});
