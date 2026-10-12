// Android Auto Backup (the player's Google account) keeps the coin wallet's
// recovery code: the same rules as expo-secure-store plus files/wallet-backup.txt.
// The SecureStore preferences stay excluded (their keys cannot be restored).
// Expo loads config plugins as CommonJS.
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const RULES = `    <include domain="sharedpref" path="."/>
    <exclude domain="sharedpref" path="SecureStore"/>
    <include domain="file" path="wallet-backup.txt"/>`;
const FULL = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
${RULES}
</full-backup-content>
`;
const EXTRACTION = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${RULES}
  </cloud-backup>
  <device-transfer>
${RULES}
  </device-transfer>
</data-extraction-rules>
`;

module.exports = function withWalletBackup(config) {
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const dir = join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/res/xml",
      );
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "wallet_backup_rules.xml"), FULL);
      writeFileSync(join(dir, "wallet_data_extraction_rules.xml"), EXTRACTION);
      return cfg;
    },
  ]);
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    app.$["android:allowBackup"] = "true";
    app.$["android:fullBackupContent"] = "@xml/wallet_backup_rules";
    app.$["android:dataExtractionRules"] = "@xml/wallet_data_extraction_rules";
    return cfg;
  });
};
