import { expect, test, type Page } from "@playwright/test";

// The Expo client runs the same App.tsx as the Android/iOS apps (react-native-web here).
const MOBILE = "http://127.0.0.1:3200";

async function step(page: Page, native: boolean) {
  const roll = page.getByRole("button", { name: "Roll dice", exact: true });
  if (native) {
    if (
      (await roll.count()) &&
      (await roll.getAttribute("aria-disabled")) !== "true"
    )
      return roll.click({ timeout: 2000 }).catch(() => undefined);
    const pawn = page
      .getByRole("button", { name: /Pawn \d$/ })
      .and(page.locator(':not([aria-disabled="true"])'))
      .first();
    if (await pawn.count())
      await pawn
        .evaluate((el: HTMLElement) => el.click())
        .catch(() => undefined);
    return;
  }
  if (await roll.isEnabled())
    return roll.click({ timeout: 2000 }).catch(() => undefined);
  const pawn = page.locator(".pawn.legal:enabled").first();
  if (await pawn.count())
    await pawn
      .evaluate((el: HTMLButtonElement) => el.click())
      .catch(() => undefined);
}

test("web host and app guest finish a match; the app shows the native result popup", async ({
  browser,
}) => {
  const webContext = await browser.newContext();
  const appContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const web = await webContext.newPage();
  const app = await appContext.newPage();
  try {
    await web.goto("/?lang=en");
    await web
      .getByRole("button", { name: "Play with friends", exact: true })
      .click();
    await web.getByLabel("Display name").fill("Desktop");
    await web.getByRole("button", { name: "Create room", exact: true }).click();
    const code = await web.getByTestId("room-code").innerText();

    await app.goto(MOBILE);
    // The app's language switch lives in the home menu.
    await app.getByRole("button", { name: "منو", exact: true }).click();
    await app.getByRole("button", { name: "English", exact: true }).click();
    await app.getByRole("button", { name: "Close", exact: true }).click();
    await expect(
      app.getByRole("button", { name: "Account", exact: true }),
    ).toHaveCount(0);
    await app
      .getByRole("button", { name: "Play with friends", exact: true })
      .click();
    await expect(app.getByText("Connected", { exact: true })).toBeVisible();
    await app.getByLabel("Display name", { exact: true }).fill("Phone");
    await app.getByLabel("Room code", { exact: true }).fill(code);
    await app.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(web.getByText("Phone", { exact: true })).toBeVisible();
    await web.getByRole("button", { name: "Start game", exact: true }).click();
    await expect(
      app.getByText("Turn: Red · Desktop", { exact: true }),
    ).toBeVisible();

    const appResult = app.getByRole("alert", {
      name: /Winner: \S+ · (Desktop|Phone)/,
    });
    const webResult = web.getByRole("dialog");
    for (let i = 0; i < 20000; i++) {
      if ((await appResult.count()) && (await webResult.isVisible())) break;
      await step(web, false);
      await step(app, true);
    }
    await expect(webResult).toBeVisible();
    await expect(appResult).toBeVisible();
    const label = (await appResult.getAttribute("aria-label")) ?? "";
    const winner = /Winner: \S+ · (Desktop|Phone)/.exec(label)![1]!;
    await expect(webResult).toContainText(winner);
    expect(label.startsWith("Congratulations! You won")).toBe(
      winner === "Phone",
    );
    // Finished state accepts no further input on the app.
    await app.getByRole("button", { name: "View board", exact: true }).click();
    await expect(
      app.getByRole("button", { name: "Roll dice", exact: true }),
    ).toHaveAttribute("aria-disabled", "true");
  } finally {
    await webContext.close();
    await appContext.close();
  }
});

test("app practice ends with the native result popup and restarts cleanly", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const app = await context.newPage();
  try {
    await app.goto(MOBILE);
    // The app's language switch lives in the home menu.
    await app.getByRole("button", { name: "منو", exact: true }).click();
    await app.getByRole("button", { name: "English", exact: true }).click();
    await app.getByRole("button", { name: "Close", exact: true }).click();
    await app
      .getByRole("button", { name: "Play on one device", exact: true })
      .click();
    const result = app.getByRole("alert", { name: /^Game over\. Winner: / });
    for (let i = 0; i < 20000 && !(await result.count()); i++)
      await step(app, true);
    await expect(result).toBeVisible();
    await app.getByRole("button", { name: "Play again", exact: true }).click();
    await expect(result).toHaveCount(0);
    await expect(app.getByText("Turn: Red", { exact: true })).toBeVisible();
    await expect(
      app.getByRole("button", { name: "Roll dice", exact: true }),
    ).not.toHaveAttribute("aria-disabled", "true");
  } finally {
    await context.close();
  }
});
