import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(
  "node_modules/.cache/ms-playwright",
);
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120000,
  // The tournament test drives four browsers; parallel workers starve slow CI runners.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: "http://127.0.0.1:5173",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : existsSync("/usr/bin/chromium")
        ? { executablePath: "/usr/bin/chromium" }
        : {},
  },
  webServer: [
    {
      command: "npm run dev:api",
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev:web",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
