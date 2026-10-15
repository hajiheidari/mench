// App Store screenshots (iPhone 6.9"/6.7" and iPad 13") from the Expo web
// build of the app, framed with a headline.
//   EXPO_PUBLIC_BACKEND=edge EXPO_PUBLIC_STORE_SCREENSHOTS=1 \
//     npx expo export --platform web --clear --output-dir <dir>
//   python3 -m http.server 3411 -d <dir>
//   node scripts/store-screenshots.mjs [chromium path]
// Writes apps/mobile/store/screenshots/{iphone-67,ipad-13}-N.png.
// STORE=bazaar writes Persian 1080×2160 shots to apps/mobile/store/bazaar/.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL = process.env.APP_URL ?? "http://localhost:3411/";
const BAZAAR = process.env.STORE === "bazaar";
const OUT = BAZAAR ? "apps/mobile/store/bazaar" : "apps/mobile/store/screenshots";
const DEVICES = BAZAAR
  ? [{ name: "bazaar", canvas: [1080, 2160], viewport: [390, 760], scale: 2.5 }]
  : [
  // Canvas size App Store Connect expects; the app is drawn at viewport × scale.
  {
    name: "iphone-67",
    canvas: [1290, 2796],
    viewport: [390, 800],
    scale: 2.75,
  },
  { name: "ipad-13", canvas: [2048, 2732], viewport: [860, 1100], scale: 2.1 },
];
const L = BAZAAR
  ? {
      practice: "بازی آفلاین با دوستان یا ربات",
      roll: "تاس بریز",
      pawn: /مهره/,
      shop: /^فروشگاه/,
      menu: "منو",
      free: "سکهٔ رایگان",
    }
  : {
      practice: "Offline with friends or the bot",
      roll: "Roll dice",
      pawn: /pawn/i,
      shop: /^Shop/,
      menu: "Menu",
      free: "Free coins",
    };
const SHOTS = BAZAAR
  ? [
      ["منچ کلاسیک", "چهار رنگ آشنا، یک بازی دوستانه", "home"],
      ["بازی آفلاین", "با دوستان یا ربات، حتی بدون اینترنت", "offline"],
      ["طرح‌های ایرانی", "صفحه، مهره و تاس‌های خاص با سکه", "shop"],
      ["سکهٔ رایگان هر روز", "جایزهٔ روزانه، بردن بازی و دیدن تبلیغ", "free"],
      ["تاس‌های خاص", "کهکشان، مرمر سبز، تراورتن، لاجورد و…", "dice"],
    ]
  : [
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
    await daily.waitFor({ timeout: 20000 }).catch(() => {});
    if (await daily.count()) {
      // Bazaar shots take the daily coins so the wallet shows 20.
      if (BAZAAR) await page.getByText(/^بگیر/).first().click();
      else await daily.click();
      await page.waitForTimeout(800);
    }
    if (!BAZAAR) {
      await page
        .getByLabel(/^(منو|Menu)$/)
        .first()
        .click();
      await page.getByText("English", { exact: true }).click();
      await page.getByText("Close", { exact: true }).click();
      await page.waitForTimeout(400);
    }
    if (screen === "offline") {
      await page.getByText(L.practice).first().click();
      await page.waitForTimeout(800);
      for (let i = 0; i < (BAZAAR ? 14 : 6); i++) {
        await page
          .getByText(L.roll, { exact: true })
          .click({ timeout: 1000 })
          .catch(() => {});
        await page.waitForTimeout(500);
        const pawn = page.getByLabel(L.pawn).first();
        if (await pawn.count())
          await pawn.click({ timeout: 500 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    } else if (screen === "shop") {
      await page.getByLabel(L.shop).first().click();
      await page.waitForTimeout(1200);
    } else if (screen === "dice") {
      await page.getByLabel(L.shop).first().click();
      await page.waitForTimeout(1000);
      await page.getByText("تاس‌ها", { exact: true }).first().click();
      await page.waitForTimeout(1500);
    } else if (screen === "menu") {
      await page.getByLabel(L.menu).first().click();
      await page.waitForTimeout(600);
    } else if (screen === "free") {
      await page.getByLabel(L.free).first().click();
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
