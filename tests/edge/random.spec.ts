import { expect, test } from "@playwright/test";

test("quick online game: search, named opponent, full game, result and rematch on one screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Test fixture only: run the opponent's human-like pauses 10x faster.
  await page.addInitScript(() => {
    const native = window.setTimeout.bind(window);
    window.setTimeout = ((
      handler: TimerHandler,
      ms?: number,
      ...args: unknown[]
    ) =>
      native(handler, ms ? ms / 10 : ms, ...args)) as typeof window.setTimeout;
  });
  await page.goto("/?lang=en");
  await page
    .getByRole("button", { name: "Quick online game", exact: true })
    .click();
  await expect(page.getByText("Finding an opponent…")).toBeVisible();
  const roll = page.getByRole("button", { name: "Roll dice", exact: true });
  await expect(roll).toBeVisible({ timeout: 10000 });
  // Two players only; the opponent chip carries a flag and a name, mine says "you".
  await expect(page.locator(".hud-players .chip")).toHaveCount(2);
  await expect(page.locator(".hud-players")).toContainText("you");
  await expect(page.locator(".pawn")).toHaveCount(8);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= innerHeight &&
        document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = page.getByRole("dialog");
  for (let i = 0; i < 20000 && !(await result.isVisible()); i++) {
    if (await roll.isEnabled())
      await roll.click({ timeout: 2000 }).catch(() => undefined);
    else {
      const pawn = page.locator(".pawn.legal:enabled").first();
      if (await pawn.count())
        await pawn
          .evaluate((el: HTMLButtonElement) => el.click())
          .catch(() => undefined);
      else await page.waitForTimeout(150);
    }
  }
  await expect(result).toBeVisible();
  await expect(result).toContainText("Winner:");
  await result.getByRole("button", { name: "Play again", exact: true }).click();
  await expect(page.getByText("Finding an opponent…")).toBeVisible();
});

test("quick online game pairs two people searching at the same time", async ({
  browser,
}) => {
  const players = await Promise.all(
    ["Alice", "Bob"].map(async (name) => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        timezoneId: "Asia/Tehran",
      });
      await context.addInitScript(
        (value) => localStorage.setItem("mench-name", value),
        name,
      );
      const page = await context.newPage();
      await page.goto("/?lang=en");
      return { context, page };
    }),
  );
  for (const { page } of players)
    await page
      .getByRole("button", { name: "Quick online game", exact: true })
      .click();
  // Both land in the same server room: each sees the other's flagged name.
  await expect(players[0]!.page.locator(".hud-players")).toContainText(
    "🇮🇷 Bob",
    { timeout: 15000 },
  );
  await expect(players[1]!.page.locator(".hud-players")).toContainText(
    "🇮🇷 Alice",
  );
  // Server dice: the fair-dice history is available, unlike the bot game.
  await expect(
    players[0]!.page.getByRole("button", { name: /Dice history/ }),
  ).toBeVisible();
  for (const { context } of players) await context.close();
});
