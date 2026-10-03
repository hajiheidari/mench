# Architecture

One standalone product, with shared TypeScript contracts and a single server authority across browser and native clients.

M0 runs independent web, mobile and API skeletons. No client computes outcomes. game-engine has only a version marker until M1; protocol has a versioned envelope, not invented gameplay messages. These boundaries precede implementation.

Future flow: client intent → validated authenticated API/realtime adapter → pure engine transition → atomic persistence/event log → authoritative broadcast. PostgreSQL is the system of record; Redis will hold disposable presence/queue information, never wallet authority. Reconnect restores a server snapshot plus versioned event cursor. Ledger transactions, ranking and accounts arrive in their own milestones.

Web is a static React application; Vite avoids SSR complexity for a realtime board. PWA caching/installability will be implemented after actual game routes exist. Expo native clients use the same engine/protocol definitions without browser APIs. API is a modular Fastify application; Socket.IO adapter and schema validation are deferred to multiplayer. ORM selection waits for the first database milestone.

Cost: begin with one API deployment plus managed PostgreSQL; introduce Redis and horizontal match ownership only when measured needs justify them. No production availability claim at M0.
