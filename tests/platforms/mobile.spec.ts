import { expect, test } from "@playwright/test";
test("Expo browser client joins a desktop private match using shared protocol", async ({
  browser,
}) => {
  const webContext = await browser.newContext();
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const web = await webContext.newPage();
  const mobile = await mobileContext.newPage();
  try {
    await web.goto("http://127.0.0.1:4173");
    await web.getByRole("button", { name: "English", exact: true }).click();
    await web.getByRole("button", { name: "Play online", exact: true }).click();
    await web.getByLabel("Display name").fill("Desktop");
    await web.getByRole("button", { name: "Create room", exact: true }).click();
    const code = await web.getByTestId("room-code").innerText();
    await mobile.goto("http://127.0.0.1:3200");
    await mobile.getByRole("button", { name: "English", exact: true }).click();
    await mobile
      .getByRole("button", { name: "Play online", exact: true })
      .click();
    await mobile.getByLabel("Display name", { exact: true }).fill("Mobile");
    await mobile.getByLabel("Room code", { exact: true }).fill(code);
    await mobile
      .getByRole("button", { name: "Join room", exact: true })
      .click();
    await expect(web.getByText("Mobile", { exact: true })).toBeVisible();
    await web.getByRole("button", { name: "Start game", exact: true }).click();
    await expect(
      mobile.getByText("Turn: Desktop", { exact: true }),
    ).toBeVisible();
    await expect(
      mobile.getByRole("button", { name: "Roll dice", exact: true }),
    ).toBeDisabled();
    await web.getByRole("button", { name: "Roll dice", exact: true }).click();
    await expect(
      mobile.getByRole("button", { name: "Verify roll", exact: true }),
    ).toBeVisible();
    await mobile
      .getByRole("button", { name: "Verify roll", exact: true })
      .click();
    await expect(
      mobile.getByText("Roll verified", { exact: true }),
    ).toBeVisible();
  } finally {
    await webContext.close();
    await mobileContext.close();
  }
});
