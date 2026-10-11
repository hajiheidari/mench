import { expect, test } from "@playwright/test";
test("complete a local two-player game and switch RTL/language", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let seed = 97;
    Object.defineProperty(crypto, "getRandomValues", {
      value: (array: Uint8Array) => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        array[0] = seed % 252;
        return array;
      },
    });
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page
    .getByRole("button", { name: "Play on one device", exact: true })
    .click();
  for (let i = 0; i < 5000; i++) {
    if (await page.locator(".roll-turn", { hasText: /Winner:/ }).count()) break;
    const roll = page.getByRole("button", { name: "Roll dice", exact: true });
    if (await roll.isEnabled()) await roll.click({ force: true });
    else await page.locator(".pawn.legal").first().click({ force: true });
  }
  await expect(
    page.locator(".roll-turn", { hasText: /Winner:/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Roll dice", exact: true }),
  ).toBeDisabled();
  const result = page.getByRole("dialog", { name: "Game over", exact: true });
  await expect(result).toBeVisible();
  await expect(result).toContainText("Winner:");
  await result.getByRole("button", { name: "View board", exact: true }).click();
  await expect(result).not.toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Roll dice", exact: true }),
  ).toBeEnabled();
});
test("four-player setup works at mobile viewport without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  // On phones the language switch lives in the home menu.
  await page.getByRole("button", { name: "منو", exact: true }).click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Play on one device", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Players", { exact: true }).selectOption("4");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".pawn")).toHaveCount(16);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= window.innerWidth &&
        document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
});

test("player count immediately resets the board and all selected colors", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page
    .getByRole("button", { name: "Play on one device", exact: true })
    .click();
  await page.getByRole("button", { name: "Roll dice", exact: true }).click();
  for (const count of [3, 4, 2, 4]) {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByLabel("Players", { exact: true })
      .selectOption(String(count));
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.locator(".pawn")).toHaveCount(count * 4);
    await expect(page.locator(".hud-players .chip")).toHaveCount(count);
    const colors =
      count === 2
        ? ["Red", "Yellow"]
        : ["Red", "Green", "Yellow", "Blue"].slice(0, count);
    for (const color of colors) {
      await expect(
        page.getByRole("button", { name: new RegExp(`^${color} Pawn`) }),
      ).toHaveCount(4);
    }
    await expect(page.locator('.pawn[data-progress="-1"]')).toHaveCount(
      count * 4,
    );
    await expect(page.locator(".dice")).toHaveText("✦");
    await expect(
      page.getByRole("button", { name: "Roll dice", exact: true }),
    ).toBeEnabled();
    await expect(
      page.locator(".roll-turn", { hasText: /^Turn: Red$/ }),
    ).toBeVisible();
  }
});
