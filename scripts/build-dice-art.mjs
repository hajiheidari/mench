// Renders the dice face textures (packages/board-geometry/src/dice-art.ts)
// to apps/mobile/assets/game/dice-<skin>.png for the native apps; the web
// draws the same SVG directly.
//   node scripts/build-dice-art.mjs   (PLAYWRIGHT_CHROMIUM_EXECUTABLE optional)
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
await build({
  entryPoints: [resolve(root, "packages/board-geometry/src/index.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: "/tmp/mench-dice-art.mjs",
});
const { diceFaceSvg, DICE_SKINS } =
  await import("file:///tmp/mench-dice-art.mjs");
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  for (const skin of DICE_SKINS) {
    const svg = diceFaceSvg(skin);
    if (!svg) continue;
    const page = await browser.newPage({
      viewport: { width: 200, height: 200 },
      deviceScaleFactor: 1.5,
    });
    await page.setContent(`<style>body{margin:0}</style>${svg}`);
    await page.locator("svg").screenshot({
      path: resolve(root, `apps/mobile/assets/game/dice-${skin}.png`),
    });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log("Dice textures written to apps/mobile/assets/game/dice-*.png");
