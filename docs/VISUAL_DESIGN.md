# Game visual design — 2026-10-10

The initial flat prototype has been replaced with an original arcade visual system for web/PWA and Expo/Android. The board uses saturated coral/mint/gold/blue homes, inset pawn sockets, beveled track cells, a gold frame and central crown. Sculpted pawn sprites retain visible pawn numbers. Four decorative illustrated avatars identify players; a gold border marks the active player/home. Dice show actual pip patterns, with the rolled value retained for accessibility. Purple background artwork, raised controls and warm highlights carry through the interface. Player names and all interface copy remain localized.

The user named https://cafebazaar.ir/app/com.incytel.mencherz as the visual benchmark. Both that URL and the same application's Google Play page returned HTTP403, including approved outside-network retries. Its screenshots were unavailable during this change. This is an original redesign toward the requested richer game presentation, not a claim that its layout/assets have been inspected or reproduced. Detailed benchmark comparison needs accessible reference screenshots.

## Shared artwork

packages/board-geometry/src/art.ts draws the original board, pawn and avatar SVGs and defines dice pip positions. Web embeds those SVGs directly. `node scripts/build-game-art.mjs` deterministically renders the same source to the committed PNGs under apps/mobile/assets/game with Chromium; no runtime art generation, external image requests or extra native graphics dependency is required. Rerun this command when changing the shared art/palette, before building native clients.

Board math, player seats, safe cells, dice probability, bot choices and authoritative server rules are unchanged. Safe-square overlays use the actual game rules. Native stacking now uses the same board-cell offset calculation as web. Decorative graphics do not receive game input; existing accessible pawn/control labels and enabled states are retained. Web animations honor reduced-motion preferences.

On narrow web layouts dice and the roll action sit together. Native practice uses a compact header and a horizontal dice/action row. Native Text defaults and form surfaces were adjusted for contrast against the dark background; selected navigation/player-count controls use gold. The offline HTML still includes only local practice and bots.

## Delivery and validation

The self-contained download is /workspace/mench-artifacts/mench-visual-v1.html; Android ARM64 is /workspace/mench-artifacts/mench-android-visual-v1.apk. Mobile/desktop web screenshots are mench-visual-mobile.png and mench-visual-desktop.png in that directory. VISUAL_VALIDATION_REPORT.json records hashes, executed checks and native runtime evidence.

No production/store signing or publication is claimed. Android minimum24/target36 are build metadata; physical ARM64 phone acceptance, other Android versions, native online/authentication/full-game result flows and iOS execution remain outside the current native smoke scope. Web full-game/result and online acceptance are tested separately.

## Persian typography

Samim regular and bold replace the system typography with softer Persian forms. Unmodified font files and their upstream license are included under packages/board-geometry/assets/fonts. Web embeds the fonts locally, including data URLs in the standalone HTML. Native uses expo-font and waits for loading before rendering. Native bold labels select the actual bold font rather than synthesizing weight. Phone board size responds to available height so the roll control remains visible.
