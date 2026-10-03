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
