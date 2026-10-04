import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
test("two signed-in players request, accept and block friendship", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  const ids: string[] = [];
  const password = "test-passphrase-12345";
  try {
    for (let i = 0; i < 2; i++) {
      const email = `social-browser-${randomUUID()}@example.com`;
      const registered = await contexts[i]!.request.post(
        "http://127.0.0.1:5173/api/auth/register",
        { data: { email, password, name: `BrowserFriend${i}` } },
      );
      expect(registered.status()).toBe(201);
      ids.push(((await registered.json()) as { id: string }).id);
      expect(
        (
          await contexts[i]!.request.post(
            "http://127.0.0.1:5173/api/auth/login",
            { data: { email, password } },
          )
        ).status(),
      ).toBe(200);
    }
    const pages = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    for (const page of pages) {
      await page.goto("/");
      await page.getByRole("button", { name: "English", exact: true }).click();
      await page.getByRole("button", { name: "Account", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Friends", exact: true }),
      ).toBeVisible();
    }
    await pages[0]!.getByLabel("Player ID", { exact: true }).fill(ids[1]!);
    await pages[0]!
      .getByRole("button", { name: "Request friendship", exact: true })
      .click();
    await expect(
      pages[0]!.getByText("Sent request", { exact: false }),
    ).toBeVisible();
    await pages[1]!
      .getByRole("button", { name: "Refresh", exact: true })
      .click();
    await pages[1]!
      .getByRole("button", { name: "Accept friendship", exact: true })
      .click();
    await expect(
      pages[1]!.getByText("BrowserFriend0", { exact: true }),
    ).toBeVisible();
    await pages[0]!
      .getByRole("button", { name: "Refresh", exact: true })
      .click();
    await pages[0]!
      .locator(".social-person")
      .getByRole("button", { name: "Block", exact: true })
      .click();
    await expect(
      pages[0]!.getByRole("button", { name: "Unblock", exact: true }),
    ).toBeVisible();
    await pages[1]!
      .getByRole("button", { name: "Refresh", exact: true })
      .click();
    await expect(
      pages[1]!.getByText("BrowserFriend0", { exact: true }),
    ).toHaveCount(0);
  } finally {
    for (const context of contexts) {
      await context.request.delete("http://127.0.0.1:5173/api/me", {
        data: { password },
      });
      await context.close();
    }
  }
});
