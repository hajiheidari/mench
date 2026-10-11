import { expect, test } from "@playwright/test";
test("invite link, authoritative online start, verify roll and reload reconnect", async ({
  browser,
}) => {
  const ca = await browser.newContext();
  const cb = await browser.newContext();
  const a = await ca.newPage();
  const b = await cb.newPage();
  try {
    await a.goto("/");
    await a.getByRole("button", { name: "English", exact: true }).click();
    await a
      .getByRole("button", { name: "Play with friends", exact: true })
      .click();
    await a.getByLabel("Display name").fill("Alpha");
    await a.getByRole("button", { name: "Create room" }).click();
    const code = await a.getByTestId("room-code").innerText();
    await b.goto(`/join/${code}`);
    await b.getByRole("button", { name: "English", exact: true }).click();
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
    await a.reload();
    await a.getByRole("button", { name: "English", exact: true }).click();
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
