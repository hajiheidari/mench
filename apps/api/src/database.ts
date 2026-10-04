import pg from "pg";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import type { RoomSnapshot } from "./rooms";
import { eloDelta } from "./rating";
import { rewardMatch } from "./economy";
export class Database {
  readonly pool: pg.Pool;
  private closed = false;
  constructor(url: string) {
    this.pool = new pg.Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    });
  }
  async migrate(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(701001)");
      await client.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
      );
      for (const [version, file] of [
        [1, "001_identity.sql"],
        [2, "002_room_recovery.sql"],
        [3, "003_social.sql"],
        [4, "004_rankings.sql"],
        [5, "005_economy.sql"],
      ] as const) {
        const sql = await readFile(
          new URL("../../../infra/migrations/" + file, import.meta.url),
          "utf8",
        );
        const checksum = createHash("sha256").update(sql).digest("hex");
        const result = await client.query<{ checksum: string }>(
          "SELECT checksum FROM schema_migrations WHERE version=$1",
          [version],
        );
        if (result.rows.length) {
          if (result.rows[0]!.checksum !== checksum)
            throw Error("MIGRATION_CHECKSUM_MISMATCH");
        } else {
          await client.query(sql);
          await client.query(
            "INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)",
            [version, checksum],
          );
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async loadRooms(): Promise<RoomSnapshot[]> {
    const result = await this.pool.query<{ snapshot: RoomSnapshot }>(
      "SELECT snapshot FROM room_snapshots WHERE created_at>now()-interval '24 hours'",
    );
    return result.rows.map((r) => r.snapshot);
  }
  async saveRoom(
    code: string,
    snapshot: RoomSnapshot | null,
    event: { kind: string; requestId?: string; data: Record<string, unknown> },
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (snapshot) {
        await client.query(
          "INSERT INTO room_snapshots(code,snapshot,created_at) VALUES($1,$2,to_timestamp($3)) ON CONFLICT(code) DO UPDATE SET snapshot=EXCLUDED.snapshot,updated_at=now()",
          [code, JSON.stringify(snapshot), snapshot.createdAt / 1000],
        );
        await client.query(
          "INSERT INTO room_events(room_code,request_id,kind,data) VALUES($1,$2,$3,$4) ON CONFLICT(room_code,request_id) DO NOTHING",
          [
            code,
            event.requestId ?? randomUUID(),
            event.kind,
            JSON.stringify(event.data),
          ],
        );
        if (
          snapshot.state &&
          (event.kind === "start" || event.kind === "queue")
        ) {
          const ids = snapshot.members.flatMap((member) =>
            member.accountId ? [member.accountId] : [],
          );
          await client.query(
            "INSERT INTO recent_opponents(player,opponent) SELECT a.id,b.id FROM users a CROSS JOIN users b WHERE a.id=ANY($1::uuid[]) AND b.id=ANY($1::uuid[]) AND a.id<>b.id ON CONFLICT(player,opponent) DO UPDATE SET played_at=now()",
            [ids],
          );
        }
        if (snapshot.state?.phase === "finished" && snapshot.state.winner) {
          const recorded = await client.query(
            "INSERT INTO game_results(game_id,result) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING game_id",
            [
              snapshot.matchId,
              JSON.stringify({
                state: snapshot.state,
                players: snapshot.members.map((m) => ({
                  id: m.id,
                  accountId: m.accountId,
                })),
                ranked: snapshot.ranked,
              }),
            ],
          );
          if (
            recorded.rowCount &&
            snapshot.ranked &&
            snapshot.members.length === 2
          ) {
            const winner = snapshot.members.find(
              (m) => m.id === snapshot.state!.winner,
            )?.accountId;
            const loser = snapshot.members.find(
              (m) => m.id !== snapshot.state!.winner,
            )?.accountId;
            if (winner && loser && winner !== loser) {
              const users = await client.query(
                "SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
                [[winner, loser]],
              );
              if (users.rowCount === 2) {
                await client.query(
                  "INSERT INTO ratings(user_id) VALUES($1),($2) ON CONFLICT DO NOTHING",
                  [winner, loser],
                );
                const ratings = await client.query<{
                  user_id: string;
                  rating: number;
                }>(
                  "SELECT user_id,rating FROM ratings WHERE user_id=ANY($1::uuid[]) ORDER BY user_id FOR UPDATE",
                  [[winner, loser]],
                );
                const delta = eloDelta(
                  ratings.rows.find((r) => r.user_id === winner)!.rating,
                  ratings.rows.find((r) => r.user_id === loser)!.rating,
                );
                await client.query(
                  "UPDATE ratings SET rating=rating+CASE WHEN user_id=$1 THEN $3::integer ELSE -$3::integer END,games=games+1,wins=wins+CASE WHEN user_id=$1 THEN 1 ELSE 0 END WHERE user_id=ANY($2::uuid[])",
                  [winner, [winner, loser], delta],
                );
                await client.query(
                  "UPDATE game_results SET rated=true WHERE game_id=$1",
                  [snapshot.matchId],
                );
              }
            }
          }
          if (recorded.rowCount) await rewardMatch(client, snapshot);
        }
      } else
        await client.query("DELETE FROM room_snapshots WHERE code=$1", [code]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async close() {
    if (!this.closed) {
      this.closed = true;
      await this.pool.end();
    }
  }
}
