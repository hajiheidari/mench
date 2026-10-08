# Mench

An original cross-platform Ludo project. Playable local and authoritative online Ludo, shared web/PWA and Expo client, accounts, friends, rankings, earned cosmetics, bots, basic tournaments, moderation and completed-game replays. Local hardening checks pass; native delivery and public release remain unfinished.

## Start

Use Node 24.19.0 and npm 11.9.0. From the checkout root:

```sh
npm ci
npm run check
CI=1 npm run build:mobile
docker compose up -d postgres
npm run dev:api
# In another terminal:
npm run dev:web
# Optional mobile development:
npm run dev:mobile
```

API port 3001: GET /health returns versioned JSON. Web port 5173. Expo supports Android/iOS/web; native distribution is a later milestone and requires platform SDKs/signing. PostgreSQL is required; localhost development credentials are documented in compose.yaml. Production requires secure configuration.

```sh
docker compose up --build
# Optional Redis:
docker compose --profile data up -d postgres redis
```

Docker serves the same source snapshot; rebuild after changes. PostgreSQL stores accounts, social relationships, room recovery and ranked results. Local database password is development-only. Do not expose these services publicly.

See docs/PROJECT_STATUS.md, docs/ARCHITECTURE.md and AGENTS.md.

Run npm run test:db with PostgreSQL, npm run test:e2e and npm run test:platforms for integration acceptance. See [hardening evidence](docs/HARDENING.md), [release constraints](docs/KNOWN_ISSUES.md) and [native/store preparation](docs/STORE_READINESS.md). compose.production.yaml is a reviewable single-instance HTTPS template requiring real secret files/domain; it has not been deployed.

Android development APK and generated iOS project archive are available under /workspace/mench-artifacts; checksums and exact limits are in docs/NATIVE_BUILD_REPORT.json. Android compilation is verified; native device execution and iOS compilation are still pending.
