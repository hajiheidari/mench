import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
test("four account UIs join and start a persisted elimination bracket", async ({
  browser,
}) => {
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () => browser.newContext()),
  );
  const password = "test-passphrase-12345";
  let tournamentId = "";
  const userIds: string[] = [];
  const db = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgres://mench:local-development-only@127.0.0.1:5432/mench",
  });
  try {
    for (let i = 0; i < 4; i++) {
      const email = `tournament-browser-${randomUUID()}@example.com`;
      const registered = await contexts[i]!.request.post(
        "http://127.0.0.1:5173/api/auth/register",
        { data: { name: `Bracket${i}`, email, password } },
      );
      expect(registered.status()).toBe(201);
      userIds.push(((await registered.json()) as { id: string }).id);
      expect(
        (
          await contexts[i]!.request.post(
            "http://127.0.0.1:5173/api/auth/login",
            { data: { email, password } },
          )
        ).status(),
      ).toBe(200);
    }
    const host = await contexts[0]!.newPage();
    await host.goto("/");
    await host.getByRole("button", { name: "English", exact: true }).click();
    await host.getByRole("button", { name: "Account", exact: true }).click();
    await host
      .getByRole("button", { name: "Create tournament", exact: true })
      .click();
    await expect(
      host.getByLabel("Tournament ID", { exact: true }),
    ).not.toHaveValue("");
    tournamentId = await host
      .getByLabel("Tournament ID", { exact: true })
      .inputValue();
    for (let i = 1; i < 4; i++) {
      const page = await contexts[i]!.newPage();
      await page.goto(`/tournament/${tournamentId}`);
      await page.getByRole("button", { name: "English", exact: true }).click();
      await page
        .getByRole("button", { name: "View · Tournament", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Join room", exact: true })
        .click();
      await expect(
        page.getByText(`Bracket${i}`, { exact: false }).last(),
      ).toBeVisible();
    }
    await host
      .getByRole("button", { name: "Refresh · Tournament", exact: true })
      .click();
    await host.getByRole("button", { name: "Start game", exact: true }).click();
    await expect(
      host.getByRole("heading", { name: "Round 1", exact: true }),
    ).toBeVisible();
    await expect(
      host.getByRole("heading", { name: "Round 2", exact: true }),
    ).toBeVisible();
    await host.reload();
    await host.getByRole("button", { name: "English", exact: true }).click();
    await host.getByRole("button", { name: "Account", exact: true }).click();
    await host.getByLabel("Tournament ID", { exact: true }).fill(tournamentId);
    await host
      .getByRole("button", { name: "View · Tournament", exact: true })
      .click();
    await expect(
      host.getByRole("heading", { name: "Round 2", exact: true }),
    ).toBeVisible();
  } finally {
    if (tournamentId)
      await db.query("DELETE FROM tournaments WHERE id=$1", [tournamentId]);
    await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [userIds]);
    await db.end();
    for (const context of contexts) await context.close();
  }
});
