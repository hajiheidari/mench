# Testing

From root: npm ci; npm run check (lint, formatting, strict typecheck across all workspaces, Vitest, web/API/shared builds); CI=1 npm run build:mobile (Expo Android/iOS/web bundle export). Export validates JS assets, not signed native binaries.

Source tests exercise engine, fairness, authoritative Socket.IO games, reconnect and API validation. Default test runs explicitly skip DB suites when TEST_DATABASE_URL is absent; run npm run test:db with PostgreSQL to execute real persistence/identity/social/ranking cases.

Runtime: start dev:api and request /health, assert JSON/status; start dev:web, request page and entry source; inspect actual server output. Docker: docker compose config, build, up and request the same health/page routes. Start PostgreSQL before API/E2E; Redis remains optional.

CI executes the same commands on Node .nvmrc. Local execution cannot establish GitHub Actions success; native device/store tests need separate tooling in M9/M17.

## Cloud Docker trust

The cloud proxy hostname is resolved on the host but not in Docker DNS. For this environment the image was built with --build-arg HTTP_PROXY, --build-arg HTTPS_PROXY, --build-arg NO_PROXY, --add-host for the existing proxy hostname/IP, and --secret id=ca,src pointing to the injected NODE_EXTRA_CA_CERTS file. Use DOCKER_CONFIG=/tmp/mench-docker for a writable Docker cache. Keep certificate files out of the checkout. The Dockerfile consumes the optional ca secret only during installation and keeps TLS verification enabled. Tag the image mench-api and mench-web, then docker compose up -d --no-build api web. No proxy credentials are copied to source or saved configuration.

M1: 25 engine tests passed, including full 2/3/4-player simulations. v8 coverage: 97.84% statements, 97.97% branches, 100% functions, 98.79% lines. Command: npm test -- packages/game-engine --coverage --coverage.include=packages/game-engine/src/index.ts.

M2: five tests passed; 100000-roll reproducible simulation and browser WebCrypto/server interoperability executed. Proof verification requires the independently observed commitment and client nonce; changing a nonce can coincidentally preserve the dice face, so checking the face alone is insufficient. Full lint/typecheck/tests/build passed.

M3: npm run test:e2e passed both real Chromium tests: full local two-player match and 4-player setup at 390px viewport. Playwright uses preinstalled /usr/bin/chromium when available; otherwise install with PLAYWRIGHT_BROWSERS_PATH=$PWD/node_modules/.cache/ms-playwright npx playwright install chromium.

M4/M5: real Socket.IO 2/4-client full games, proof verification, forged intent rejection, duplicate replay, live reconnect/session eviction and default rate-limit test passed. Fake clock 2/10/30s disconnect and 45s grace tested. E2E: invite link, online start, proof verification and reload restoration passed. Vitest config explicitly includes source tests to avoid accidentally counting generated dist tests.

M6: npm run test:db passed three real PostgreSQL tests covering repeat migration, registration/hash, duplicate input, login, cookie flags, private/public profile isolation, foreign Origin rejection, session revocation and password-confirmed deletion. Four Chromium E2E tests passed including registration/reload/logout/deletion. M8: real-client pairing/cancellation/auto-start passed.

## Current hardening acceptance

npm run test:db runs database files sequentially because the room authority supports one owning API process per database. Tests still exercise concurrent commands/transactions within each file. The default source test run intentionally skips these DB cases; it does not count skips as passes. Replay tests cover JSONB key ordering, proof/action binding and restart transitions; real shared-client tests cover cached lobby acknowledgements and admission limits. Nine Chromium E2E cases and two platform cases passed; privileged admin UI/device testing remains unclaimed.

Reproduce million-roll/load/backup measurements with commands in HARDENING.md. Private archives must remain outside Git. Production images were built and exercised with a temporary trusted TLS certificate and real proxied WebSocket commands on loopback; no public deployment was made. STORE_READINESS.md lists native/store prerequisites.
