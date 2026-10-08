import { readFile } from "node:fs/promises";
import { createApp } from "./app.js";
import { Database } from "./database.js";
const url =
  (process.env.DATABASE_URL_FILE
    ? (await readFile(process.env.DATABASE_URL_FILE, "utf8")).trim()
    : process.env.DATABASE_URL) ??
  (process.env.NODE_ENV === "production"
    ? undefined
    : "postgres://mench:local-development-only@127.0.0.1:5432/mench");
if (process.env.NODE_ENV === "production" && !url)
  throw new Error("DATABASE_URL required in production");
const database = url ? new Database(url) : undefined;
if (database) await database.migrate();
const app = createApp(undefined, 100, database);
try {
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    void app.close();
  });
