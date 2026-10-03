# Testing

From root: npm ci; npm run check (lint, formatting, strict typecheck across all workspaces, Vitest, web/API/shared builds); CI=1 npm run build:mobile (Expo Android/iOS/web bundle export). Export validates JS assets, not signed native binaries.

Tests exercise Fastify through injection: versioned health JSON and unknown route rejection; validation rejects unsupported language identifiers. No engine gameplay tests exist before M1.

Runtime: start dev:api and request /health, assert JSON/status; start dev:web, request page and entry source; inspect actual server output. Docker: docker compose config, build, up and request the same health/page routes. Optional storage profile is not required by M0.

CI executes the same commands on Node .nvmrc. Local execution cannot establish GitHub Actions success; native device/store tests need separate tooling in M9/M17.

## Cloud Docker trust

The cloud proxy hostname is resolved on the host but not in Docker DNS. For this environment the image was built with --build-arg HTTP_PROXY, --build-arg HTTPS_PROXY, --build-arg NO_PROXY, --add-host for the existing proxy hostname/IP, and --secret id=ca,src pointing to the injected NODE_EXTRA_CA_CERTS file. Use DOCKER_CONFIG=/tmp/mench-docker for a writable Docker cache. Keep certificate files out of the checkout. The Dockerfile consumes the optional ca secret only during installation and keeps TLS verification enabled. Tag the image mench-api and mench-web, then docker compose up -d --no-build api web. No proxy credentials are copied to source or saved configuration.

M1: 25 engine tests passed, including full 2/3/4-player simulations. v8 coverage: 97.84% statements, 97.97% branches, 100% functions, 98.79% lines. Command: npm test -- packages/game-engine --coverage --coverage.include=packages/game-engine/src/index.ts.

M2: five tests passed; 100000-roll reproducible simulation and browser WebCrypto/server interoperability executed. Proof verification requires the independently observed commitment and client nonce; changing a nonce can coincidentally preserve the dice face, so checking the face alone is insufficient. Full lint/typecheck/tests/build passed.
