import { test, expect } from "@playwright/test";
test.setTimeout(20000);
test("practice bot completes its legal turn automatically while human controls are disabled", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "getRandomValues", {
      value: (array: Uint8Array | Uint32Array) => {
        array[0] = 5;
        return array;
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page
    .getByRole("button", { name: "Play on one device", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Practice with bot", { exact: true }).check();
  await page.getByLabel("Bot difficulty", { exact: true }).selectOption("hard");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const roll = page.getByRole("button", { name: "Roll dice", exact: true });
  // Three consecutive sixes forfeit the human turn; the bot then rolls and moves itself.
  await roll.click();
  await page.locator(".pawn.legal").first().click();
  await roll.click();
  await page.locator(".pawn.legal").first().click();
  await roll.click();
  await expect(
    page.getByText("Bot is choosing a move", { exact: true }),
  ).toBeVisible();
  await expect(roll).toBeDisabled();
  await expect(
    page.locator(".roll-turn", { hasText: /^Turn: Red$/ }),
  ).toBeVisible({ timeout: 10000 });
  await expect(roll).toBeEnabled();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByLabel("Practice with bot", { exact: true }),
  ).toBeChecked();
});
