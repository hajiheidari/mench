import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { mkdir, access } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
await build({
  entryPoints: [resolve(root, "packages/board-geometry/src/index.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: "/tmp/mench-game-art.mjs",
});
const { boardSvg, pawnSvg, backdropSvg, avatarSvg } =
  await import("file:///tmp/mench-game-art.mjs");
const target = resolve(root, "apps/mobile/assets/game");
await mkdir(target, { recursive: true });
const systemBrowser = await access("/usr/bin/chromium").then(
  () => true,
  () => false,
);
const browser = await chromium.launch(
  systemBrowser ? { executablePath: "/usr/bin/chromium" } : {},
);
try {
  for (const [name, svg, width, height] of [
    ["board", boardSvg(), 1200, 1200],
    ["backdrop", backdropSvg(), 900, 1600],
    ...[0, 1, 2, 3].map((seat) => [`pawn-${seat}`, pawnSvg(seat), 160, 200]),
    ...[0, 1, 2, 3].map((seat) => [
      `avatar-${seat}`,
      avatarSvg(seat),
      160,
      160,
    ]),
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(`<style>body{margin:0}</style>${svg}`);
    await page.locator("svg").screenshot({
      path: resolve(target, `${name}.png`),
      omitBackground: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(
  "Generated shared board, pawn and backdrop artwork for native clients.",
);
