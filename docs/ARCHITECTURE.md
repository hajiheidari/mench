# Architecture

One standalone product shares TypeScript engine, protocol, game client, fairness verifier, localization and board geometry across React web/PWA and Expo Android/iOS/web. The deterministic engine has no UI, database, network or Node imports. Local practice calls it directly; online clients send strict intents and never choose outcomes.

Online flow: authenticated/capability-bound intent → bounded serialized room actor → pure engine transition → PostgreSQL snapshot/event/result transaction → success acknowledgment and authoritative broadcast. WebSocket reconnect restores a versioned full board snapshot and bounded recent proofs. Private snapshots contain token hashes and pending seeds; raw capabilities remain in client secure storage and a bounded process-local response cache. Database write failure freezes gameplay. API startup checks migration hashes and recovers disconnected rooms with grace. Single-process room ownership is required; distributed orchestration and zero-downtime takeover are not implemented.

Accounts use scrypt password hashes and revocable, hashed 256-bit sessions. HTTP-only browser cookies and native SecureStore bearer tokens use one API. Social mutations lock user rows in stable order. Completed ranked two-player results settle zero-sum Elo exactly once in the final-state transaction. PostgreSQL is the record of truth; Redis is optional and not wallet authority. Queue/presence are currently disposable in-process state.

Vite builds the static web application. PWA caches only shell/static assets; account/game HTTP and sockets remain uncached. Expo exports shared JS to all platforms. Native SDK builds/device validation are separate requirements, documented in MOBILE.md. esbuild bundles the API with runtime database/framework packages external.

Deployment begins with one API and PostgreSQL. Horizontal match ownership, production operations, sustained abuse/capacity testing and native/store delivery remain release work. Local tests and prepared CI workflows do not establish production availability or remote execution.

Completed results retain independently replay-verified full transcripts; live/checkpoint snapshots contain16 recent proofs and an offset. Consistent PostgreSQL event reconstruction restores full histories. Restart connection changes are persisted as replay actions. Account-only history endpoints expose no private account IDs or pending material. See HARDENING.md.

## Public deployment on espadna.com (2026-10-11)

The public web game runs on Cloudflare, like the studio's other apps (ADR 0002): the `mench` Worker in `apps/edge` serves the edge web build on mench.espadna.com and the landing pages on espadna.com/mench-app, and its `GameHub` Durable Object owns all casual rooms using `packages/room-core` (the same Rooms class and schema the Node API uses). Clients choose the transport: plain WebSocket for the edge (`transport: "websocket"`), Socket.IO for the Node API. Android/iOS store builds set `EXPO_PUBLIC_BACKEND=edge` and connect to https://mench.espadna.com. The Node API remains the home of accounts, ranked, social, economy, tournaments and moderation, and is not deployed publicly.
