import { Platform } from "react-native";
import { EDGE } from "./OnlineGame";
import { RewardedAdsNative } from "./modules/rewarded-ads";

/**
 * Rewarded ads, offered only inside the shop: Appodeal on the App Store
 * build, Adivery on the Cafe Bazaar build. The ids are public (they ship in
 * the app); the server caps the coins an ad can earn.
 */
const IDS =
  Platform.OS === "ios"
    ? { app: "f65811d446ad207cf12dc888994b93391e96d0000b7891b2", placement: "" }
    : {
        app: "c926c454-ee7b-40d7-b4a8-2cfd840e0c2d",
        placement: "4f4a56e7-8a13-4baa-ada7-0eeb632177de",
      };

export interface RewardedAds {
  /** Starts loading an ad; call when the shop opens. */
  prepare(): void;
  /** Plays one rewarded ad; resolves true when the viewer earned the reward. */
  show(): Promise<boolean>;
}

const native = EDGE ? RewardedAdsNative : null;
// Store screenshots come from the web build, which has no ad network; this
// build-time flag shows the shop's ad button there (it never pays out).
const screenshotOnly = process.env.EXPO_PUBLIC_STORE_SCREENSHOTS === "1";
let started = false;

export const rewardedAds: RewardedAds | null = screenshotOnly
  ? { prepare() {}, show: async () => false }
  : native && {
      prepare() {
        if (started) return;
        started = true;
        native.initialize(IDS.app, IDS.placement);
      },
      async show() {
        this.prepare();
        // A tap right after the shop opens may beat the first ad; wait a little.
        for (let i = 0; i < 20 && !native.isReady(); i++)
          await new Promise((resolve) => setTimeout(resolve, 500));
        return native.show();
      },
    };
