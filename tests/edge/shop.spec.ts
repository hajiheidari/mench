import { expect, test } from "@playwright/test";

test("daily coins, shop and designs survive a reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?lang=en");
  const daily = page.getByRole("dialog", { name: "Today's reward" });
  await expect(daily).toBeVisible();
  await daily.getByRole("button", { name: "Collect +50" }).click();
  await expect(daily).toBeHidden();
  const chip = page.locator(".coin-chip");
  await expect(chip).toContainText("50");
  await chip.click();
  // Boards are 250+ coins: not enough yet, and nothing is taken.
  await page.getByRole("button", { name: /^Buy Wooden 250 coins$/i }).click();
  await expect(page.getByRole("status")).toContainText("Not enough coins");
  await expect(page.locator(".shop-item.in-use")).toContainText("Classic");
  await expect(page.locator(".coin-chip")).toContainText("50");
  // Same wallet after a reload (stored on this device), and no second popup today.
  await page.goto("/?lang=en");
  await expect(page.locator(".coin-chip")).toContainText("50");
  await expect(daily).toBeHidden();
});
