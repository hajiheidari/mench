import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(
  "node_modules/.cache/ms-playwright",
);
const chromium =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
// Live acceptance against the deployed game: real rooms on the production Durable Object.
export default defineConfig({
  testDir: "tests/edge",
  testMatch: "online.spec.ts",
  timeout: 600000,
  retries: 1,
  use: {
    baseURL: process.env.MENCH_URL ?? "https://mench.espadna.com",
    launchOptions: chromium ? { executablePath: chromium } : {},
  },
});
