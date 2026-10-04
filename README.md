# Mench

An original cross-platform Ludo project. Playable local and authoritative online Ludo, shared web/PWA and Expo client, accounts, friends and ranked two-player matches. Native delivery and production hardening remain in progress.

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
