import { randomBytes, randomUUID, createHash } from "node:crypto";
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { io, type Socket } from "socket.io-client";
import {
  EVENTS,
  type Intent,
  type Reply,
  type PublicRoom,
  type PublicTournament,
} from "@mench/game-protocol";
import { legalMoves } from "@mench/game-engine";
import { verifyProof } from "@mench/fair-dice";
import { Database } from "./database";
import { Rooms } from "./rooms";
import { createApp } from "./app";
const url = process.env.TEST_DATABASE_URL;
function roomOf(reply: Reply): PublicRoom {
  if (!reply.ok || !reply.room) throw Error(JSON.stringify(reply));
  return reply.room;
}
describe.skipIf(!url)("PostgreSQL authoritative tournament", () => {
  const db = new Database(url!);
  const rooms = new Rooms();
  const app = createApp(rooms, 10000, db);
  const ids: string[] = Array.from({ length: 5 }, () => randomUUID());
  const tokens = ids.map(() => randomBytes(32).toString("hex"));
  const sockets: Socket[] = [];
  const codes: string[] = [];
  const gameIds: string[] = [];
  const tournamentIds: string[] = [];
  let current: PublicTournament;
  const headers = (index: number) => ({
    authorization: `Bearer ${tokens[index]}`,
  });
  const mutate = (index: number, payload: object) =>
    app.inject({
      method: "POST",
      url: `/api/tournaments/${current.id}`,
      headers: headers(index),
      payload,
    });
  const read = async () => {
    const reply = await app.inject({
      url: `/api/tournaments/${current.id}`,
      headers: headers(0),
    });
    expect(reply.statusCode).toBe(200);
    current = reply.json<PublicTournament>();
    return current;
  };
  const command = (index: number, payload: Intent) =>
    sockets[index]!.timeout(5000).emitWithAck(EVENTS.COMMAND, {
      version: 1,
      requestId: randomUUID(),
      payload,
    }) as Promise<Reply>;
  beforeAll(async () => {
    await db.migrate();
    for (let i = 0; i < 5; i++) {
      await db.pool.query(
        "INSERT INTO users(id,email,display_name,password_hash) VALUES($1,$2,$3,'unusable-test-hash')",
        [ids[i], `${ids[i]}@example.com`, `Tournament${i}`],
      );
      await db.pool.query(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
        [createHash("sha256").update(tokens[i]!).digest("hex"), ids[i]],
      );
    }
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw Error();
    for (let i = 0; i < 4; i++) {
      const socket = io(`http://127.0.0.1:${address.port}`, {
        transports: ["websocket"],
        extraHeaders: headers(i),
        forceNew: true,
        reconnection: false,
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
    await cleanup.pool.query(
      "DELETE FROM tournaments WHERE id=ANY($1::uuid[])",
      [tournamentIds],
    );
    for (const code of codes)
      await cleanup.pool.query("DELETE FROM room_snapshots WHERE code=$1", [
        code,
      ]);
    await cleanup.pool.query(
      "DELETE FROM game_results WHERE game_id=ANY($1::uuid[])",
      [gameIds],
    );
    await cleanup.pool.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [
      ids,
    ]);
    await cleanup.close();
  });
  test("host permissions, concurrent capacity, membership privacy and forged results", async () => {
    expect((await app.inject({ url: "/api/tournaments" })).statusCode).toBe(
      401,
    );
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/tournaments",
          headers: headers(0),
          payload: { capacity: 3 },
        })
      ).statusCode,
    ).toBe(400);
    const created = await app.inject({
      method: "POST",
      url: "/api/tournaments",
      headers: headers(0),
      payload: { capacity: 4 },
    });
    expect(created.statusCode).toBe(201);
    current = created.json<PublicTournament>();
    tournamentIds.push(current.id);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/tournaments",
          headers: headers(0),
          payload: { capacity: 8 },
        })
      ).statusCode,
    ).toBe(409);
    expect((await mutate(1, { type: "start" })).statusCode).toBe(403);
    const joined = await Promise.all(
      [1, 2, 3].map((index) => mutate(index, { type: "join" })),
    );
    expect(joined.every((reply) => reply.statusCode === 200)).toBe(true);
    await read();
    expect(current.players).toHaveLength(4);
    expect((await mutate(4, { type: "join" })).statusCode).toBe(409);
    expect(
      (await mutate(0, { type: "complete", winner: ids[0] })).statusCode,
    ).toBe(400);
    const started = await mutate(0, { type: "start" });
    expect(started.statusCode).toBe(200);
    current = started.json<PublicTournament>();
    expect(current.rounds.flat()).toHaveLength(3);
    expect(
      (
        await app.inject({
          url: `/api/tournaments/${current.id}`,
          headers: headers(4),
        })
      ).statusCode,
    ).toBe(403);
    expect(JSON.stringify(current)).not.toContain("@example.com");
  });
  test("three complete fair matches automatically advance both semifinals and the final exactly once", async () => {
    async function play(matchId: string) {
      const match = current.rounds.flat().find((m) => m.id === matchId)!;
      const a = ids.indexOf(match.players[0]!);
      const b = ids.indexOf(match.players[1]!);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeGreaterThanOrEqual(0);
      let room = roomOf(
        await command(a, {
          type: "create",
          name: `Tournament${a}`,
          capacity: 2,
        }),
      );
      codes.push(room.code);
      gameIds.push(rooms.rooms.get(room.code)!.matchId);
      // A room without both assigned authenticated opponents cannot be linked.
      expect(
        (await mutate(a, { type: "link", matchId, code: room.code }))
          .statusCode,
      ).toBe(409);
      await command(b, {
        type: "join",
        name: `Tournament${b}`,
        code: room.code,
      });
      expect(
        (await mutate(4, { type: "link", matchId, code: room.code }))
          .statusCode,
      ).toBe(403);
      expect(
        (
          await mutate(a, {
            type: "link",
            matchId,
            code: room.code,
            winner: ids[a],
          })
        ).statusCode,
      ).toBe(400);
      const linked = await mutate(a, {
        type: "link",
        matchId,
        code: room.code,
      });
      expect(linked.statusCode).toBe(200);
      current = linked.json<PublicTournament>();
      room = roomOf(await command(a, { type: "start" }));
      for (let n = 0; n < 10000 && room.state!.phase !== "finished"; n++) {
        const seat = room.players.findIndex(
          (p) => p.id === room.state!.players[room.state!.turn]!.id,
        );
        const owner = seat === 0 ? a : b;
        if (room.state!.phase === "roll") {
          const nonce = randomBytes(32).toString("hex");
          const observed = room.commitment!.hash;
          room = roomOf(
            await command(owner, {
              type: "roll",
              nonce,
              expectedVersion: room.state!.version,
            }),
          );
          expect(verifyProof(room.proofs.at(-1)!, observed, nonce)).toBe(true);
        } else
          room = roomOf(
            await command(owner, {
              type: "move",
              pawn: legalMoves(room.state!)[0]!,
              expectedVersion: room.state!.version,
            }),
          );
      }
      expect(room.state!.phase).toBe("finished");
      const snapshot = rooms.exportRoom(rooms.rooms.get(room.code)!);
      await db.saveRoom(room.code, snapshot, {
        kind: "duplicate-final",
        data: {},
      });
      await read();
      const winner = current.rounds
        .flat()
        .find((m) => m.id === matchId)!.winner;
      expect(match.players).toContain(winner);
      await command(a, { type: "leave" });
      await command(b, { type: "leave" });
      return winner;
    }
    const first = await play("r0m0");
    const second = await play("r0m1");
    expect(current.rounds[1]![0]!.players).toEqual([first, second]);
    const champion = await play("r1m0");
    expect(current.phase).toBe("finished");
    expect(current.winner).toBe(champion);
    const saved = await db.pool.query<{ snapshot: PublicTournament }>(
      "SELECT snapshot FROM tournaments WHERE id=$1",
      [current.id],
    );
    expect(saved.rows[0]!.snapshot.winner).toBe(champion);
    const ratings = await db.pool.query(
      "SELECT * FROM ratings WHERE user_id=ANY($1::uuid[])",
      [ids],
    );
    expect(ratings.rows).toEqual([]);
  }, 60000);
  test("finished host can create another bracket; only lobby host can cancel", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/tournaments",
      headers: headers(0),
      payload: { capacity: 8 },
    });
    expect(created.statusCode).toBe(201);
    current = created.json<PublicTournament>();
    tournamentIds.push(current.id);
    expect((await mutate(1, { type: "cancel" })).statusCode).toBe(403);
    const cancelled = await mutate(0, { type: "cancel" });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().phase).toBe("cancelled");
    const list = await app.inject({
      url: "/api/tournaments",
      headers: headers(0),
    });
    expect(list.json().tournaments).toHaveLength(2);
  });
});
