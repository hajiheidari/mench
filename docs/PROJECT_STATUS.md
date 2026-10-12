# Project status

- 2026-10-11: product name is **Ludo Dosti** (App Store name "Ludo Dosti: Play with Friends", home-screen name "Ludo Dosti"). "VIP Ludo" was dropped (casino connotation); "Yalla Ludo" is an existing Yalla Technology trademark. Bundle id stays com.espadna.mench, domain mench.espadna.com.

## 2026-10-13: next update (1.1.0) — Game Center, iPad, foldable iPhone

- Game Center (iOS): local module `apps/mobile/modules/game-center` (GameKit sign-in, leaderboard score, achievements, dashboard from the menu). The score is the wallet's all-time server-verified online wins (`onlineWins`); achievements: first win, 10 and 50 online wins, first design. App Store Connect setup: `gamecenter` workflow (`infra/scripts/asc_gamecenter.py`, texts and images in `apps/mobile/store/gamecenter/`); `asc_capabilities.py` turns the capability on; `asc_prepare.py` attaches Game Center to the version.
- iPad (`supportsTablet`, full screen, portrait) and the unfolded foldable iPhone: wider home column and larger type when the short side is 600 pt or more. iPad 13" screenshots and refreshed iPhone screenshots come from `scripts/store-screenshots.mjs` (web build of the app + `scripts/frame-screenshot.py`).
- The app now remembers the chosen language.
- Not yet on a device: Game Center sign-in and the iPad layout are checked only in the browser build and by the iOS CI compile.

## 2026-10-12: coins and shop

- Daily coins (20 per Tehran calendar day; was 50), shop with six boards (classic, wood, desert night, turquoise inlay, Isfahan tiles, khatam) and six pawn sets (classic, wood, crystal, copper, turquoise, gold); every design keeps the four player colours. Coins buy looks only; dice and rules are untouched.
- Server: anonymous `Wallet` Durable Object per wallet (`/api/wallet/{create,daily,buy,equip}`), device-made id + secret, only the secret's SHA-256 stored; CORS for the .ir copy. Web and app share `WalletClient` (game-client).
- Win coins (2026-10-12): an online win pays 10 coins, five a Tehran day — the Wallet asks the GameHub (`claimWin` RPC) whether that seat token won that finished match, once per match; a win against the bot pays 5, three a day, at most one a minute (device-reported, so smaller). Pass-and-play wins pay nothing, and a bot game counts only if the bot was on from the first roll. Offline phones: the two online modes show "No internet" and only the offline game opens (web: navigator.onLine; app: expo-network).
- Win coins (2026-10-12): an online win pays 10 coins, five a Tehran day; the Wallet asks the GameHub (`claimWin` RPC) whether that seat token won that finished match, once per match. A win against the bot pays 5, three a day, at most one a minute (device-reported, so smaller). Pass-and-play wins pay nothing, and a bot game counts only if the bot was on from the first roll. Offline phones: the two online modes say "No internet" and only the offline game opens (web: navigator.onLine; app: expo-network).
- Buying coins was dropped by the owner. Coins come from the daily reward and from rewarded ads offered only in the app's shop (20 coins, 5 a day, 30 s apart, enforced by the server).
- Rewarded ads: local Expo module `apps/mobile/modules/rewarded-ads` — Appodeal 4.3.0 on iOS (adapters: IAB, BidMachine, AppLovin, Unity, Mintegral; no AdMob; no ATT prompt; SKAdNetwork ids from AppLovin's published list via `plugins/withRewardedAds.js`, which also adds Appodeal's pod spec repo), Adivery 4.9.0 on Android (Bazaar). Ids live in `apps/mobile/ads.ts`. Web has no ads.
- Tests: wallet unit tests, edge E2E incl. the shop (9/9).

## 2026-10-11 (night): TestFlight build 9 feedback

