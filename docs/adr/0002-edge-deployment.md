# ADR 0002 — Casual online play on Cloudflare Workers (espadna.com)

Date: 2026-10-11 · Status: accepted

## Context

The game is published under the owner's existing studio site, espadna.com. Every
espadna app (Adadi, Tiaro, Pantomime) is a Cloudflare Worker deployed by GitHub
Actions to `<app>.espadna.com`, with landing pages on `espadna.com/<app>-app/`.
Adadi already keeps server state in a Durable Object. The studio has no Node host
or PostgreSQL server, and Workers cannot run the Fastify/Socket.IO/PostgreSQL API.

## Decision

- `apps/edge` is a Worker named `mench`: it serves the web build
  (`VITE_BACKEND=edge`) on `mench.espadna.com` (SPA fallback for `/join/CODE`), the
  landing pages on `espadna.com/mench-app*`, and `/ws`.
- `/ws` reaches one `GameHub` Durable Object, the single owner of every room (the
  same single-owner model as the Node API). It runs the shared `Rooms` class and
  command schema from `packages/room-core`, the same engine, fair-dice commitments
  and validation as the API.
- Rooms persist in Durable Object storage after every command; WebSockets use the
  hibernation API, queued quick-match players live in socket attachments, alarms
  drive turn timers, hourly expiry and heartbeat checks (silent sockets > 30 s are
  closed, which starts the 45 s reconnect grace).
- Clients use a plain WebSocket transport (`packages/game-client/src/transport.ts`)
  with JSON frames (`WIRE` in game-protocol), heartbeat, backoff and browser
  online/offline hooks. Socket.IO stays the Node transport.
- Scope on the edge: private rooms, invite links/codes, casual quick match,
  reconnect, turn timers, verifiable dice. Accounts, ranked, social, economy,
  tournaments and moderation need the Node API and are hidden in edge builds and
  refused by the hub (`RANKED_UNAVAILABLE`).

## Consequences

- No new paid service: Workers + SQLite Durable Objects fit the free plan at launch
  volumes (requests, WebSocket messages at 20:1, alarms). Usage must be watched.
- One Durable Object handles all rooms; it is single-threaded. Sharding by room code
  (one object per room plus a small matchmaking object) is the next step if load
  requires it.
- Deploys restart the object: sockets drop, clients reconnect and resume their seats
  from storage.
- The Iranian mirror (espadna.ir) copies static files only; online play needs
  Cloudflare reachability.
