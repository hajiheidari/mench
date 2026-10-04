# Project status

M1–M8 acceptance: PASS. M9 web/PWA/shared Expo client verified; native delivery externally blocked. M10 social implemented and verified. M11 two-player ranking verified; M12 ledger economy verified; M13 offline bots verified; M14 basic tournaments verified; M15 moderation/session revocation verified; next M16 hardening.

- M1: pure deterministic engine, 25 engine tests, >97% statement/branch coverage.
- M2: 100000-roll distribution report, commitment/client nonce design and browser verification.
- M3: full local Chromium match and mobile viewport board.
- M4/M5: full real-WebSocket 2/4-player matches, proof verification, idempotency, strict intents, grace periods, reconnect and session replacement.
- M6: PostgreSQL identity migrations, hashed passwords, revocable sessions, public/self profiles and deletion. Five actual DB integration tests passed (identity plus restart recovery and persistence outage); default no-DB test run explicitly skips these, never counts them as passes.
- M7: guest/registered browser invitation links, waiting lobby, copy invite, start, proof history, refresh restoration. Browser acceptance passed.
- M8: bounded quick-match queue, cancel/disconnect cleanup and automatic authoritative 2-player start. Real-client queue/cancel test passed.
  Four Chromium E2E tests passed including account reload/logout/deletion, online invitation/verification/reload, full local match and responsive four-player setup. Full lint/typecheck/build checks passed. Remote CI has not run.
  Known limits: email verification/recovery and OAuth deferred; Expo audit findings remain. Shared profile is persistent; rankings/economy/statistics not yet implemented.
  Current external constraints: PWA manifest/service worker and offline local game passed real Chromium tests. Expo browser client joined the same backend match as the desktop client and independently verified the roll. Android/iOS/web JS exports pass. Android SDK/JDK17 and verified Gradle are installed. Local compilation reaches official React Native dependency download, blocked by network HTTP 403; saved network draft needs application. Linux cannot run Xcode; iOS native build needs macOS or an approved external runner. No publication or spending authorized.

Durable rooms: PostgreSQL snapshot/event transactions precede success responses; serialized commands, graceful WebSocket shutdown, reconnect recovery and failed-write freeze/503 are verified. Queue and response cache remain process-local.

M10: shared typed social API, web/Expo account views, friends/presence/invites/recent opponents/block/report. Nine actual PostgreSQL tests passed (five existing + four social); five Chromium E2E tests and two platform tests passed. All three mobile JS exports pass; native binaries remain blocked.

M11: full ranked and casual PostgreSQL/WebSocket matches, proof verification, exactly-once final settlement and integer zero-sum Elo passed. Eleven DB integration tests, five web E2E and two platform tests pass; current lint/typecheck/source tests/build pass. Shared web/Expo leaderboard and ranked queue added.

M12: server-only completion rewards, immutable coin ledger, daily cap, atomic cosmetics purchases/equipment and persistent web/Expo theme selection. Fourteen DB tests, six Chromium E2E and two platform tests pass; mobile JS exports and full checks pass. No real-money integration.

M13: independent legal-move bot package, three difficulty heuristics, web/Expo offline controls and180 full simulations. Seven Chromium E2E and two platform tests pass. Source run:51 passed,14 database tests explicitly skipped; separate actual DB suite remains14 passed.

M14: durable registered single-elimination4/8/16/32 brackets, assigned-room linking and transactional server-only advancement. Full three-game4-player tournament passed with every proof verified. Seventeen DB tests, eight web E2E and two platform tests pass; all mobile JS exports and source checks pass. Manual match setup and abandoned-bracket limitations documented.

M15: server-approved admin allowlist, suspended login, report decisions, live tournament cancellation, immutable/idempotent audits and session/capability revocation. Twenty-two DB tests pass including shared GameClient logout clearing; eight browser E2E/two platform regressions and native JS exports pass. Privileged UI device/browser acceptance is not claimed; admin role is disabled by default.
