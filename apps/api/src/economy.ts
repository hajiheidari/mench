import type pg from "pg";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Database } from "./database";
import type { RoomSnapshot } from "./rooms";
import { resolveAccount } from "./auth";
interface Wallet {
  id: string;
  balance: string;
  active_sku: string | null;
}
export async function rewardMatch(
  client: pg.PoolClient,
  snapshot: RoomSnapshot,
) {
  const ids = snapshot.members.flatMap((m) =>
    m.accountId ? [m.accountId] : [],
  );
  const users = await client.query<{ id: string }>(
    "SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
    [ids],
  );
  for (const user of users.rows) {
    await client.query(
      "INSERT INTO wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING",
      [user.id],
    );
    const wallet = (
      await client.query<Wallet>(
        "SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE",
        [user.id],
      )
    ).rows[0]!;
    const reference = `game:${snapshot.matchId}:wallet:${wallet.id}`;
    const already = await client.query(
      "SELECT 1 FROM wallet_ledger WHERE reference=$1",
      [reference],
    );
    if (already.rowCount) continue;
    const count = await client.query<{ count: string }>(
      "SELECT count(*) FROM wallet_ledger WHERE wallet_id=$1 AND kind='reward' AND created_at >= (date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')",
      [wallet.id],
    );
    if (Number(count.rows[0]!.count) >= 5) continue;
    const won = snapshot.members.some(
      (m) => m.accountId === user.id && m.id === snapshot.state?.winner,
    );
    const coins = won ? 100 : 40;
    await client.query("UPDATE wallets SET balance=balance+$2 WHERE id=$1", [
      wallet.id,
      coins,
    ]);
    await client.query(
      "INSERT INTO wallet_ledger(wallet_id,reference,kind,delta,metadata) VALUES($1,$2,'reward',$3,$4)",
      [
        wallet.id,
        reference,
        coins,
        JSON.stringify({ gameId: snapshot.matchId, won }),
      ],
    );
  }
}
class EconomyError extends Error {}
const purchase = z
  .object({ sku: z.enum(["aurora", "sunset"]), requestId: z.string().uuid() })
  .strict();
const equip = z
  .object({ sku: z.enum(["aurora", "sunset"]).nullable() })
  .strict();
export function registerEconomy(app: FastifyInstance, db: Database) {
  const identify = (req: FastifyRequest) =>
    resolveAccount(
      db,
      req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : req.cookies.mench_session,
    );
  app.get("/api/economy", async (req, reply) => {
    const user = await identify(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    await db.pool.query(
      "INSERT INTO wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING",
      [user.id],
    );
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const wallet = (
        await client.query<Wallet>(
          "SELECT id,balance,active_sku FROM wallets WHERE user_id=$1",
          [user.id],
        )
      ).rows[0]!;
      const [catalog, owned, ledger] = [
        await client.query("SELECT sku,price FROM cosmetics ORDER BY price"),
        await client.query<{ sku: string }>(
          "SELECT sku FROM owned_cosmetics WHERE wallet_id=$1 ORDER BY sku",
          [wallet.id],
        ),
        await client.query(
          "SELECT kind,delta,metadata,created_at FROM wallet_ledger WHERE wallet_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50",
          [wallet.id],
        ),
      ];
      await client.query("COMMIT");
      return {
        balance: wallet.balance,
        active: wallet.active_sku,
        catalog: catalog.rows,
        owned: owned.rows.map((r) => r.sku),
        ledger: ledger.rows,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
  app.post("/api/economy/purchase", async (req, reply) => {
    const user = await identify(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const input = purchase.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        user.id,
      ]);
      await client.query(
        "INSERT INTO wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING",
        [user.id],
      );
      const wallet = (
        await client.query<Wallet>(
          "SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE",
          [user.id],
        )
      ).rows[0]!;
      const reference = `purchase:${wallet.id}:${input.data.requestId}`;
      const prior = await client.query<{ metadata: { sku: string } }>(
        "SELECT metadata FROM wallet_ledger WHERE reference=$1",
        [reference],
      );
      if (prior.rows[0]) {
        if (prior.rows[0].metadata.sku !== input.data.sku)
          throw new EconomyError("REQUEST_ID_REUSED");
        await client.query("COMMIT");
        return { ok: true };
      }
      const owned = await client.query(
        "SELECT 1 FROM owned_cosmetics WHERE wallet_id=$1 AND sku=$2",
        [wallet.id, input.data.sku],
      );
      if (owned.rowCount) throw new EconomyError("ALREADY_OWNED");
      const item = (
        await client.query<{ price: number }>(
          "SELECT price FROM cosmetics WHERE sku=$1",
          [input.data.sku],
        )
      ).rows[0]!;
      if (BigInt(wallet.balance) < BigInt(item.price))
        throw new EconomyError("INSUFFICIENT_COINS");
      await client.query("UPDATE wallets SET balance=balance-$2 WHERE id=$1", [
        wallet.id,
        item.price,
      ]);
      await client.query(
        "INSERT INTO wallet_ledger(wallet_id,reference,kind,delta,metadata) VALUES($1,$2,'purchase',$3,$4)",
        [
          wallet.id,
          reference,
          -item.price,
          JSON.stringify({ sku: input.data.sku }),
        ],
      );
      await client.query(
        "INSERT INTO owned_cosmetics(wallet_id,sku) VALUES($1,$2)",
        [wallet.id, input.data.sku],
      );
      await client.query("COMMIT");
      return { ok: true };
    } catch (error) {
      await client.query("ROLLBACK");
      if (error instanceof EconomyError)
        return reply.code(409).send({ error: error.message });
      throw error;
    } finally {
      client.release();
    }
  });
  app.post("/api/economy/equip", async (req, reply) => {
    const user = await identify(req);
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const input = equip.safeParse(req.body);
    if (!input.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const updated = await db.pool.query(
      "UPDATE wallets w SET active_sku=$2 WHERE user_id=$1 AND ($2::text IS NULL OR EXISTS(SELECT 1 FROM owned_cosmetics o WHERE o.wallet_id=w.id AND o.sku=$2)) RETURNING id",
      [user.id, input.data.sku],
    );
    if (!updated.rowCount) return reply.code(409).send({ error: "NOT_OWNED" });
    return { ok: true };
  });
}
