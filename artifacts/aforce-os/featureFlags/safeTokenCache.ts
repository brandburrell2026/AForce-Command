/**
 * Crash-safe Clerk token cache (B1+).
 *
 * Drop-in replacement for @clerk/expo's default `tokenCache`, used to stop the
 * production launch crash. The default cache reads the iOS Keychain at
 * ClerkProvider mount via expo-secure-store with
 * `keychainAccessible: AFTER_FIRST_UNLOCK`, and its error handling is not
 * fault-tolerant: `getToken`'s catch calls an UNGUARDED `deleteItemAsync`, and
 * `saveToken` has no try/catch at all. On iOS that surfaces as a native
 * NSException on a libdispatch background queue at launch →
 * RCTTurboModule convertNSExceptionToJSError → Hermes heap corruption →
 * EXC_BAD_ACCESS, crashing Release/TestFlight builds on every device.
 *
 * This implementation, vs. the default:
 *   - wraps EVERY expo-secure-store call (get / set / delete) in try/catch so
 *     none can throw or reject — getToken degrades to null, saveToken resolves
 *     silently;
 *   - does NOT pass `keychainAccessible: AFTER_FIRST_UNLOCK` (the option that
 *     throws before the device's first unlock at launch) — plain keychain
 *     access;
 *   - keeps the exact `getToken` / `saveToken` API shape Clerk expects, so auth
 *     logic is unchanged. A failed keychain read simply degrades to "no cached
 *     token" (the user re-authenticates once) instead of crashing the app.
 *
 * Native-gated the same way the default is (`isNative() ? cache : undefined`),
 * so on web ClerkProvider still receives `undefined` — identical to today.
 *
 * Wired behind the `secure_store_startup_guard` flag in app/_layout.tsx; flip
 * that flag false to revert to @clerk/expo's default tokenCache.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface SafeTokenCache {
  getToken: (key: string) => Promise<string | null>;
  saveToken: (key: string, token: string) => Promise<void>;
}

const createSafeTokenCache = (): SafeTokenCache => ({
  getToken: async (key) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      console.warn('[safeTokenCache] getToken keychain read failed; degrading to null', err);
      // Best-effort cleanup of a corrupt/inaccessible item — itself fully
      // guarded so it can never throw and re-trigger the launch crash.
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // swallow — a keychain delete must never crash launch
      }
      return null;
    }
  },
  saveToken: async (key, token) => {
    try {
      await SecureStore.setItemAsync(key, token);
    } catch (err) {
      console.warn('[safeTokenCache] saveToken keychain write failed; ignoring', err);
    }
  },
});

// Mirror @clerk/expo's `tokenCache = isNative() ? createTokenCache() : void 0`
// so web is unaffected (ClerkProvider receives undefined, exactly as before).
export const safeTokenCache: SafeTokenCache | undefined =
  Platform.OS !== 'web' ? createSafeTokenCache() : undefined;
