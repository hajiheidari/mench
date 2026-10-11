import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(
  "node_modules/.cache/ms-playwright",
);
const chromium =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
// The production edge build (VITE_BACKEND=edge) served by `wrangler dev`:
// the same Worker, Durable Object and static files that deploy to mench.espadna.com.
export default defineConfig({
  testDir: "tests/edge",
  timeout: 600000,
  use: {
    baseURL: "http://127.0.0.1:8787",
    launchOptions: chromium ? { executablePath: chromium } : {},
  },
  webServer: [
    {
      command:
        "VITE_BACKEND=edge npm run build -w @mench/web && npm run dev -w @mench/edge -- --port 8787 --ip 127.0.0.1 --var ALLOWED_ORIGINS:http://127.0.0.1:3200",
      url: "http://127.0.0.1:8787/healthz",
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
    },
    {
      // The Expo client (same App.tsx as Android/iOS) built for web, pointed at the edge server.
      command:
        "cd apps/mobile && CI=1 EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_BACKEND=edge EXPO_PUBLIC_API_URL=http://127.0.0.1:8787 npx expo export --platform web --clear && cd ../.. && python3 -m http.server 3200 --directory apps/mobile/dist --bind 127.0.0.1",
      url: "http://127.0.0.1:3200",
      reuseExistingServer: !process.env.CI,
      timeout: 300000,
    },
  ],
});
