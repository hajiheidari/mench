import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, chmod, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import pg from "pg";
const connectionString =
  process.env.BACKUP_DATABASE_URL ??
  "postgres://mench:local-development-only@127.0.0.1:5432/mench";
const source = new URL(connectionString);
if (
  !["127.0.0.1", "localhost"].includes(source.hostname) ||
  source.pathname !== "/mench"
)
  throw Error("LOCAL_DEVELOPMENT_DATABASE_REQUIRED");
const root = "/workspace/mench-backups";
await mkdir(root, { recursive: true, mode: 0o700 });
await chmod(root, 0o700);
const suffix = `${Date.now()}_${randomBytes(4).toString("hex")}`;
const file = `${root}/mench_${suffix}.dump`;
const name = `mench_restore_${suffix}`;
function completed(child: ReturnType<typeof spawn>) {
  return new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(Error(`POSTGRES_TOOL_FAILED:${code}`)),
    );
  });
}
// Docker's local PostgreSQL client keeps passwords out of arguments and logs.
const dump = spawn(
  "docker",
  [
    "compose",
    "exec",
    "-T",
    "postgres",
    "pg_dump",
    "-U",
    "mench",
    "-d",
    "mench",
    "-Fc",
    "--no-owner",
    "--no-privileges",
  ],
  { stdio: ["ignore", "pipe", "inherit"] },
);
const output = createWriteStream(file, { mode: 0o600 });
const outputDone = new Promise<void>((resolve, reject) => {
  output.once("finish", resolve);
  output.once("error", reject);
});
dump.stdout.pipe(output);
await Promise.all([completed(dump), outputDone]);
const admin = new pg.Pool({ connectionString });
await admin.query(`CREATE DATABASE "${name}"`);
const restored = new URL(source);
restored.pathname = `/${name}`;
const check = new pg.Pool({ connectionString: restored.href });
try {
  const restore = spawn(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "pg_restore",
      "-U",
      "mench",
      "-d",
      name,
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
    ],
    { stdio: ["pipe", "ignore", "inherit"] },
  );
  createReadStream(file).pipe(restore.stdin);
  await completed(restore);
  const tables = (
    await admin.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows.map((r) => r.tablename);
  const counts: Record<string, number> = {};
  for (const table of tables) {
    if (!/^[a-z_]+$/.test(table)) throw Error("UNEXPECTED_TABLE");
    const query = `SELECT count(*)::int AS count, md5(coalesce(string_agg(row_data, '' ORDER BY row_data), '')) AS digest FROM (SELECT row_to_json(t)::text AS row_data FROM "${table}" t) rows`;
    const [before, after] = await Promise.all([
      admin.query(query),
      check.query(query),
    ]);
    if (JSON.stringify(before.rows) !== JSON.stringify(after.rows))
      throw Error(`RESTORE_MISMATCH:${table}`);
    counts[table] = after.rows[0].count;
  }
  const balances = await check.query(
    "SELECT count(*)::int AS invalid FROM wallets w WHERE w.balance<>coalesce((SELECT sum(delta) FROM wallet_ledger l WHERE l.wallet_id=w.id),0)",
  );
  if (balances.rows[0].invalid !== 0)
    throw Error("LEDGER_RECONCILIATION_FAILED");
  await writeFile(
    new URL("../docs/BACKUP_REPORT.json", import.meta.url),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        format: "PostgreSQL custom archive",
        tablesVerified: tables.length,
        counts,
        ledgerReconciled: true,
        privateArchiveOutsideRepository: true,
        limitation:
          "Local development restore rehearsal. Requires externally encrypted offsite backups and production RPO/RTO policy before launch.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Backup restored; ${tables.length} table counts/digests match; wallet ledger reconciled. Private archive is outside Git.`,
  );
} finally {
  await check.end();
  await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
}
