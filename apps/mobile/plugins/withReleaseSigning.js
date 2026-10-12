// Signs Android release builds with the upload key when MENCH_UPLOAD_STORE_FILE is
// set (CI secrets, see docs/RELEASE.md); otherwise release stays debug-signed for testing.
// Expo loads config plugins as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withAppBuildGradle } = require("expo/config-plugins");

const SIGNING = `
        release {
            if (System.getenv("MENCH_UPLOAD_STORE_FILE")) {
                storeFile file(System.getenv("MENCH_UPLOAD_STORE_FILE"))
                storePassword System.getenv("MENCH_UPLOAD_STORE_PASSWORD")
                keyAlias System.getenv("MENCH_UPLOAD_KEY_ALIAS")
                keyPassword System.getenv("MENCH_UPLOAD_KEY_PASSWORD")
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (gradle) => {
    let source = gradle.modResults.contents;
    if (source.includes("MENCH_UPLOAD_STORE_FILE")) return gradle;
    source = source.replace(
      /signingConfigs \{\n(\s+debug \{[\s\S]*?\n\s{8}\})/,
      (block, debug) => `signingConfigs {\n${debug}${SIGNING}`,
    );
    source = source.replace(
      /(release \{\n(?:\s*\/\/.*\n)*\s*)signingConfig signingConfigs\.debug/,
      '$1signingConfig System.getenv("MENCH_UPLOAD_STORE_FILE") ? signingConfigs.release : signingConfigs.debug',
    );
    // CI passes a growing number so every store upload has a new versionCode.
    source = source.replace(
      /versionCode (\d+)/,
      'versionCode Integer.parseInt(System.getenv("MENCH_VERSION_CODE") ?: "$1")',
    );
    if (!source.includes("signingConfigs.release"))
      throw new Error("withReleaseSigning: build.gradle layout changed");
    gradle.modResults.contents = source;
    return gradle;
  });
};
