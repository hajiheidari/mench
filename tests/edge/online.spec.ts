import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function english(page: Page, path: string) {
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}lang=en`);
}

test("invite link, start, verified roll, network loss and reload resume on the edge server", async ({
  browser,
}) => {
  const ca = await browser.newContext();
  const cb = await browser.newContext();
  const a = await ca.newPage();
  const b = await cb.newPage();
  try {
    await english(a, "/");
    await expect(
      a.getByRole("button", { name: "Account", exact: true }),
    ).toHaveCount(0);
    await a
      .getByRole("button", { name: "Play with friends", exact: true })
      .click();
    await expect(a.getByText("Connected", { exact: true })).toBeVisible();
    await expect(a.getByText("Ranked", { exact: true })).toHaveCount(0);
    await a.getByLabel("Display name").fill("Alpha");
    await a.getByRole("button", { name: "Create room" }).click();
    const code = await a.getByTestId("room-code").innerText();
    await english(b, `/join/${code}`);
    await b.getByLabel("Display name").fill("Beta");
    await b.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(a.getByText("Beta", { exact: true })).toBeVisible();
    await a.getByRole("button", { name: "Start game" }).click();
    await expect(a.locator(".board")).toBeVisible();
    await expect(b.locator(".board")).toBeVisible();
    await expect(b.getByRole("button", { name: "Roll dice" })).toBeDisabled();
    await a.getByRole("button", { name: "Roll dice" }).click();
    await a.getByRole("button", { name: /^Dice history/ }).click();
    await a.getByRole("button", { name: "Verify roll" }).click();
    await expect(
      a.getByText("Roll verified", { exact: true }).first(),
    ).toBeVisible();
    await a.getByRole("button", { name: "Close", exact: true }).click();

    // Guest loses the network, then comes back: same seat, same game.
    await cb.setOffline(true);
    await b.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(b.getByText("Reconnecting", { exact: true })).toBeVisible({
      timeout: 40000,
    });
    await cb.setOffline(false);
    await b.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(b.getByText("Connected", { exact: true })).toBeVisible({
      timeout: 40000,
    });
    await expect(
      b.getByRole("button", { name: "Dice history (1)", exact: true }),
    ).toBeVisible();

    await a.reload();
    await a
      .getByRole("button", { name: "Play with friends", exact: true })
      .click();
    await expect(a.locator(".board")).toBeVisible();
    await expect(a.getByText("Connected", { exact: true })).toBeVisible();
    await expect(
      a.getByRole("button", { name: "Dice history (1)", exact: true }),
    ).toBeVisible();
  } finally {
    await ca.close();
    await cb.close();
  }
});

test("three players fill a room before the host can start", async ({
  browser,
}) => {
  const contexts = await Promise.all([1, 2, 3].map(() => browser.newContext()));
  const [a, b, c] = await Promise.all(contexts.map((x) => x.newPage()));
  try {
    await english(a!, "/");
    await a!
      .getByRole("button", { name: "Play with friends", exact: true })
      .click();
    await a!.getByLabel("Players").selectOption("3");
    await a!.getByRole("button", { name: "Create room" }).click();
    const code = await a!.getByTestId("room-code").innerText();
    const start = a!.getByRole("button", { name: "Start game" });
    await english(b!, `/join/${code}`);
    await b!.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(a!.locator(".player-card")).toHaveCount(2);
    await expect(start).toBeDisabled();
    await english(c!, `/join/${code}`);
    await c!.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(a!.locator(".player-card")).toHaveCount(3);
    await start.click();
    for (const page of [a!, b!, c!])
      await expect(page.locator(".board .pawn")).toHaveCount(12);
  } finally {
    await Promise.all(contexts.map((x) => x.close()));
  }
});

test("a full online match ends with the same winner dialog on both screens", async ({
  browser,
}) => {
  const ca = await browser.newContext();
  const cb = await browser.newContext();
  const a = await ca.newPage();
  const b = await cb.newPage();
  try {
    await english(a, "/");
    await a
      .getByRole("button", { name: "Play with friends", exact: true })
      .click();
    await a.getByLabel("Display name").fill("Alpha");
    await a.getByRole("button", { name: "Create room" }).click();
    const code = await a.getByTestId("room-code").innerText();
    await english(b, `/join/${code}`);
    await b.getByLabel("Display name").fill("Beta");
    await b.getByRole("button", { name: "Join room", exact: true }).click();
    await a.getByRole("button", { name: "Start game" }).click();
    const finished = (page: Page) => page.getByRole("dialog");
    for (let step = 0; step < 20000; step++) {
      if ((await finished(a).isVisible()) && (await finished(b).isVisible()))
        break;
      for (const page of [a, b]) {
        const roll = page.getByRole("button", {
          name: "Roll dice",
          exact: true,
        });
        if (await roll.isEnabled())
          await roll.click({ timeout: 2000 }).catch(() => undefined);
        else {
          const pawn = page.locator(".pawn.legal:enabled").first();
          // Stacked pawns overlap; press the legal one directly.
          if (await pawn.count())
            await pawn
              .evaluate((el: HTMLButtonElement) => el.click())
              .catch(() => undefined);
        }
      }
    }
    await expect(finished(a)).toBeVisible();
    await expect(finished(b)).toBeVisible();
    const won = async (page: Page) =>
      page
        .getByRole("dialog", { name: "Congratulations! You won", exact: true })
        .isVisible();
    // Exactly one side is congratulated.
    expect([await won(a), await won(b)].filter(Boolean)).toHaveLength(1);
    const winnerA = await finished(a).innerText();
    const winnerB = await finished(b).innerText();
    const name = /Alpha|Beta/.exec(winnerA)?.[0];
    expect(name).toBeTruthy();
    expect(winnerB).toContain(name!);
    // The server confirms the win and the winner's wallet gets the coins once.
    const [winner, loser] = (await won(a)) ? [a, b] : [b, a];
    await expect(winner.locator(".result-reward")).toHaveText(
      /\+10 coins for this win/,
    );
    await expect(loser.locator(".result-reward")).toHaveCount(0);
  } finally {
    await ca.close();
    await cb.close();
  }
});
