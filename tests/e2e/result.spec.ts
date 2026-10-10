import { expect, test } from "@playwright/test";
for (const humanWins of [true, false]) {
  test(`bot match announces ${humanWins ? "human" : "bot"} winner and restarts from the result dialog`, async ({
    page,
  }) => {
    await page.addInitScript((humanWins) => {
      // Deterministic acceptance fixture only; production dice and bot timers stay unchanged.
      let rolls = 0;
      const nativeTimeout = window.setTimeout.bind(window);
      window.setTimeout = ((
        handler: TimerHandler,
        timeout?: number,
        ...args: unknown[]
      ) =>
        nativeTimeout(
          handler,
          timeout === 450 ? 0 : timeout,
          ...args,
        )) as typeof window.setTimeout;
      Object.defineProperty(crypto, "getRandomValues", {
        value: (array: Uint8Array | Uint32Array) => {
          if (array instanceof Uint8Array) {
            const humanTurn =
              document
                .querySelector(".panel h2")
                ?.textContent?.includes("Red") ?? false;
            array[0] =
              humanTurn === humanWins ? (++rolls % 3 === 0 ? 0 : 5) : 0;
          } else array[0] = 0;
          return array;
        },
      });
    }, humanWins);
    await page.goto("/");
    await page.getByRole("button", { name: "English", exact: true }).click();
    await page.getByRole("checkbox").check();
    const title = humanWins
      ? "Congratulations! You won"
      : "Your opponent won this time";
    const result = page.getByRole("dialog", { name: title, exact: true });
    for (let step = 0; step < 5000; step++) {
      if (await result.isVisible()) break;
      const roll = page.getByRole("button", { name: "Roll dice", exact: true });
      if (await roll.isEnabled()) await roll.click();
      else {
        const pawn = page.locator(".pawn.legal").first();
        if ((await pawn.count()) && (await pawn.isEnabled()))
          await pawn.click();
      }
    }
    await expect(result).toBeVisible();
    await expect(result).toContainText(humanWins ? "Red" : "Bot");
    await result
      .getByRole("button", { name: "Play again", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Turn: Red", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Roll dice", exact: true }),
    ).toBeEnabled();
  });
}
