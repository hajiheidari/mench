import pg from "pg";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
export class Database {
  readonly pool: pg.Pool;
  constructor(url: string) {
    this.pool = new pg.Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
    });
  }
  async migrate(): Promise<void> {
    const sql = await readFile(
      new URL("../../../infra/migrations/001_identity.sql", import.meta.url),
      "utf8",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(701001)");
      await client.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
      );
      const result = await client.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE version=1",
      );
      if (result.rows.length) {
        if (result.rows[0]!.checksum !== checksum)
          throw Error("MIGRATION_CHECKSUM_MISMATCH");
      } else {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations(version,checksum) VALUES(1,$1)",
          [checksum],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async close() {
    await this.pool.end();
  }
}
