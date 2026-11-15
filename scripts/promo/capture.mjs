// Captures raw Persian app screens and screen recordings for the Cafe Bazaar
// promo screenshots and clip, from the Expo web build (see store-screenshots.mjs
// for how to serve it with a local edge Worker).
//   node scripts/promo/capture.mjs <out dir> [chromium path]
// Writes <out>/shots/<name>.png and <out>/clips/<name>/<n>.jpg + frames.json.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const URL = process.env.APP_URL ?? "http://localhost:3411/";
const OUT = process.argv[2];
const VIEW = { width: 400, height: 780 };
const SCALE = 2.7;
mkdirSync(join(OUT, "shots"), { recursive: true });

const browser = await chromium.launch(
  process.argv[3] ? { executablePath: process.argv[3] } : {},
);

async function open() {
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: SCALE });
  await page.goto(URL);
  // The daily reward opens once the wallet loads; take it so the wallet shows coins.
  const later = page.getByText(/^بعداً$/).first();
  await later.waitFor({ timeout: 20000 }).catch(() => {});
  if (await later.count()) {
    await page.getByText(/^بگیر/).first().click();
    await page.waitForTimeout(900);
  }
  return page;
}

// Screen recording through the DevTools screencast: sharp frames at device pixels.
async function record(page, name, action) {
  const dir = join(OUT, "clips", name);
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const file = `${String(frames.length).padStart(5, "0")}.jpg`;
    writeFileSync(join(dir, file), Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92 });
  const start = Date.now() / 1000;
  await action();
  const end = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  writeFileSync(join(dir, "frames.json"), JSON.stringify({ start, end, frames }));
  console.log(name, frames.length, "frames", (end - start).toFixed(1), "s");
}

async function startBotGame(page) {
  await page.getByText("بازی آفلاین با دوستان یا ربات").first().click();
  await page.waitForTimeout(1200);
  await page.getByLabel("تنظیمات").first().click();
  await page.waitForTimeout(500);
  await page.getByText("۴ نفر", { exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByText("بازی با ربات", { exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByText("بازی تازه", { exact: true }).click();
  await page.waitForTimeout(800);
}

async function playTurns(page, seconds) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    await page.getByLabel("تاس بریز").click({ timeout: 400 }).catch(() => {});
    await page.waitForTimeout(700);
    const pawns = page.getByLabel(/^قرمز مهره \d/);
    const n = await pawns.count();
    for (let k = 0; k < n; k++) {
      if (await pawns.nth(k).click({ timeout: 120 }).then(() => true, () => false)) break;
    }
    await page.waitForTimeout(400);
  }
}

const shot = (page, name) => page.screenshot({ path: join(OUT, "shots", `${name}.png`) });

// Home
let page = await open();
await page.waitForTimeout(1500);
await shot(page, "home");
await record(page, "home", () => page.waitForTimeout(3500));
await page.close();

// Four-player game against the bots
page = await open();
await startBotGame(page);
await playTurns(page, 50); // get pawns out on the board first
await record(page, "game", () => playTurns(page, 16));
await shot(page, "game");
await page.close();

// Shop: boards, then dice
page = await open();
await page.getByLabel(/^فروشگاه/).first().click();
await page.waitForTimeout(1500);
await shot(page, "shop-boards");
await record(page, "shop", async () => {
  await page.waitForTimeout(800);
  await page.getByText("تاس‌ها", { exact: true }).first().click();
  await page.waitForTimeout(1500);
  await page.mouse.move(200, 600);
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 60);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(1600);
});
await shot(page, "shop-dice-scrolled");
await page.mouse.wheel(0, -2000);
await page.waitForTimeout(800);
await shot(page, "shop-dice");
await page.close();

// Free coins
page = await open();
await record(page, "free", async () => {
  await page.waitForTimeout(600);
  await page.getByLabel("سکهٔ رایگان").first().click();
  await page.waitForTimeout(2600);
});
await shot(page, "free");
await page.close();

// Online with friends: create a room with an invite
page = await open();
await record(page, "friends", async () => {
  await page.waitForTimeout(500);
  await page.getByText("بازی آنلاین با دوستان", { exact: true }).first().click();
  await page.waitForTimeout(1200);
  await page.getByText("ساخت اتاق", { exact: true }).first().click();
  await page.waitForTimeout(3000);
});
await shot(page, "friends");
await page.close();

await browser.close();
