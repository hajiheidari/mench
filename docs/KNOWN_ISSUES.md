# Known issues

- M0 is a foundation only: no playable Ludo, multiplayer, accounts, PWA install/offline worker or store artifacts yet.
- npm audit --omit=dev reports 23 dependency findings: 16 high, 7 moderate, 0 critical. These are in the Expo/React Native tooling chain (including Metro, node-forge and uuid). npm audit fix leaves them unresolved; recommended force fixes downgrade Expo to 44 / React Native to 0.72 and are incompatible with the chosen SDK. Do not force downgrade or claim production security. Reassess upstream fixes before native distribution. Audit reports dependency propagation, not 23 independent exploitable bugs in the health API.
- Android/iOS JS bundles are exported; native binaries, emulator/device execution and signing are not validated at M0.
- GitHub Actions workflow is configured, not remotely executed.
- Docker in this cloud requires the host proxy DNS mapping and the injected trusted CA as a build secret. The CA/proxy settings are not committed. Normal local machines can use docker compose up --build.
