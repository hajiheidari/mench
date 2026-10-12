import { expect, test } from "@playwright/test";

test("daily coins, shop and designs survive a reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?lang=en");
  const daily = page.getByRole("dialog", { name: "Today's reward" });
  await expect(daily).toBeVisible();
  await daily.getByRole("button", { name: "Collect +20" }).click();
  await expect(daily).toBeHidden();
  const chip = page.locator(".coin-chip");
  await expect(chip).toContainText("20");
  await chip.click();
  // Boards are 250+ coins: not enough yet, and nothing is taken.
  await page.getByRole("button", { name: /^Buy Wooden 250 coins$/i }).click();
  await expect(page.getByRole("status")).toContainText("Not enough coins");
  await expect(page.locator(".shop-item.in-use")).toContainText("Classic");
  await expect(page.locator(".coin-chip")).toContainText("20");
  // Same wallet after a reload (stored on this device), and no second popup today.
  await page.goto("/?lang=en");
  await expect(page.locator(".coin-chip")).toContainText("20");
  await expect(daily).toBeHidden();
});

test("the recovery code brings the coins to another browser", async ({
  browser,
}) => {
  const first = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  await first.goto("/?lang=en");
  await first.getByRole("button", { name: "Collect +20" }).click();
  await expect(first.locator(".coin-chip")).toContainText("20");
  await first.getByRole("button", { name: "Menu", exact: true }).click();
  const code = (await first.locator(".recovery-code").innerText()).trim();
  expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);

  const second = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  await second.goto("/?lang=en");
  await second.getByRole("button", { name: "Later" }).click();
  await expect(second.locator(".coin-chip")).toContainText("0");
  await second.getByRole("button", { name: "Menu", exact: true }).click();
  await second.getByLabel("Restore with a code").fill(code.toLowerCase());
  await second.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(second.locator(".recovery [role=status]")).toContainText(
    "coins and designs are back",
  );
  await expect(second.locator(".coin-chip")).toContainText("20");
  await expect(second.locator(".recovery-code")).toHaveText(code);
});

test("without internet the online modes say so; the offline game still opens", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?lang=en");
  await page.getByRole("button", { name: "Later" }).click();
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Quick online game", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("No internet connection");
  await page
    .getByRole("button", { name: "Play with friends", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("No internet connection");
  await page
    .getByRole("button", {
      name: "Offline with friends or the bot",
      exact: true,
    })
    .click();
  await expect(page.getByRole("button", { name: "Roll dice" })).toBeVisible();
  await context.setOffline(false);
});

test("a network that cannot reach the game server counts as no internet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?lang=en");
  await page.getByRole("button", { name: "Later" }).click();
  // Wi-Fi without internet: the browser says online, the server never answers.
  await page.route("**/healthz", (route) => route.abort());
  await page
    .getByRole("button", { name: "Quick online game", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("No internet connection");
  await expect(page.getByText("Finding an opponent…")).toHaveCount(0);
  await page.unroute("**/healthz");
  await page
    .getByRole("button", { name: "Quick online game", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
