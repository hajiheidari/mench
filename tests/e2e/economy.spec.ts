import { randomUUID } from "node:crypto";
import pg from "pg";
import { test, expect } from "@playwright/test";
test("coin purchase is owned once and equipped theme survives browser reload", async ({
  page,
  context,
}) => {
  const db = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgres://mench:local-development-only@127.0.0.1:5432/mench",
  });
  const email = `wallet-browser-${randomUUID()}@example.com`;
  const password = "test-passphrase-12345";
  let userId = "";
  try {
    const registered = await context.request.post(
      "http://127.0.0.1:5173/api/auth/register",
      { data: { name: "WalletBrowser", email, password } },
    );
    expect(registered.status()).toBe(201);
    userId = ((await registered.json()) as { id: string }).id;
    expect(
      (
        await context.request.post("http://127.0.0.1:5173/api/auth/login", {
          data: { email, password },
        })
      ).status(),
    ).toBe(200);
    // This new test-only wallet is funded with a balanced receipt; there is no public grant endpoint.
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const wallet = (
        await client.query<{ id: string }>(
          "INSERT INTO wallets(user_id,balance) VALUES($1,100) RETURNING id",
          [userId],
        )
      ).rows[0]!;
      await client.query(
        "INSERT INTO wallet_ledger(wallet_id,reference,kind,delta,metadata) VALUES($1,$2,'reward',100,$3)",
        [
          wallet.id,
          `browser-fixture:${randomUUID()}`,
          JSON.stringify({ fixture: true }),
        ],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    const account = async () => {
      await page.getByRole("button", { name: "English", exact: true }).click();
      await page.getByRole("button", { name: "Account", exact: true }).click();
    };
    await page.goto("/");
    await account();
    await expect(page.getByText("Coins: 100", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Buy · Aurora", exact: true })
      .click();
    await expect(page.getByText("Coins: 40", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Use · Aurora", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "aurora");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "aurora");
    await account();
    await expect(page.getByText("Coins: 40", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Use · Aurora", exact: true }),
    ).toBeDisabled();
  } finally {
    if (userId) await db.query("DELETE FROM users WHERE id=$1", [userId]);
    await db.end();
  }
});
