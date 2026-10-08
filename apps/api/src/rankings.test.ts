import { createHash, randomBytes, randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { beforeAll, afterAll, describe, test, expect } from "vitest";
import {
  EVENTS,
  type Intent,
  type Reply,
  type PublicRoom,
} from "@mench/game-protocol";
import { verifyReplay, legalMoves } from "@mench/game-engine";
import { verifyProof } from "@mench/fair-dice";
import { createApp } from "./app";
import { Database } from "./database";
import { Rooms } from "./rooms";
const url = process.env.TEST_DATABASE_URL;
function roomOf(reply: Reply): PublicRoom {
  if (!reply.ok || !reply.room) throw Error(JSON.stringify(reply));
  return reply.room;
}
describe.skipIf(!url)("PostgreSQL ranked settlement", () => {
  const db = new Database(url!);
  const rooms = new Rooms();
  const app = createApp(rooms, 10000, db);
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const tokens = ids.map(() => randomBytes(32).toString("hex"));
  const sockets: Socket[] = [];
  const codes: string[] = [];
  const games: string[] = [];
  const command = (index: number, payload: Intent) =>
    sockets[index]!.timeout(5000).emitWithAck(EVENTS.COMMAND, {
      version: 1,
      requestId: randomUUID(),
      payload,
    }) as Promise<Reply>;
  beforeAll(async () => {
    await db.migrate();
    for (let i = 0; i < ids.length; i++) {
      await db.pool.query(
        "INSERT INTO users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)",
        [ids[i], `${ids[i]}@example.com`, `Rank${i}`, "unusable-test-hash"],
      );
      await db.pool.query(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
        [createHash("sha256").update(tokens[i]!).digest("hex"), ids[i]],
      );
    }
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw Error();
    for (let i = 0; i < 3; i++) {
      const socket = io(`http://127.0.0.1:${address.port}`, {
        transports: ["websocket"],
        forceNew: true,
        reconnection: false,
        ...(i < 2
          ? { extraHeaders: { authorization: `Bearer ${tokens[i]}` } }
          : {}),
      });
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
      });
      sockets.push(socket);
    }
  });
  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    await app.close();
    const cleanup = new Database(url!);
    for (const code of codes)
      await cleanup.pool.query("DELETE FROM room_snapshots WHERE code=$1", [
        code,
      ]);
    await cleanup.pool.query(
      "DELETE FROM game_results WHERE game_id=ANY($1::uuid[])",
      [games],
    );
    await cleanup.pool.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [
      ids,
    ]);
    await cleanup.close();
  });
  test("ranked queue separates guests/casual; a full proven match settles once despite repeated final snapshots", async () => {
    expect(
      await command(2, { type: "queue", name: "Guest", ranked: true }),
    ).toEqual({ ok: false, error: "RANKED_UNAVAILABLE" });
    expect(await command(2, { type: "queue", name: "Guest" })).toEqual({
      ok: true,
      room: null,
      queued: true,
    });
    expect(
      await command(0, { type: "queue", name: "Rank0", ranked: true }),
    ).toEqual({ ok: true, room: null, queued: true });
    let room = roomOf(
      await command(1, { type: "queue", name: "Rank1", ranked: true }),
    );
    expect(room.ranked).toBe(true);
    codes.push(room.code);
    const matchId = rooms.rooms.get(room.code)!.matchId;
    games.push(matchId);
    for (let n = 0; n < 10000 && room.state!.phase !== "finished"; n++) {
      const owner = room.players.findIndex(
        (p) => p.id === room.state!.players[room.state!.turn]!.id,
      );
      if (room.state!.phase === "roll") {
        const observed = room.commitment!.hash;
        const nonce = randomBytes(32).toString("hex");
        room = roomOf(
          await command(owner, {
            type: "roll",
            nonce,
            expectedVersion: room.state!.version,
          }),
        );
        expect(verifyProof(room.proofs.at(-1)!, observed, nonce)).toBe(true);
      } else {
        room = roomOf(
          await command(owner, {
            type: "move",
            pawn: legalMoves(room.state!)[0]!,
            expectedVersion: room.state!.version,
          }),
        );
      }
    }
    expect(room.state!.phase).toBe("finished");
    expect(room.proofs.length).toBeLessThanOrEqual(16);
    const fullProofs = rooms.rooms.get(room.code)!.proofs;
    expect(fullProofs.length).toBeGreaterThan(16);
    const recovered = (await db.loadRooms()).find((r) => r.code === room.code)!;
    expect(recovered.proofs).toEqual(fullProofs);
    const history = await app.inject({
      url: `/api/history/${matchId}`,
      headers: { authorization: `Bearer ${tokens[0]}` },
    });
    expect(history.statusCode).toBe(200);
    const transcript = history.json();
    expect(
      verifyReplay(
        transcript.initialState,
        transcript.actions,
        transcript.finalState,
      ),
    ).toBe(true);
    expect(transcript.proofs).toEqual(fullProofs);
    expect(JSON.stringify(transcript)).not.toContain(ids[0]!);
    expect(JSON.stringify(transcript)).not.toContain("tokenHash");
    expect(
      (await app.inject({ url: `/api/history/${matchId}` })).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          url: `/api/history/${randomUUID()}`,
          headers: { authorization: `Bearer ${tokens[0]}` },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          url: `/api/history/${matchId}`,
          headers: { authorization: `Bearer ${tokens[2]}` },
        })
      ).statusCode,
    ).toBe(404);
    const listing = await app.inject({
      url: "/api/history",
      headers: { authorization: `Bearer ${tokens[0]}` },
    });
    expect(
      listing.json().games.some((g: { id: string }) => g.id === matchId),
    ).toBe(true);
    const snapshot = rooms.exportRoom(rooms.rooms.get(room.code)!);
    await Promise.all([
      db.saveRoom(room.code, snapshot, { kind: "duplicate-final", data: {} }),
      db.saveRoom(room.code, snapshot, { kind: "duplicate-final", data: {} }),
    ]);
    const ratings = await db.pool.query<{
      user_id: string;
      rating: number;
      games: number;
      wins: number;
    }>("SELECT * FROM ratings WHERE user_id=ANY($1::uuid[])", [ids]);
    expect(ratings.rows.map((r) => r.rating).sort((a, b) => a - b)).toEqual([
      984, 1016,
    ]);
    expect(ratings.rows.every((r) => r.games === 1)).toBe(true);
    expect(ratings.rows.reduce((sum, r) => sum + r.wins, 0)).toBe(1);
    const result = await db.pool.query(
      "SELECT rated FROM game_results WHERE game_id=$1",
      [matchId],
    );
    expect(result.rows).toEqual([{ rated: true }]);
    const self = await app.inject({
      url: "/api/rankings/me",
      headers: { authorization: `Bearer ${tokens[0]}` },
    });
    expect(self.statusCode).toBe(200);
    expect(self.json().games).toBe(1);
    expect((await app.inject({ url: "/api/rankings/me" })).statusCode).toBe(
      401,
    );
    const board = (await app.inject({ url: "/api/rankings" })).json();
    expect(board.players.some((p: { id: string }) => p.id === ids[0])).toBe(
      true,
    );
    expect(JSON.stringify(board)).not.toContain("@example.com");
    await command(2, { type: "cancelQueue" });
    await command(0, { type: "leave" });
    await command(1, { type: "leave" });
  }, 60000);
  test("casual completion records history without granting ranked points", async () => {
    let room = roomOf(
      await command(0, { type: "create", name: "Rank0", capacity: 2 }),
    );
    codes.push(room.code);
    games.push(rooms.rooms.get(room.code)!.matchId);
    await command(1, { type: "join", name: "Rank1", code: room.code });
    room = roomOf(await command(0, { type: "start" }));
    for (let n = 0; n < 10000 && room.state!.phase !== "finished"; n++) {
      const owner = room.players.findIndex(
        (p) => p.id === room.state!.players[room.state!.turn]!.id,
      );
      room = roomOf(
        await command(
          owner,
          room.state!.phase === "roll"
            ? {
                type: "roll",
                nonce: randomBytes(32).toString("hex"),
                expectedVersion: room.state!.version,
              }
            : {
                type: "move",
                pawn: legalMoves(room.state!)[0]!,
                expectedVersion: room.state!.version,
              },
        ),
      );
    }
    expect(room.state!.phase).toBe("finished");
    const ratings = await db.pool.query(
      "SELECT games FROM ratings WHERE user_id=ANY($1::uuid[])",
      [ids],
    );
    expect(ratings.rows).toEqual([{ games: 1 }, { games: 1 }]);
    const result = await db.pool.query(
      "SELECT rated FROM game_results WHERE game_id=$1",
      [games.at(-1)],
    );
    expect(result.rows).toEqual([{ rated: false }]);
  }, 60000);
});
