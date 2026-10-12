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
const {
  boardSvg,
  pawnSvg,
  backdropSvg,
  avatarSvg,
  iconSvg,
  BOARD_THEMES,
  PAWN_SETS,
} = await import("file:///tmp/mench-game-art.mjs");
const target = resolve(root, "apps/mobile/assets/game");
await mkdir(target, { recursive: true });
const systemBrowser = await access("/usr/bin/chromium").then(
  () => true,
  () => false,
);
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  (systemBrowser ? "/usr/bin/chromium" : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  for (const [name, svg, width, height] of [
    ["board", boardSvg(), 1200, 1200],
    ["backdrop", backdropSvg(), 900, 1600],
    ...[0, 1, 2, 3].map((seat) => [`pawn-${seat}`, pawnSvg(seat), 160, 200]),
    // Shop designs (the classic ones above keep their original names).
    ...BOARD_THEMES.filter((t) => t !== "classic").map((t) => [
      `board-${t}`,
      boardSvg(t),
      1200,
      1200,
    ]),
    ...PAWN_SETS.filter((s) => s !== "classic").flatMap((set) =>
      [0, 1, 2, 3].map((seat) => [
        `pawn-${set}-${seat}`,
        pawnSvg(seat, set),
        160,
        200,
      ]),
    ),
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
  // App icons: opaque store/web icons and a transparent Android adaptive foreground.
  const icons = [
    ["apps/mobile/assets/icon.png", iconSvg(), 1024, false],
    ["apps/mobile/assets/adaptive-icon.png", iconSvg(true), 1024, true],
    ["apps/web/public/icon-512.png", iconSvg(), 512, false],
    ["apps/web/public/icon-192.png", iconSvg(), 192, false],
    ["apps/edge/site/mench-app/icon.png", iconSvg(), 512, false],
  ];
  for (const [file, svg, size, transparent] of icons) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
    });
    await page.setContent(
      `<style>body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`,
    );
    await page.locator("svg").screenshot({
      path: resolve(root, file),
      omitBackground: transparent,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(
  "Generated shared board, pawn and backdrop artwork for native clients.",
);
