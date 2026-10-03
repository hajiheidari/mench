import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
export async function getStored(key: string): Promise<string | null> {
  if (Platform.OS === "web") return globalThis.sessionStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
export async function setStored(
  key: string,
  value: string | null,
): Promise<void> {
  if (Platform.OS === "web") {
    if (value === null) globalThis.sessionStorage.removeItem(key);
    else globalThis.sessionStorage.setItem(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}
