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
  await page.getByLabel("Practice with bot", { exact: true }).check();
  await page.getByLabel("Bot difficulty", { exact: true }).selectOption("hard");
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
    page.getByRole("heading", { name: "Turn: Red", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(roll).toBeEnabled();
  await expect(
    page.getByLabel("Practice with bot", { exact: true }),
  ).toBeChecked();
});
