import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { afterEach, expect, test } from "vitest";
import { verifyProof } from "@mench/fair-dice";
import {
  EVENTS,
  type Intent,
  type Reply,
  type PublicRoom,
} from "@mench/game-protocol";
import { legalMoves } from "@mench/game-engine";
import { GameClient } from "@mench/game-client";
import { createApp } from "./app";
const sockets: Socket[] = [];
afterEach(() => {
  sockets.splice(0).forEach((s) => s.disconnect());
});
async function connect(url: string) {
  const socket = io(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return socket;
}
async function command(
  socket: Socket,
  payload: Intent,
  requestId = randomUUID(),
): Promise<Reply> {
  return socket.timeout(5000).emitWithAck(EVENTS.COMMAND, {
    version: 1,
    requestId,
    payload,
  }) as Promise<Reply>;
}
function roomOf(reply: Reply): PublicRoom {
  if (!reply.ok || !reply.room) throw Error(JSON.stringify(reply));
  return reply.room;
}
test.each([2, 4])(
  "complete %i-client authoritative game and reject forged/duplicate intents",
  async (count) => {
    const app = createApp(undefined, 10000);
    try {
      await app.listen({ port: 0, host: "127.0.0.1" });
      const address = app.server.address();
      if (!address || typeof address === "string") throw Error();
      const clients: Socket[] = [];
      for (let i = 0; i < count; i++)
        clients.push(await connect(`http://127.0.0.1:${address.port}`));
      let room = roomOf(
        await command(clients[0]!, {
          type: "create",
          name: "Alpha",
          capacity: count,
        }),
      );
      for (let i = 1; i < count; i++)
        room = roomOf(
          await command(clients[i]!, {
            type: "join",
            name: "Beta",
            code: room.code,
          }),
        );
      room = roomOf(await command(clients[0]!, { type: "start" }));
      const forged = (await clients[0]!.emitWithAck(EVENTS.COMMAND, {
        version: 1,
        requestId: randomUUID(),
        payload: {
          type: "roll",
          nonce: "aa".repeat(32),
          expectedVersion: 0,
          value: 6,
        },
      })) as Reply;
      expect(forged).toEqual({ ok: false, error: "INVALID_COMMAND" });
      const nonce = "bb".repeat(32);
      const id = randomUUID();
      const first = await command(
        clients[0]!,
        { type: "roll", nonce, expectedVersion: room.state!.version },
        id,
      );
      const duplicate = await command(
        clients[0]!,
        { type: "roll", nonce, expectedVersion: 0 },
        id,
      );
      expect(duplicate).toEqual(first);
      room = roomOf(first);
      expect(
        verifyProof(room.proofs[0]!, room.proofs[0]!.commitment, nonce),
      ).toBe(true);
      const beforeVersion = room.state!.version;
      const peer = clients[1]!;
      const bad = await command(peer, {
        type: "move",
        pawn: 0,
        expectedVersion: beforeVersion,
      });
      expect(bad.ok).toBe(false);
      for (
        let turn = 0;
        turn < 10000 && room.state!.phase !== "finished";
        turn++
      ) {
        const state = room.state!;
        const client = clients[state.turn]!;
        if (state.phase === "roll") {
          const committed = room.commitment!;
          const n =
            randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
          room = roomOf(
            await command(client, {
              type: "roll",
              nonce: n,
              expectedVersion: state.version,
            }),
          );
          const proof = room.proofs.at(-1)!;
          expect(verifyProof(proof, committed.hash, n)).toBe(true);
        } else
          room = roomOf(
            await command(client, {
              type: "move",
              pawn: legalMoves(state)[0]!,
              expectedVersion: state.version,
            }),
          );
      }
      expect(room.state!.phase).toBe("finished");
      expect(room.state!.winner).not.toBeNull();
      for (const s of clients) s.disconnect();
    } finally {
      await app.close();
    }
  },
  20000,
);
test("malformed envelope and wrong protocol rejected", async () => {
  const app = createApp();
  try {
    await app.listen({ port: 0, host: "127.0.0.1" });
    const a = app.server.address();
    if (!a || typeof a === "string") throw Error();
    const c = await connect(`http://127.0.0.1:${a.port}`);
    const r = await c.emitWithAck(EVENTS.COMMAND, {
      version: 2,
      requestId: "x",
      payload: { type: "start" },
    });
    expect(r).toEqual({ ok: false, error: "INVALID_COMMAND" });
    c.disconnect();
  } finally {
    await app.close();
  }
});

test("real socket reconnect restores identity/state and evicts simultaneous session", async () => {
  const app = createApp();
  try {
    await app.listen({ port: 0, host: "127.0.0.1" });
    const a = app.server.address();
    if (!a || typeof a === "string") throw Error();
    const url = `http://127.0.0.1:${a.port}`;
    const one = await connect(url);
    const two = await connect(url);
    const created = await command(one, {
      type: "create",
      name: "Alpha",
      capacity: 2,
    });
    if (!created.ok || !created.room || !created.token || !created.playerId)
      throw Error();
    await command(two, { type: "join", name: "Beta", code: created.room.code });
    await command(one, { type: "start" });
    one.disconnect();
    const reconnect = await connect(url);
    const restored = await command(reconnect, {
      type: "resume",
      code: created.room.code,
      token: created.token,
    });
    const room = roomOf(restored);
    expect(restored.ok && restored.playerId).toBe(created.playerId);
    expect(room.state!.turn).toBe(0);
    expect(room.state!.players[0]!.pawns).toEqual([-1, -1, -1, -1]);
    expect(room.players[0]!.connected).toBe(true);
    const other = await connect(url);
    await command(other, {
      type: "resume",
      code: room.code,
      token: created.token,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reconnect.connected).toBe(false);
    const snapshot = roomOf(
      await command(other, {
        type: "roll",
        nonce: "11".repeat(32),
        expectedVersion: room.state!.version + 1,
      }),
    );
    expect(snapshot.proofs).toHaveLength(1);
    for (const s of sockets) s.disconnect();
  } finally {
    await app.close();
  }
});
test("default WebSocket rate limiter blocks spam", async () => {
  const app = createApp();
  try {
    await app.listen({ port: 0, host: "127.0.0.1" });
    const a = app.server.address();
    if (!a || typeof a === "string") throw Error();
    const client = await connect(`http://127.0.0.1:${a.port}`);
    for (let i = 0; i < 100; i++)
      await command(client, { type: "cancelQueue" });
    expect(await command(client, { type: "cancelQueue" })).toEqual({
      ok: false,
      error: "RATE_LIMITED",
    });
    client.disconnect();
  } finally {
    await app.close();
  }
});

test("matchmaking pairs unique clients and starts an authoritative match; cancel removes queue entry", async () => {
  const app = createApp();
  try {
    await app.listen({ port: 0, host: "127.0.0.1" });
    const a = app.server.address();
    if (!a || typeof a === "string") throw Error();
    const url = `http://127.0.0.1:${a.port}`;
    const first = await connect(url);
    const second = await connect(url);
    expect(await command(first, { type: "queue", name: "Alpha" })).toEqual({
      ok: true,
      room: null,
      queued: true,
    });
    expect(await command(first, { type: "cancelQueue" })).toEqual({
      ok: true,
      room: null,
      queued: false,
    });
    const matched = new Promise<Reply>((resolve) =>
      first.once(EVENTS.MATCHED, resolve),
    );
    await command(first, { type: "queue", name: "Alpha" });
    const theirs = await command(second, { type: "queue", name: "Beta" });
    const mine = await matched;
    const room = roomOf(theirs);
    expect(roomOf(mine).code).toBe(room.code);
    expect(room.state!.players).toHaveLength(2);
    expect(room.state!.phase).toBe("roll");
    expect(room.players.map((p) => p.name)).toEqual(["Alpha", "Beta"]);
    first.disconnect();
    second.disconnect();
  } finally {
    await app.close();
  }
});

test("reusing a request ID for different payload is rejected", async () => {
  const app = createApp();
  try {
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw Error();
    const client = await connect(`http://127.0.0.1:${address.port}`);
    await command(client, { type: "create", name: "Alpha", capacity: 2 });
    const id = randomUUID();
    const result = await command(client, { type: "start" }, id);
    expect(result.ok).toBe(false);
    const joined = await command(
      client,
      { type: "resume", code: "FFFFFFFFFF", token: "00".repeat(32) },
      id,
    );
    expect(joined.ok).toBe(false);
    const createId = randomUUID();
    const other = await connect(`http://127.0.0.1:${address.port}`);
    await command(
      other,
      { type: "create", name: "Beta", capacity: 2 },
      createId,
    );
    expect(await command(other, { type: "leave" }, createId)).toEqual({
      ok: false,
      error: "REQUEST_ID_REUSED",
    });
    client.disconnect();
    other.disconnect();
  } finally {
    await app.close();
  }
});

test("a cached lobby acknowledgement cannot replace a newer joined-player snapshot in the shared client", async () => {
  const app = createApp();
  const requestId = randomUUID();
  let client: GameClient | undefined;
  try {
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw Error();
    const url = `http://127.0.0.1:${address.port}`;
    client = new GameClient({
      url,
      requestId: () => requestId,
      save: () => {},
    });
    client.connect();
    await new Promise<void>((resolve) => {
      const stop = client!.subscribe((state) => {
        if (state.connected) {
          queueMicrotask(stop);
          resolve();
        }
      });
    });
    const intent = { type: "create", name: "LobbyHost", capacity: 2 } as const;
    const created = await client.send(intent);
    if (!created?.ok || !created.room) throw Error();
    const peer = await connect(url);
    const joined = new Promise<void>((resolve) => {
      const stop = client!.subscribe((state) => {
        if (state.room?.players.length === 2) {
          queueMicrotask(stop);
          resolve();
        }
      });
    });
    await command(peer, {
      type: "join",
      name: "LobbyGuest",
      code: created.room.code,
    });
    await joined;
    const newer = client.state.room!.revision;
    const cached = await client.send(intent);
    expect(roomOf(cached!).players).toHaveLength(1);
    expect(client.state.room!.players).toHaveLength(2);
    expect(client.state.room!.revision).toBe(newer);
  } finally {
    client?.close();
    await app.close();
  }
});

test("socket admission bounds active connections before account/database lookup", async () => {
  const app = createApp(undefined, 100, undefined, { maxConnections: 2 });
  try {
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw Error();
    const url = `http://127.0.0.1:${address.port}`;
    await connect(url);
    await connect(url);
    await expect(connect(url)).rejects.toThrow("SERVER_FULL");
  } finally {
    await app.close();
  }
});
