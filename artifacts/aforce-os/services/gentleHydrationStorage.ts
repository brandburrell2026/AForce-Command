/** Device-only storage for Gentle Hydration. Never uses a non-secure fallback. */
import * as SecureStore from "expo-secure-store";

const KEY = "aforce.gentleHydrationMode.v2";
const DEVICE_ONLY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const gentleHydrationStorage = {
  getItem: () => SecureStore.getItemAsync(KEY, DEVICE_ONLY_OPTIONS),
  setItem: (value: string) =>
    SecureStore.setItemAsync(KEY, value, DEVICE_ONLY_OPTIONS),
  removeItem: () => SecureStore.deleteItemAsync(KEY, DEVICE_ONLY_OPTIONS),
};
