import { expect, test } from "@playwright/test";
test("production PWA has manifest, activated worker and offline local gameplay", async ({
  page,
  context,
}) => {
  await page.goto("http://127.0.0.1:4173");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  const manifest = await page.evaluate(async () => {
    const r = await fetch("/manifest.webmanifest");
    return r.json() as Promise<{ display: string; icons: unknown[] }>;
  });
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(2);
  await page.getByRole("button", { name: "English", exact: true }).click();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "Roll dice", exact: true }).click();
  await expect(page.locator(".dice")).toContainText(/[1-6]/);
  await context.setOffline(false);
});
