import { requireOptionalNativeModule } from "expo";

interface RewardedAdsNative {
  initialize(appKey: string, placement: string): void;
  isReady(): boolean;
  show(): Promise<boolean>;
}

/** Appodeal on iOS, Adivery on Android; null on the web or when not built in. */
export const RewardedAdsNative =
  requireOptionalNativeModule<RewardedAdsNative>("RewardedAds");
