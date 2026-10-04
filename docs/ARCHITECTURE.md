# Architecture

One standalone product shares TypeScript engine, protocol, game client, fairness verifier, localization and board geometry across React web/PWA and Expo Android/iOS/web. The deterministic engine has no UI, database, network or Node imports. Local practice calls it directly; online clients send strict intents and never choose outcomes.

Online flow: authenticated/capability-bound intent → bounded serialized room actor → pure engine transition → PostgreSQL snapshot/event/result transaction → success acknowledgment and authoritative broadcast. WebSocket reconnect restores a versioned full snapshot and proof history. Private snapshots contain token hashes and pending seeds; raw capabilities remain in client secure storage and a bounded process-local response cache. Database write failure freezes gameplay. API startup checks migration hashes and recovers disconnected rooms with grace. Single-process room ownership is required; distributed orchestration and zero-downtime takeover are not implemented.

Accounts use scrypt password hashes and revocable, hashed 256-bit sessions. HTTP-only browser cookies and native SecureStore bearer tokens use one API. Social mutations lock user rows in stable order. Completed ranked two-player results settle zero-sum Elo exactly once in the final-state transaction. PostgreSQL is the record of truth; Redis is optional and not wallet authority. Queue/presence are currently disposable in-process state.

Vite builds the static web application. PWA caches only shell/static assets; account/game HTTP and sockets remain uncached. Expo exports shared JS to all platforms. Native SDK builds/device validation are separate requirements, documented in MOBILE.md. esbuild bundles the API with runtime database/framework packages external.

Deployment begins with one API and PostgreSQL. Horizontal match ownership, production abuse controls, economy, moderation and store readiness require their remaining milestones. Local tests and prepared CI workflows do not establish production availability or remote execution.
