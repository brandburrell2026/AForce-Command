/**
 * secureStorage — the app binding of the pure `secureKV` core (Lock §7 / K-1).
 *
 * Profile data must live in the platform's secure storage, not plain
 * AsyncStorage. expo-secure-store backs iOS Keychain / Android Keystore; it
 * has NO web implementation, so the web (dev-only) surface falls back to
 * AsyncStorage — the same plain store it used before, no regression.
 *
 * Reads transparently migrate legacy plain-AsyncStorage values into secure
 * storage (see utils/secureKV.ts for the migration contract).
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createSecureKV, type KVBackend, type SecureKV } from '../utils/secureKV';

const plainBackend: KVBackend = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k),
};

const secureBackend: KVBackend =
  Platform.OS === 'web'
    ? plainBackend // SecureStore is unavailable on web; dev surface only.
    : {
        getItem: (k) => SecureStore.getItemAsync(k),
        setItem: (k, v) => SecureStore.setItemAsync(k, v),
        removeItem: (k) => SecureStore.deleteItemAsync(k),
      };

/** Singleton secure KV for profile-class data. */
export const secureKV: SecureKV = createSecureKV(secureBackend, plainBackend);
