import { randomUUID, randomBytes, createHash } from "node:crypto";
import { beforeAll, afterAll, describe, expect, test } from "vitest";
import {
  applyAction,
  createGame,
  currentPlayer,
  legalMoves,
} from "@mench/game-engine";
import type { EconomySnapshot } from "@mench/game-protocol";
import { Database } from "./database";
import { createApp } from "./app";
import { Rooms, type RoomSnapshot } from "./rooms";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL coin ledger", () => {
  const db = new Database(url!);
  const app = createApp(undefined, 100, db);
  const id = randomUUID();
  const token = randomBytes(32).toString("hex");
  const headers = { authorization: `Bearer ${token}` };
  let final: RoomSnapshot;
  let walletId = "";
  const gameIds: string[] = [];
  const read = async () =>
    (
      await app.inject({ url: "/api/economy", headers })
    ).json<EconomySnapshot>();
  const buy = (sku: string, requestId = randomUUID(), extra: object = {}) =>
    app.inject({
      method: "POST",
      url: "/api/economy/purchase",
      headers,
      payload: { sku, requestId, ...extra },
    });
  beforeAll(async () => {
    await db.migrate();
    await db.pool.query(
      "INSERT INTO users(id,email,display_name,password_hash) VALUES($1,$2,'LedgerTest','unusable-test-hash')",
      [id, `${id}@example.com`],
    );
    await db.pool.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
      [createHash("sha256").update(token).digest("hex"), id],
    );
    await app.ready();
    const rooms = new Rooms();
    rooms.identities.set("owner", id);
    const created = rooms.create("owner", "LedgerTest", 2);
    if (!created.ok || !created.room) throw Error();
    const room = rooms.rooms.get(created.room.code)!;
    rooms.join("peer", "Guest", room.code);
    let state = createGame(room.members.map((m) => m.id));
    for (let i = 0; i < 10000 && state.phase !== "finished"; i++) {
      const player = currentPlayer(state);
      const value =
        state.turn === 1
          ? 1
          : state.sixes >= 2 || player.pawns.some((p) => p >= 52 && p < 57)
            ? 1
            : 6;
      state = applyAction(
        state,
        state.phase === "roll"
          ? { type: "roll", playerId: player.id, value }
          : { type: "move", playerId: player.id, pawn: legalMoves(state)[0]! },
      );
    }
    expect(state.phase).toBe("finished");
    expect(state.winner).toBe(room.members[0]!.id);
    room.state = state;
    final = rooms.exportRoom(room);
    gameIds.push(final.matchId);
  });
  afterAll(async () => {
    await app.close();
    const cleanup = new Database(url!);
    await cleanup.pool.query("DELETE FROM room_snapshots WHERE code=$1", [
      final.code,
    ]);
    await cleanup.pool.query(
      "DELETE FROM game_results WHERE game_id=ANY($1::uuid[])",
      [gameIds],
    );
    await cleanup.pool.query("DELETE FROM users WHERE id=$1", [id]);
    if (walletId) {
      const wallet = await cleanup.pool.query(
        "SELECT user_id FROM wallets WHERE id=$1",
        [walletId],
      );
      expect(wallet.rows).toEqual([{ user_id: null }]);
    }
    // Append-only receipts remain anonymous; test fixtures do not disable immutable-ledger guards.
    await cleanup.close();
  });
  test("only completed server results grant coins; duplicate settlement is idempotent and receipt immutable", async () => {
    expect((await app.inject({ url: "/api/economy" })).statusCode).toBe(401);
    expect((await read()).balance).toBe("0");
    expect((await buy("aurora")).statusCode).toBe(409);
    await Promise.all([
      db.saveRoom(final.code, final, { kind: "fixture-final", data: {} }),
      db.saveRoom(final.code, final, { kind: "duplicate-final", data: {} }),
    ]);
    const data = await read();
    expect(data.balance).toBe("100");
    expect(data.ledger).toHaveLength(1);
    expect(data.ledger[0]).toMatchObject({ kind: "reward", delta: "100" });
    walletId = (
      await db.pool.query<{ id: string }>(
        "SELECT id FROM wallets WHERE user_id=$1",
        [id],
      )
    ).rows[0]!.id;
    await expect(
      db.pool.query("UPDATE wallet_ledger SET delta=999 WHERE wallet_id=$1", [
        walletId,
      ]),
    ).rejects.toThrow("LEDGER_IMMUTABLE");
    await expect(
      db.pool.query("DELETE FROM wallet_ledger WHERE wallet_id=$1", [walletId]),
    ).rejects.toThrow("LEDGER_IMMUTABLE");
  });
  test("simultaneous purchases cannot overspend; retries and mismatched IDs cannot charge twice", async () => {
    expect((await buy("aurora", randomUUID(), { price: 1 })).statusCode).toBe(
      400,
    );
    const requestIds = [randomUUID(), randomUUID()];
    const skus = ["aurora", "sunset"] as const;
    const replies = await Promise.all(
      skus.map((sku, i) => buy(sku, requestIds[i]!)),
    );
    expect(replies.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const successful = replies.findIndex((r) => r.statusCode === 200);
    const data = await read();
    expect(data.owned).toEqual([skus[successful]]);
    expect(BigInt(data.balance)).toBeGreaterThanOrEqual(0n);
    expect(
      (await buy(skus[successful]!, requestIds[successful]!)).statusCode,
    ).toBe(200);
    expect(
      (await buy(skus[1 - successful]!, requestIds[successful]!)).statusCode,
    ).toBe(409);
    expect((await buy(skus[successful]!)).statusCode).toBe(409);
    expect((await read()).balance).toBe(data.balance);
    expect(data.ledger.reduce((sum, e) => sum + BigInt(e.delta), 0n)).toBe(
      BigInt(data.balance),
    );
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/economy/equip",
          headers,
          payload: { sku: skus[1 - successful] },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/economy/equip",
          headers,
          payload: { sku: skus[successful] },
        })
      ).statusCode,
    ).toBe(200);
    expect((await read()).active).toBe(skus[successful]);
  });
  test("reward budget caps at five matches per UTC day", async () => {
    const initial = BigInt((await read()).balance);
    for (let i = 0; i < 6; i++) {
      const snapshot = { ...structuredClone(final), matchId: randomUUID() };
      gameIds.push(snapshot.matchId);
      await db.saveRoom(snapshot.code, snapshot, {
        kind: "fixture-final",
        data: {},
      });
    }
    const data = await read();
    expect(BigInt(data.balance)).toBe(initial + 400n);
    expect(data.ledger.filter((e) => e.kind === "reward")).toHaveLength(5);
  });
});
