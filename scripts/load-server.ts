import { createApp } from "../apps/api/src/app";
import { Database } from "../apps/api/src/database";
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL_REQUIRED");
const database = new Database(process.env.DATABASE_URL);
await database.migrate();
const app = createApp(undefined, 100, database);
await app.listen({ port: 0, host: "127.0.0.1" });
const address = app.server.address();
if (!address || typeof address === "string") throw Error("INVALID_ADDRESS");
process.send?.({ port: address.port });
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => void app.close());
