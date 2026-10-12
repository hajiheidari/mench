/* eslint-disable @typescript-eslint/no-require-imports */
// Rewarded ads in the shop: Appodeal on iOS (modules/rewarded-ads).
// - Podfile: Appodeal's spec repo, which hosts its network adapters.
// - Info.plist: the ad networks' SKAdNetwork ids (AppLovin's published list,
//   https://skadnetwork-ids.applovin.com/v1/skadnetworkids.json) so installs
//   can be attributed without tracking, and plain-HTTP ad media.
// The app never asks for tracking permission.
const fs = require("fs");
const path = require("path");
const { withDangerousMod, withInfoPlist } = require("expo/config-plugins");

const SOURCES = [
  "source 'https://github.com/appodeal/CocoaPods.git'",
  "source 'https://cdn.cocoapods.org/'",
];

module.exports = function withRewardedAds(config) {
  config = withInfoPlist(config, (cfg) => {
    const ids = require("./skadnetwork-ids.json");
    cfg.modResults.SKAdNetworkItems = ids.map((id) => ({
      SKAdNetworkIdentifier: id,
    }));
    cfg.modResults.NSAppTransportSecurity = {
      ...(cfg.modResults.NSAppTransportSecurity ?? {}),
      NSAllowsArbitraryLoads: true,
    };
    return cfg;
  });
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      const podfile = fs.readFileSync(file, "utf8");
      if (!podfile.includes(SOURCES[0]))
        fs.writeFileSync(file, `${SOURCES.join("\n")}\n${podfile}`);
      return cfg;
    },
  ]);
};
