# Store readiness — pending external prerequisites

The shared application and workflows are prepared for development validation. A debug-signed ARM64 development APK and generated iOS source archive exist. No production-signed APK/AAB, Xcode .xcarchive, store upload or remote CI execution exists. Current native identifiers com.mench.game are provisional. Android/iOS/web JavaScript exports pass; Expo browser interoperability does not establish native device compatibility.

Android: JDK17/SDK36/build-tools36/NDK27.1/verified Gradle9.3.1 are installed locally. The official React Native download succeeded during authorized execution outside the sandbox; the final local APK build passed again with cached dependencies. Fresh in-sandbox downloads still return403: apply/publish the saved cloud network rule for future setups. The manual native workflow produces a development APK with debug signing; it does not produce a store-signed release. Before release, confirm the owner/package ID/backend endpoint, supply signing credentials securely and prepare a reviewed signed AAB/keystore backup strategy. Do not commit private signing files.

iOS: a macOS/Xcode host is required. The prepared manual workflow prebuilds the Expo iOS project and builds an unsigned simulator app. Linux generated the native Xcode project/Podfile with prebuild --no-install; the project source archive is available. Pods, Xcode compile and the remote workflow have not run. Before release, confirm the Apple bundle/team identity, review generated native permissions/privacy manifests and dependency disclosures, then validate simulator and physical-device play/reconnect, sign an archive with secure credentials and review App Store requirements. No account or paid runner is assumed available.

The eventual submission checklist includes:

- Stable HTTPS backend and reviewed production deployment/recovery/monitoring; safe device API URL configured before build.
- Complete two-player and four-player cross-device matches, fair-proof witnessing, reconnection/background transitions, session expiry/logout/suspension, RTL/accessibility and tablet acceptance on real Android/iOS targets.
- Email/password identity plus visible account deletion, report/block and support flow. Password recovery/email verification remain release gaps. No third-party OAuth currently exists; review Apple Sign In requirements if one is introduced.
- Publisher/legal identity, support contact, public privacy policy/terms and age/content disclosures. These require real owner decisions and must not contain invented contacts or retention promises.
- Accurate disclosures of email, display name, account identifiers, gameplay/social/moderation records and private service logs. Decide erasure/retention for historical replay/bracket data and anonymous financial/admin receipts; do not claim full historical erasure today.
- No real-money purchases, ads or analytics SDK integration exists. Nonmonetary earned coins buy cosmetic themes only. If store payments are added later, implement server receipt verification, restore purchases and the relevant billing rules before submission.
- Resolve/review native dependency audit findings, review build artifacts for secrets and run the prepared workflows. Remote CI and store review remain unverified until actually executed.

Remaining work needs actual network access, a supported Mac runner/device, confirmed publisher identifiers and secure signing/configuration. Publication or spending still requires explicit authorization. Supplying development prerequisites does not authorize submission.

The verified development artifacts and SHA256 are recorded in NATIVE_BUILD_REPORT.json. Unused native permissions were removed; 16KiB ZIP/ELF alignment was verified. This is not device execution or store certification.
