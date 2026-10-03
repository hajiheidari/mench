import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
test("email account survives reload, signs out and supports deletion", async ({
  page,
}) => {
  const email = `browser-${randomUUID()}@example.com`;
  const password = "test-passphrase-12345";
  await page.goto("/");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByLabel("Display name").fill("BrowserTest");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(
    page.getByText("Account created. You can now sign in."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Your account", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Your account", { exact: true })).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill(password);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
