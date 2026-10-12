import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

interface GameCenterNative {
  authenticate(): Promise<boolean>;
  isAuthenticated(): boolean;
  submitScore(leaderboard: string, value: number): Promise<void>;
  reportAchievement(identifier: string, percent: number): Promise<void>;
  showDashboard(): Promise<void>;
}

/** Apple Game Center on iOS; null elsewhere or when not built in. */
export const GameCenter: GameCenterNative | null =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<GameCenterNative>("GameCenter")
    : null;
