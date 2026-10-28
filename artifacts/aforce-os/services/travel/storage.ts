import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createJourneyRepository, type JourneyStorage } from './journey';

// Native fails closed if Keychain/Keystore is unavailable: no plaintext
// fallback and no successful-save message before the durable write settles.
// Web is an internal preview; sessionStorage is explicitly device/browser local.
export const travelStorage: JourneyStorage = Platform.OS === 'web' ? {
  getItem: async key => sessionStorage.getItem(key),
  setItem: async (key, value) => { sessionStorage.setItem(key, value); },
  removeItem: async key => { sessionStorage.removeItem(key); },
} : {
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  removeItem: key => SecureStore.deleteItemAsync(key),
};
export const journeyRepository = createJourneyRepository(travelStorage);
