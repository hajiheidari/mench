# Agent guide

Read this file before editing. Work in the existing isolated checkout; do not create worktrees unless requested.

## Architecture

TypeScript npm workspaces: apps/web (React/Vite), apps/mobile (Expo), apps/api (Fastify); packages/game-engine (pure deterministic logic), game-protocol (versioned contracts), shared-types and validation. Future database and realtime adapters belong in the API, never the engine. No duplicated mobile game engine.

## Commands

Node version is .nvmrc. Run npm ci, npm run check, and CI=1 npm run build:mobile from the repository root. npm run dev:web, npm run dev:api and npm run dev:mobile start applications. npm run format formats source. Docker: docker compose up --build; optional data services: docker compose --profile data up -d postgres redis.

## Invariants

Strict TypeScript, small modules, no untyped any, no credentials in Git. Visible text belongs in localization dictionaries. Pure engine may not import UI, network, database or Node runtime. Server alone chooses dice, validates moves, turns, captures, results and rewards. Clients send intents only. Future dice commit/reveal must use cryptographic entropy, contextual binding and rejection sampling; purchases or engagement may never affect probability. Seed commitment alone does not prevent server seed selection; M2 must document that threat.

## Workflow

Follow docs/ROADMAP.md. Each milestone: plan, implement, test, review, fix, retest, document, commit, continue after successful acceptance checks. Keep PROJECT_STATUS and KNOWN_ISSUES accurate; never claim skipped checks passed. Use descriptive scoped commits. The user authorized continuous milestone delivery on 2026-10-04. Continue without milestone approval; pause only for required external access, essential decisions, publication or spending.