- Bug: the quick online game resumed a saved friends' room (same stored session), showing a stalled private game. Quick matches now keep their own session slot (web sessionStorage / app SecureStore); an edge test reproduces the old behaviour and passes with the fix. A failed resume of an expired room no longer shows "invalid session".
- App lobby screens now have side gutters (fields touched the screen edge on iPhone).
- Persian name in the app/site header: «بازی منچ دوستانه» (English stays "Ludo Dosti"); "بازی آنلاین شانسی" → «بازی آنلاین رقابتی».
- Home menu (☰, web + app): display name, language, how to play (rules matching the engine), privacy policy, support/website, app version. On phones the language switch moved into the menu so the title fits on one line.
- Tests: check, test:db, Node E2E (12), edge E2E (8), platforms (2) pass.

## 2026-10-11 (evening): real quick match, home board, bigger board

- **Quick online game** first waits in the server's casual queue (about 5–8 s). Two people searching at the same time are paired on the authoritative edge server (server dice with proofs, flag from the device time zone + saved display name). Otherwise the practice bot plays under a random international name, as before. Room names may carry one flag emoji (schema max 30). Edge test: two browsers pair with each other; hub test: flagged names, cancel leaves the queue.
- Invite links (`/join/CODE`, web and app) show only the display name and "Join room".
- Home screen: an animated demo board (four bots, real engine moves, pawns walk cell by cell) fills the space under the three buttons without scrolling; respects reduced motion.
- Board: edge-to-edge on phones, thinner frame, pawns about one cell wide, larger touch targets for movable pawns. The home areas keep the classic 6×6 of a 15×15 grid: shrinking them would make the track cells thinner (or shorten the 52-cell track), so the gain comes from the board size instead.
- iOS: pawns appeared in the mirrored home in the Persian (RTL) layout; the native board now forces `direction: ltr`. Needs confirmation on a device (next TestFlight build).
- Tests in this container: `npm run check`, `test:db` (24), Node E2E (12), edge E2E (7), platforms (2) all pass.

## 2026-10-11 (later): live

- **Deployed**: https://mench.espadna.com (game + online rooms) and https://espadna.com/mench-app/ (landing, privacy), via the `site` workflow with the owner's Cloudflare secrets. The deploy job now runs the two-browser online acceptance against the live URL from GitHub (passed), and the same suite passed from this container against production (invite, verified roll, offline/online reconnect, reload resume, 3-player room, full match to the same winner).
- Live review at 390px found two problems, now fixed: the roll button sat below the board (fixed bottom roll bar on phones) and guests with the default nickname were indistinguishable (colour + "(you)" labels, web and app).
- iOS: first build uploaded to App Store Connect (ios run 38131088034, build number = run number): unsigned archive on macOS 26 / Xcode 26, signed at export with Apple's cloud-managed distribution certificate via the API key (a signed archive failed for lack of a development profile; the pasted .p8 needed PEM normalisation, infra/scripts/write-asc-key.py). Not yet installed on a physical iPhone; dSYM upload warnings for prebuilt React Native frameworks are cosmetic.
- Android builds are manual-only until the Bazaar release is requested; Google Play is out of scope for now (owner has no account).
- CI (quality + edge) green on GitHub; Node E2E runs with one worker on CI.

## 2026-10-11: public deployment on espadna.com (Claude Code continuation)

Target: the owner's studio site espadna.com (Cloudflare Workers; each app deploys its own Worker from GitHub Actions). See ADR 0002 and RELEASE.md (Persian release guide).

Implemented and tested locally:

