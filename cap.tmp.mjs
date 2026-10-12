import { chromium } from "@playwright/test";
const OUT = "/tmp/claude-0/store";
const APP = "http://127.0.0.1:3200";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function step(page) {
  const roll = page.getByRole("button", { name: "Roll dice", exact: true });
  if ((await roll.count()) && (await roll.getAttribute("aria-disabled")) !== "true")
    return roll.click({ timeout: 2000 }).catch(() => undefined);
  const pawn = page.getByRole("button", { name: /Pawn \d$/ }).and(page.locator(':not([aria-disabled="true"])')).first();
  if (await pawn.count()) await pawn.evaluate((el) => el.click()).catch(() => undefined);
  else await page.waitForTimeout(100);
}
async function english(page) {
  await page.goto(APP);
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "منو", exact: true }).click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.waitForTimeout(300);
}
for (const [kind, vp, dpr] of [["phone", { width: 430, height: 932 }, 3], ["ipad", { width: 1024, height: 1366 }, 2]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr, timezoneId: "Europe/Berlin" });
  await ctx.addInitScript(() => sessionStorage.setItem("mench-name", "Lena"));
  const p = await ctx.newPage();
  await english(p);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/${kind}-1-home.png` });
  // Practice: four players, mid-game
  await p.getByRole("button", { name: "Play on one device", exact: true }).click();
  await p.getByRole("button", { name: "Settings", exact: true }).click();
  await p.getByRole("button", { name: "4 players", exact: true }).click();
  await p.getByRole("button", { name: "Close", exact: true }).click();
  for (let i = 0; i < 260; i++) await step(p);
  for (let i = 0; i < 40; i++) {
    const roll = p.getByRole("button", { name: "Roll dice", exact: true });
    if ((await roll.getAttribute("aria-disabled")) !== "true") break;
    await step(p);
  }
  await p.screenshot({ path: `${OUT}/${kind}-2-game.png` });
  await p.getByRole("button", { name: "Back", exact: true }).click();
  // Menu with how to play
  await p.getByRole("button", { name: "Menu", exact: true }).click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/${kind}-5-menu.png` });
  await p.getByRole("button", { name: "Close", exact: true }).click();
  // Friends: waiting room with code
  await p.getByRole("button", { name: "Play with friends", exact: true }).click();
  await p.getByText("Connected", { exact: true }).waitFor({ timeout: 15000 });
  await p.getByLabel("Display name", { exact: true }).fill("Lena");
  await p.getByRole("button", { name: "Create room", exact: true }).click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/${kind}-4-friends.png` });
  await p.getByRole("button", { name: "Leave", exact: true }).click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "Back", exact: true }).click();
  // Competitive online (computer fallback when nobody is searching)
  await p.getByRole("button", { name: /Quick online game|Competitive/ }).first().click();
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${OUT}/${kind}-3a-search.png` });
  await p.getByRole("button", { name: "Roll dice", exact: true }).waitFor({ timeout: 30000 });
  for (let i = 0; i < 120; i++) await step(p);
  await p.screenshot({ path: `${OUT}/${kind}-3-online.png` });
  await ctx.close();
}
await b.close();
