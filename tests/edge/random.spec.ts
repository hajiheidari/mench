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
