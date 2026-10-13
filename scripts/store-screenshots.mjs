// App Store screenshots (iPhone 6.9"/6.7" and iPad 13") from the Expo web
// build of the app, framed with a headline.
//   EXPO_PUBLIC_BACKEND=edge EXPO_PUBLIC_STORE_SCREENSHOTS=1 \
//     npx expo export --platform web --clear --output-dir <dir>
//   python3 -m http.server 3411 -d <dir>
//   node scripts/store-screenshots.mjs [chromium path]
// Writes apps/mobile/store/screenshots/{iphone-67,ipad-13}-N.png.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL = process.env.APP_URL ?? "http://localhost:3411/";
const OUT = "apps/mobile/store/screenshots";
const DEVICES = [
  // Canvas size App Store Connect expects; the app is drawn at viewport × scale.
  {
    name: "iphone-67",
    canvas: [1290, 2796],
    viewport: [390, 800],
    scale: 2.75,
  },
  { name: "ipad-13", canvas: [2048, 2732], viewport: [860, 1100], scale: 2.1 },
];
const SHOTS = [
  ["Classic Ludo", "Four colors, one friendly game", "home"],
  ["Play offline", "With friends or the bot, even without internet", "offline"],
  ["Persian craft designs", "Boards, pawns and dice for your coins", "shop"],
  ["Free coins every day", "Daily reward, won games and optional ads", "free"],
  ["Simple and fair", "Verifiable online dice, no sign-up", "menu"],
];

const browser = await chromium.launch(
  process.argv[2] ? { executablePath: process.argv[2] } : {},
);
const work = mkdtempSync(join(tmpdir(), "shots-"));
for (const device of DEVICES) {
  for (const [index, [title, subtitle, screen]] of SHOTS.entries()) {
    const page = await browser.newPage({
      viewport: { width: device.viewport[0], height: device.viewport[1] },
      deviceScaleFactor: device.scale,
    });
    await page.goto(URL);
    await page.waitForTimeout(3000);
    // English through the menu (the app's own language switch).
    // The daily-coins popup opens once the wallet loads; close it first.
    const daily = page.getByText(/^(Later|بعداً)$/).first();
    await daily.waitFor({ timeout: 8000 }).catch(() => {});
    if (await daily.count()) await daily.click();
    await page
      .getByLabel(/^(منو|Menu)$/)
      .first()
      .click();
    await page.getByText("English", { exact: true }).click();
    await page.getByText("Close", { exact: true }).click();
    await page.waitForTimeout(400);
    if (screen === "offline") {
      await page.getByText("Offline with friends or the bot").first().click();
      await page.waitForTimeout(800);
      for (let i = 0; i < 6; i++) {
        await page
          .getByText("Roll dice", { exact: true })
          .click({ timeout: 1000 })
          .catch(() => {});
        await page.waitForTimeout(500);
        const pawn = page.getByLabel(/pawn/i).first();
        if (await pawn.count())
          await pawn.click({ timeout: 500 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    } else if (screen === "shop") {
      await page.getByLabel(/^Shop/).first().click();
      await page.waitForTimeout(1200);
    } else if (screen === "menu") {
      await page.getByLabel("Menu").first().click();
      await page.waitForTimeout(600);
    } else if (screen === "free") {
      await page.getByLabel("Free coins").first().click();
      await page.waitForTimeout(1000);
    }
    const file = join(work, `${device.name}-${index + 1}.png`);
    await page.screenshot({ path: file });
    await page.close();
    execFileSync("python3", [
      "scripts/frame-screenshot.py",
      file,
      join(OUT, `${device.name}-${index + 1}.png`),
      String(device.canvas[0]),
      String(device.canvas[1]),
      title,
      subtitle,
    ]);
    console.log(`${device.name}-${index + 1}`, readFileSync(file).length);
  }
}
await browser.close();
