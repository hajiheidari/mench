# Mench

An original cross-platform Ludo project. Current scope: M0 foundation, not a playable game.

## Start

Use Node 24.19.0 and npm 11.9.0. From the checkout root:

```sh
npm ci
npm run check
CI=1 npm run build:mobile
npm run dev:api
# In another terminal:
npm run dev:web
# Optional mobile development:
npm run dev:mobile
```

API port 3001: GET /health returns versioned JSON. Web port 5173. Expo supports Android/iOS/web; native distribution is a later milestone and requires platform SDKs/signing. No credentials needed for M0.

```sh
docker compose up --build
# Optional future storage dependencies:
docker compose --profile data up -d postgres redis
```

Docker serves the same source snapshot; rebuild after changes. Data services are deliberately not dependencies of M0. Local database password is development-only. Do not expose these services publicly.

See docs/PROJECT_STATUS.md, docs/ARCHITECTURE.md and AGENTS.md.
