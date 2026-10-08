import { execFileSync, fork } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { open, readFile, writeFile } from "node:fs/promises";
import pg from "pg";
import { io, type Socket } from "socket.io-client";
import {
  EVENTS,
  type Intent,
  type Reply,
  type PublicRoom,
} from "@mench/game-protocol";
import { legalMoves } from "@mench/game-engine";
import { verifyProof } from "@mench/fair-dice";
const source =
  process.env.LOAD_DATABASE_URL ??
  "postgres://mench:local-development-only@127.0.0.1:5432/mench";
const parsed = new URL(source);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname))
  throw Error("LOCAL_DATABASE_REQUIRED");
const admin = new pg.Pool({ connectionString: source });
const reports: unknown[] = [];
function percentile(samples: number[], p: number) {
  const sorted = [...samples].sort((a, b) => a - b);
  if (!sorted.length) throw Error("EMPTY_MEASUREMENT");
  return (
    Math.round(
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]! * 100,
    ) / 100
  );
}
async function dropOwnDatabase(name: string) {
  for (let attempt = 0; ; attempt++) {
    const remaining = await admin.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1",
      [name],
    );
    if (remaining.rows[0]!.count === 0) break;
    if (attempt >= 100) throw Error("OWN_DATABASE_CONNECTIONS_NOT_CLOSED");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await admin.query(`DROP DATABASE "${name}"`);
}
for (const count of [100, 500, 1000]) {
  const name = `mench_load_${Date.now()}_${randomBytes(4).toString("hex")}`;
  await admin.query(`CREATE DATABASE "${name}"`);
  const target = new URL(source);
  target.pathname = `/${name}`;
  const log = await open(`/tmp/${name}.log`, "w", 0o600);
  const child = fork(new URL("./load-server.ts", import.meta.url), [], {
    execArgv: ["--import", "tsx"],
    env: {
      ...process.env,
      DATABASE_URL: target.href,
      NODE_ENV: "development",
    },
    stdio: ["ignore", log.fd, log.fd, "ipc"],
  });
  const sockets: Socket[] = [];
  const latency: number[] = [];
  const databaseLatency: number[] = [];
  const probe = new pg.Pool({ connectionString: target.href, max: 1 });
  const started = performance.now();
  let peakRssKiB = 0;
  const measure = async () => {
    const status = await readFile(`/proc/${child.pid}/status`, "utf8");
    peakRssKiB = Math.max(
      peakRssKiB,
      Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0),
    );
  };
  let sampling: ReturnType<typeof setInterval> | undefined;
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("SERVER_NOT_READY")), 10000);
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(Error("SERVER_EXITED"));
      });
      child.once("message", (message) => {
        clearTimeout(timer);
        const port = (message as { port?: number }).port;
        if (!port) reject(Error("INVALID_SERVER_ADDRESS"));
        else resolve(port);
      });
    });
    const endpoint = `http://127.0.0.1:${port}`;
    if (!(await fetch(`${endpoint}/health`)).ok)
      throw Error("SERVER_NOT_READY");
    const cpuBefore = (await readFile(`/proc/${child.pid}/stat`, "utf8")).split(
      " ",
    );
    sampling = setInterval(() => void measure().catch(() => {}), 100);
    const command = async (
      socket: Socket,
      payload: Intent,
    ): Promise<PublicRoom | null> => {
      const begin = performance.now();
      const reply = (await socket.timeout(60000).emitWithAck(EVENTS.COMMAND, {
        version: 1,
        requestId: randomUUID(),
        payload,
      })) as Reply;
      latency.push(performance.now() - begin);
      if (!reply.ok) throw Error(reply.error);
      return reply.room;
    };
    for (let offset = 0; offset < count; offset += 50) {
      await Promise.all(
        Array.from({ length: Math.min(50, count - offset) }, async () => {
          const socket = io(endpoint, {
            transports: ["websocket"],
            forceNew: true,
            reconnection: false,
          });
          sockets.push(socket);
          await new Promise<void>((resolve, reject) => {
            socket.once("connect", resolve);
            socket.once("connect_error", reject);
          });
        }),
      );
    }
    let verified = 0;
    // 50 matches at a time avoids turning this into an unbounded admission flood.
    for (let offset = 0; offset < count; offset += 100) {
      for (let sample = 0; sample < 5; sample++) {
        const begin = performance.now();
        await probe.query("SELECT 1");
        databaseLatency.push(performance.now() - begin);
      }
      await Promise.all(
        Array.from(
          { length: Math.min(100, count - offset) / 2 },
          async (_, index) => {
            const pair = sockets.slice(
              offset + index * 2,
              offset + index * 2 + 2,
            );
            let room = (await command(pair[0]!, {
              type: "create",
              name: "LoadAlpha",
              capacity: 2,
            }))!;
            await command(pair[1]!, {
              type: "join",
              name: "LoadBeta",
              code: room.code,
            });
            room = (await command(pair[0]!, { type: "start" }))!;
            for (let round = 0; round < 4; round++) {
              const owner = room.players.findIndex(
                (p) => p.id === room.state!.players[room.state!.turn]!.id,
              );
              const nonce = randomBytes(32).toString("hex");
              const observed = room.commitment!.hash;
              room = (await command(pair[owner]!, {
                type: "roll",
                nonce,
                expectedVersion: room.state!.version,
              }))!;
              if (!verifyProof(room.proofs.at(-1)!, observed, nonce))
                throw Error("INVALID_PROOF");
              verified++;
              if (room.state!.phase === "move")
                room = (await command(pair[owner]!, {
                  type: "move",
                  pawn: legalMoves(room.state!)[0]!,
                  expectedVersion: room.state!.version,
                }))!;
            }
          },
        ),
      );
    }
    await measure();
    const cpuAfter = (await readFile(`/proc/${child.pid}/stat`, "utf8")).split(
      " ",
    );
    const cpuTicks =
      Number(cpuAfter[13]) +
      Number(cpuAfter[14]) -
      Number(cpuBefore[13]) -
      Number(cpuBefore[14]);
    const report = {
      clients: count,
      matches: count / 2,
      commands: latency.length,
      verifiedProofs: verified,
      errors: 0,
      elapsedMs: Math.round(performance.now() - started),
      ackP50Ms: percentile(latency, 0.5),
      ackP95Ms: percentile(latency, 0.95),
      ackP99Ms: percentile(latency, 0.99),
      peakRssKiB,
      serverCpuSeconds:
        cpuTicks /
        Number(
          execFileSync("getconf", ["CLK_TCK"], { encoding: "utf8" }).trim(),
        ),
      databaseProbeP50Ms: percentile(databaseLatency, 0.5),
      databaseProbeP95Ms: percentile(databaseLatency, 0.95),
    };
    reports.push(report);
    console.log(JSON.stringify(report));
  } finally {
    if (sampling) clearInterval(sampling);
    for (const socket of sockets) socket.disconnect();
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", () => resolve());
      setTimeout(() => {
        child.kill("SIGKILL");
      }, 10000).unref();
    });
    await probe.end();
    await log.close();
    await dropOwnDatabase(name);
  }
}
await admin.end();
await writeFile(
  new URL("../docs/LOAD_REPORT.json", import.meta.url),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      scenario:
        "Single local API process and PostgreSQL, guest sockets, four rolls per two-player game, 50 concurrent match command sequences. Short admission/gameplay smoke, not sustained production capacity.",
      reports,
    },
    null,
    2,
  ) + "\n",
);
