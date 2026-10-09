# Known issues

- Web/PWA and Expo browser gameplay are playable; Android/iOS JavaScript exports pass. The ARM64 debug-signed APK now builds; signature/16KiB alignment/permissions were checked. Android 10 x86_64 emulator practice smoke checks now pass (see ANDROID_EMULATOR_REPORT.json). Full native match completion, native online acceptance, physical-device execution and production signing remain unverified. Fresh Android dependency download inside the sandbox still returns403 on repo.reactnative.dev; authorized outside execution downloaded it successfully. The saved network rule still needs application for reusable setups. iOS requires macOS/Xcode.
- Room ownership is single-process. PostgreSQL recovery is supported, but queue and bounded response caches are ephemeral. No multi-instance deployment or zero-downtime handover is claimed.
- Email verification, password reset and OAuth remain absent. Local hardening checks passed; production operations and native/store delivery remain incomplete.
- Current npm audit reports 23 findings (16 high, 7 moderate) in Expo/native tooling. Compatible upstream fixes were unavailable; forced SDK downgrades are not acceptable. Reaudit before native distribution; no production-security claim.
- GitHub Actions workflows are prepared but have not run remotely. No app is published and no paid runner/service is authorized.
- Docker in this cloud requires host proxy DNS mapping and the injected trusted CA as a build secret. CA/proxy values are not committed. Standard local machines can use docker compose up --build.

- Social presence is game-socket presence with manual refresh. Account blocks do not identify anonymous guests, and do not expel existing match participants. Reports are stored and server-approved moderation can classify them.

- Ranked launch supports two registered players only. Email verification, collusion controls, seasons and abandonment results are not implemented; competitive public release requires further hardening.

- Non-monetary coin ledger is append-only; account deletion anonymizes wallet ownership and retains receipts. Production retention/erasure policy, dedicated DB roles, farming controls, scheduled reconciliation and encrypted offsite backup/alerts remain release work.

- Basic tournaments require assigned opponents to link their casual room before starting. Automated scheduling/forfeits are absent; abandoned linked games can stall brackets. Audited administrative cancellation is implemented; account-deletion/retention handling still needs release review.

- Administration defaults to disabled. Production must nominate trusted ADMIN_USER_IDS, define staff procedures/report SLAs and retention. Privileged panel compiles, but no privileged browser/native device acceptance is claimed. Active socket expiry and revocation are tested.

- Replay archives verify internal consistency; they cannot prove prior commitment publication. Legacy results without a complete event transcript return REPLAY_UNAVAILABLE. Guest history is session-local. Full proof arrays remain in memory for current matches; short load runs do not establish sustained capacity.
