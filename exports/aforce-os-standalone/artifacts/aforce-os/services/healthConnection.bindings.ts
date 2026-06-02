/**
 * Native-bound factories for the health connection layer.
 *
 * Split out from `healthConnection.ts` so the pure orchestration
 * module can be imported from Node / web / SSR test runtimes
 * without pulling react-native through the Vite SSR transformer.
 * Only the screens / hooks that actually mount the connect button
 * should import from this file.
 */

import {
  isAppleHealthSupported,
  requestAppleHealthPermissions,
} from './appleHealth';
import {
  isSamsungHealthSupported,
  requestSamsungHealthPermissions,
} from './samsungHealth';
import {
  createHealthConnection,
  type HealthConnection,
  type HealthConnectionStore,
} from './healthConnection';

/** Apple HealthKit connection bound to the real bridge. */
export function createAppleHealthConnection(store: HealthConnectionStore): HealthConnection {
  return createHealthConnection({
    providerId: 'apple_health',
    store,
    isSupported: isAppleHealthSupported,
    requestPermissions: requestAppleHealthPermissions,
  });
}

/** Samsung Health connection bound to the real bridge. */
export function createSamsungHealthConnection(store: HealthConnectionStore): HealthConnection {
  return createHealthConnection({
    providerId: 'samsung_health',
    store,
    isSupported: isSamsungHealthSupported,
    requestPermissions: requestSamsungHealthPermissions,
  });
}
