import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(
  "node_modules/.cache/ms-playwright",
);
export default defineConfig({
  testDir: "tests/platforms",
  timeout: 90000,
  workers: 1,
  use: {
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
      command:
        "npm exec -w @mench/web -- vite preview --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
    },
    {
      command:
        "python -m http.server 3200 --directory apps/mobile/dist --bind 127.0.0.1",
      url: "http://127.0.0.1:3200",
      reuseExistingServer: false,
    },
  ],
});
