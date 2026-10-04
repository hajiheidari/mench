import pg from "pg";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import type { RoomSnapshot } from "./rooms";
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
