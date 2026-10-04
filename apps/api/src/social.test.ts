import { randomBytes, randomUUID, createHash } from "node:crypto";
import { beforeAll, afterAll, describe, expect, test } from "vitest";
import { io, type Socket } from "socket.io-client";
import { EVENTS, type Intent, type Reply } from "@mench/game-protocol";
import { Database } from "./database";
import { createApp } from "./app";
import { Rooms } from "./rooms";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL social permissions", () => {
  const db = new Database(url!);
  const rooms = new Rooms();
  const app = createApp(rooms, 100, db);
  const ids = Array.from({ length: 3 }, () => randomUUID());
  const tokens = ids.map(() => randomBytes(32).toString("hex"));
  const sockets: Socket[] = [];
  let endpoint = "";
  const codes: string[] = [];
  const headers = (index: number) => ({
    authorization: `Bearer ${tokens[index]}`,
  });
  const mutate = (index: number, target: string, payload: object) =>
    app.inject({
      method: "POST",
      url: `/api/social/${target}`,
      headers: headers(index),
      payload,
    });
  const read = (index: number) =>
    app.inject({ method: "GET", url: "/api/social", headers: headers(index) });
  async function command(index: number, payload: Intent): Promise<Reply> {
    return sockets[index]!.timeout(5000).emitWithAck(EVENTS.COMMAND, {
      version: 1,
      requestId: randomUUID(),
      payload,
    }) as Promise<Reply>;
  }
  beforeAll(async () => {
    await db.migrate();
    for (let i = 0; i < 3; i++) {
      await db.pool.query(
        "INSERT INTO users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)",
        [ids[i], `${ids[i]}@example.com`, `Social${i}`, "unusable-test-hash"],
      );
      await db.pool.query(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
        [createHash("sha256").update(tokens[i]!).digest("hex"), ids[i]],
      );
    }
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw Error();
    endpoint = `http://127.0.0.1:${address.port}`;
    for (let i = 0; i < 3; i++) {
      const socket = io(endpoint, {
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
    for (const code of codes)
      await cleanup.pool.query("DELETE FROM room_snapshots WHERE code=$1", [
        code,
      ]);
    await cleanup.pool.query(
      "DELETE FROM user_reports WHERE reporter=ANY($1::uuid[]) OR subject=ANY($1::uuid[])",
      [ids],
    );
    await cleanup.pool.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [
      ids,
    ]);
    await cleanup.close();
  });
  test("authenticated directional requests, private presence and strict input", async () => {
    expect((await app.inject({ url: "/api/social" })).statusCode).toBe(401);
    expect((await mutate(0, ids[0]!, { type: "request" })).statusCode).toBe(
      400,
    );
    expect(
      (await mutate(0, randomUUID(), { type: "request" })).statusCode,
    ).toBe(404);
    expect(
      (await mutate(0, ids[1]!, { type: "request", accepted: true }))
        .statusCode,
    ).toBe(400);
    expect((await mutate(0, ids[1]!, { type: "request" })).statusCode).toBe(
      200,
    );
    expect((await mutate(0, ids[1]!, { type: "accept" })).statusCode).toBe(409);
    const pending = (await read(1)).json();
    expect(pending.friends).toMatchObject([
      { id: ids[0], incoming: true, accepted: false, online: false },
    ]);
    expect(JSON.stringify(pending)).not.toContain("@example.com");
    expect(JSON.stringify(pending)).not.toContain(tokens[0]);
    expect((await mutate(1, ids[0]!, { type: "accept" })).statusCode).toBe(200);
    expect((await read(0)).json().friends).toMatchObject([
      { id: ids[1], accepted: true, online: true },
    ]);
    expect((await read(2)).json().friends).toEqual([]);
  });
  test("only a room host can invite an accepted friend; start records recent opponents", async () => {
    const created = await command(0, {
      type: "create",
      name: "First",
      capacity: 2,
    });
    if (!created.ok || !created.room) throw Error();
    const code = created.room.code;
    codes.push(code);
    expect(
      (await mutate(0, ids[2]!, { type: "invite", code })).statusCode,
    ).toBe(409);
    expect(
      (await mutate(1, ids[0]!, { type: "invite", code })).statusCode,
    ).toBe(409);
    expect(
      (await mutate(0, ids[1]!, { type: "invite", code })).statusCode,
    ).toBe(200);
    expect((await read(1)).json().invites).toMatchObject([
      { id: ids[0], code },
    ]);
    expect((await command(1, { type: "join", name: "Second", code })).ok).toBe(
      true,
    );
    expect((await command(0, { type: "start" })).ok).toBe(true);
    expect((await read(0)).json().recent).toMatchObject([{ id: ids[1] }]);
    expect((await read(1)).json().invites).toEqual([]);
    await command(0, { type: "leave" });
    await command(1, { type: "leave" });
  });
  test("blocking removes friendship/invites and rejects room join and queue pairing", async () => {
    expect(
      (await mutate(0, ids[1]!, { type: "report", reason: "arbitrary" }))
        .statusCode,
    ).toBe(400);
    expect(
      (await mutate(0, ids[1]!, { type: "report", reason: "abuse" }))
        .statusCode,
    ).toBe(200);
    expect((await mutate(0, ids[1]!, { type: "block" })).statusCode).toBe(200);
    expect((await read(0)).json().friends).toEqual([]);
    expect((await read(1)).json().recent).toEqual([]);
    expect((await mutate(1, ids[0]!, { type: "request" })).statusCode).toBe(
      409,
    );
    const created = await command(0, {
      type: "create",
      name: "First",
      capacity: 2,
    });
    if (!created.ok || !created.room) throw Error();
    const code = created.room.code;
    codes.push(code);
    expect(await command(1, { type: "join", name: "Second", code })).toEqual({
      ok: false,
      error: "INTERACTION_UNAVAILABLE",
    });
    await command(0, { type: "leave" });
    expect(await command(0, { type: "queue", name: "First" })).toEqual({
      ok: true,
      room: null,
      queued: true,
    });
    expect(await command(1, { type: "queue", name: "Second" })).toEqual({
      ok: true,
      room: null,
      queued: true,
    });
    await command(0, { type: "cancelQueue" });
    await command(1, { type: "cancelQueue" });
    expect((await mutate(0, ids[1]!, { type: "unblock" })).statusCode).toBe(
      200,
    );
    expect((await read(0)).json().friends).toEqual([]);
  });
  test("concurrent accept and block cannot retain a friendship; reports have bounded budgets", async () => {
    await mutate(0, ids[1]!, { type: "request" });
    const [accept, block] = await Promise.all([
      mutate(1, ids[0]!, { type: "accept" }),
      mutate(0, ids[1]!, { type: "block" }),
    ]);
    expect([200, 409]).toContain(accept.statusCode);
    expect(block.statusCode).toBe(200);
    expect((await read(0)).json().friends).toEqual([]);
    for (let i = 0; i < 9; i++)
      expect(
        (await mutate(0, ids[1]!, { type: "report", reason: "spam" }))
          .statusCode,
      ).toBe(200);
    expect(
      (await mutate(0, ids[1]!, { type: "report", reason: "spam" })).statusCode,
    ).toBe(409);
  });
});
