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
  for (let i = 0; i < 5000; i++) {
    if (await page.getByRole("heading", { name: /Winner:/ }).count()) break;
    const roll = page.getByRole("button", { name: "Roll dice", exact: true });
    if (await roll.isEnabled()) await roll.click({ force: true });
    else await page.locator(".pawn.legal").first().click({ force: true });
  }
  await expect(page.getByRole("heading", { name: /Winner:/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Roll dice", exact: true }),
  ).toBeDisabled();
});
test("four-player setup works at mobile viewport without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByLabel("Players", { exact: true }).selectOption("4");
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.locator(".pawn")).toHaveCount(16);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
