import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

interface CloudBackupNative {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** iCloud key-value storage on iOS; null elsewhere or when not built in. */
export const CloudBackup: CloudBackupNative | null =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<CloudBackupNative>("CloudBackup")
    : null;