- `apps/edge`: `mench` Worker + `GameHub` Durable Object hosting casual online rooms with the shared `packages/room-core` (Rooms class + command schema moved out of the API, which re-exports them). Durable storage per room, hibernating WebSockets, alarms for turn timers/expiry/heartbeat, per-socket rate limit, origin check.
- WebSocket transport in `game-client` (heartbeat, backoff, online/offline). Web `VITE_BACKEND=edge` build hides account/ranked UI; invites use the share sheet on phones; `?lang=fa|en`.
- Native: `ResultModal` winner popup for practice and online (finished state blocks input, play-again resets); edge backend by default in store builds (`EXPO_PUBLIC_BACKEND=edge` → https://mench.espadna.com); identity `com.espadna.mench`, v1.0.0, new icon/adaptive icon from shared art; release signing via config plugin and CI secrets.
- Landing pages espadna.com/mench-app (en/fa/ar) + privacy policy, generated by `apps/edge/landing_pages.py`. espadna.com card prepared on espadna-site branch `claude/mench-card` (not merged).
- Workflows: `site.yml` (deploy on main; warns and skips without Cloudflare secrets), `android.yml` (APK + AAB on the `android-test-build` pre-release), `ios.yml` (unsigned archive, or TestFlight with ASC secrets), CI `edge` job. The old `native.yml` was replaced.

Tests run on 2026-10-11 (this container, Node 24.19.0): `npm run check` passes (lint, format, typecheck, 67 source tests passed, 24 PostgreSQL cases skipped by default, builds). Edge hub unit tests (full match, reconnect, quick match across hibernation, restart restore, timers, rate limit). Playwright against `wrangler dev` (the deployable Worker): invite link + verified roll + offline/online reconnect + reload resume; 3-player room; full 2-player match to the same winner dialog on both screens; web host ↔ Expo client (same App.tsx as Android/iOS) full match to the native result popup; native practice to popup and restart. JS exports for Android/iOS/web pass with the production URL baked in.

Android release APK built locally on 2026-10-11 (Expo prebuild + Gradle 9.3.1, SDK 36, NDK 27.1): `com.espadna.mench` 1.0.0, arm64-v8a + armeabi-v7a, debug-signed, 16 KB zip alignment verified, bundle contains https://mench.espadna.com and no localhost (sha256 5c953413…08255). Not run on a device or emulator.

Not done / not verified (at that point; see the later entry above): nothing was deployed yet; no physical phone; iOS not built (needs macOS runner + Apple account); store submissions need the owner's accounts and signing key. Also re-run here with a local PostgreSQL 16: `npm run test:db` 24/24 passed; the original Node E2E suite 12/12 passed (accounts, social, economy, tournaments, history, Socket.IO online); platform tests 2/2 passed. On GitHub Actions (first remote runs ever) the edge job passed; the quality job showed that running the database suites in parallel inside `npm test` is flaky (shared database), reproduced locally (1 of 2 parallel runs failed, serial runs always pass), so CI now runs them serially via `npm run test:db`.

## Earlier history (Codex milestones)

Core milestones M1–M8 and M10–M15 are implemented with local acceptance checks. M9 shared Expo/PWA behavior is verified; the Android APK builds and emulator practice smoke checks pass, while physical-device execution/iOS delivery remain blocked. M16 local hardening, replay history, load/backup rehearsal and deployment templates are implemented. M17 has a verified debug-signed ARM64 APK and generated iOS project archive; production signing and store delivery remain unfinished.

Current validation: npm ci from the lockfile; lint/format/typecheck/source tests/shared+web+API builds; 60 source tests passed with 24 PostgreSQL cases explicitly skipped in the default run; a separate actual database run executes those cases. Nine Chromium E2E tests and two platform tests passed, including replay consistency/export, shared Expo-to-desktop proof verification and offline PWA practice. Android/iOS/web JS exports passed. See TESTING.md and hardening reports for exact scope. No remote CI/device/store acceptance claim.

Implemented: deterministic 2/3/4-player engine, cryptographic commitment/client-nonce dice and live verification, authoritative online rooms, invite links, quick/ranked queues, durable recovery, accounts/revocable sessions, friends/block/report, zero-sum Elo, append-only nonmonetary coin ledger/cosmetics, three offline bot difficulties, basic durable4/8/16/32 elimination brackets and audited server-approved moderation. Web and Expo use the same engine/protocol/client/localization.

M16: full participant-only completed-game transcripts, deterministic/action-bound archive verification with explicit witnessing limitations, bounded16-proof snapshots, event reconstruction in a consistent transaction, restart connection actions, monotonic lobby revisions, socket admission limits, active session expiry, readiness/liveness separation and private-pool-error handling. One million simulated dice/proofs passed. Short real-client100/500/1000 load runs passed; full JSON records CPU/RSS/ack/database probe measurements. A local backup restored all19 tables with matching contents and reconciled wallet receipts. Production API/static images and HTTPS/WebSocket rehearsal passed; production itself is not deployed.

External/release constraints: fresh in-sandbox Android downloads still return403; authorized outside execution resolved the dependency for the successful current native build. The saved network draft needs application/publication for reusable setups. iOS requires macOS/Xcode; real-device testing, production signing IDs/credentials, domain/deployment and publisher/privacy decisions remain outstanding. Native tooling audit still has23 findings (16high/7moderate), incompatible forced downgrades were avoided. Account-history retention/erasure, email verification/recovery, offsite backups/alerts and independent security review remain release gaps. Local commits are not pushed and fresh-task restoration is unverified.

Read HARDENING.md, SECURITY_REVIEW.md, STORE_READINESS.md and KNOWN_ISSUES.md before public release. User authorization covers continued development; it does not cover publication or paid services.

Validated again on2026-10-08:60 source tests,24 actual PostgreSQL tests,9 web E2E tests,2 platform tests, all JS exports,100/500/1000-client load and19-table backup restore. The final APK also passed debug-signature, ARM64/SDK/permission,16KiB ZIP and14-library ELF alignment checks. Linux iOS prebuild succeeded without installing Pods. See NATIVE_BUILD_REPORT.json and MOBILE.md for artifact paths/reproduction.

2026-10-09 result feedback: practice and online matches now show a winner dialog; bot practice congratulates the human or names the winning bot. Practice can restart from the dialog. The standalone HTML download is rebuilt using scripts/build-offline.mjs. Full source checks and focused full-game browser acceptance passed; bot difficulty and dice behavior are unchanged.

2026-10-09 player-count fix: selecting 2/3/4 players immediately starts a fresh practice match with the corresponding colors. The selector now derives its value from the actual game state, removing the mismatch between the menu and board. Standalone v3 includes this correction.

2026-10-09 practice layout: the bot checkbox and its text share a horizontal, vertically centered label. Standalone v4 passes alignment and text-click toggle checks in Persian/English at 390px and 1280px widths.

2026-10-09 native runtime: installed a headless software Android10/API29 x86_64 emulator and executed the native application. Practice smoke checks passed for Persian/English UI, immediate2/3/4-player setup, random dice/legal pawn movement, restart and bot controls/automatic turns. The native player-count mismatch was reproduced and corrected. Rebuilt and statically verified the ARM64 phone APK as mench-android-v2.apk. Full native match/online flows and physical-device/iOS/store acceptance remain outstanding; see ANDROID_EMULATOR_REPORT.json.

2026-10-10 visual redesign: replaced prototype styling with a shared original arcade board/pawns/avatars, real pip dice, purple/gold interface, active-player highlights and compact mobile roll controls. Native form text/surfaces use the dark theme consistently. Shared SVG source generates native PNG assets. The named Mencherz store reference returned403; exact benchmark comparison remains pending accessible screenshots. See VISUAL_DESIGN.md and VISUAL_VALIDATION_REPORT.json for delivered artifacts and actual test scope.

Bundled Samim regular/bold now provides the softer Persian typography on web and native; upstream font license is included. The offline download embeds fonts without a CDN.

2026-10-10 classic colors: localized player names are Red/Green/Yellow/Blue (قرمز/سبز/زرد/آبی). Shared board/pawn/avatar colors now use the traditional red, green, yellow and blue palette. Avatar faces/ears use the same seat color as their pawns, including the red face and yellow mane. Updated standalone and ARM64 APK are delivered as mench-classic-colors.html and mench-android-classic-colors.apk.
