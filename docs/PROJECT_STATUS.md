# Project status

M1–M8 acceptance: PASS. Current work: M9 native development builds.

- M1: pure deterministic engine, 25 engine tests, >97% statement/branch coverage.
- M2: 100000-roll distribution report, commitment/client nonce design and browser verification.
- M3: full local Chromium match and mobile viewport board.
- M4/M5: full real-WebSocket 2/4-player matches, proof verification, idempotency, strict intents, grace periods, reconnect and session replacement.
- M6: PostgreSQL identity migrations, hashed passwords, revocable sessions, public/self profiles and deletion. Three actual DB integration tests passed; default no-DB test run explicitly skips these, never counts them as passes.
- M7: guest/registered browser invitation links, waiting lobby, copy invite, start, proof history, refresh restoration. Browser acceptance passed.
- M8: bounded quick-match queue, cancel/disconnect cleanup and automatic authoritative 2-player start. Real-client queue/cancel test passed.
  Four Chromium E2E tests passed including account reload/logout/deletion, online invitation/verification/reload, full local match and responsive four-player setup. Full lint/typecheck/build checks passed. Remote CI has not run.
  Known limits: in-memory matches across server restart; email verification/recovery and OAuth deferred; Expo audit findings remain. Shared profile is persistent; rankings/economy/statistics not yet implemented.
  Current external constraints: PWA manifest/service worker and offline local game passed real Chromium tests. Expo browser client joined the same backend match as the desktop client and independently verified the roll. Android/iOS/web JS exports pass. Android SDK/JDK are being installed via verified authoritative packages for a real Android development build. Linux cannot run Xcode; iOS native build needs macOS or an approved external runner. No publication or spending authorized.
