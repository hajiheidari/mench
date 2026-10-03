# Project status

M1–M5 acceptance: PASS. Current work: M6 accounts and profiles.
M1: deterministic engine, 25 tests, >97% engine statement/branch coverage. M2: 100000-roll report and WebCrypto verification. M3: full local browser match and responsive four-player board.
M4/M5: complete two/four-client authoritative games over real WebSockets; every dice proof checked, forged/duplicate/stale intents rejected, default spam budget tested, 2/10/30s disconnect simulation, live reconnect/session replacement. Three Chromium E2E tests passed including browser invite, start, verified dice and reload restoration. Full quality/build checks passed.
Current limitations: rooms/queue are in-memory across server restarts; no accounts yet. Expo dependency security findings and native signing requirements remain. Next: PostgreSQL identity/persistence, then private-room acceptance and matchmaking.
