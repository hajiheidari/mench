/**
 * Rewarded ads, offered only inside the shop. A provider plugs in here:
 * Adivery for the Cafe Bazaar build (needs the app and placement ids from
 * the owner's Adivery panel); none yet, so the shop shows no ad button.
 */
export interface RewardedAds {
  /** Plays one rewarded ad; resolves true when the viewer earned the reward. */
  show(): Promise<boolean>;
}
export const rewardedAds: RewardedAds | null = null;
