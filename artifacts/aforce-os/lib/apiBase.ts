/**
 * apiBase — THE single API base resolver (Wave-3 PR1).
 *
 * Before this module there were FIVE copies of base resolution and they
 * disagreed: four implemented the canonical order below; lib/api.ts
 * skipped EXPO_PUBLIC_API_BASE entirely, which pointed the whole
 * commerce path (checkout, portal, scans, analytics, TTS) at the dead
 * api.drinkaforce.com host while everything else talked to Railway.
 *
 * Resolution order (canonical):
 *   1. EXPO_PUBLIC_API_BASE — full URL INCLUDING `/api`. The one
 *      production source of truth (EAS production/internal profiles).
 *   2. EXPO_PUBLIC_DOMAIN — legacy host-only dev fallback (Replit dev
 *      sets it via package.json). Scheme-stripped, `https://` + `/api`.
 *   3. Web: same-origin `/api`.
 *   4. Native with nothing configured: this is a build misconfiguration.
 *      In dev we THROW (red screen on the simulator beats a silently
 *      dead TestFlight); in production we log loudly and return `/api`,
 *      which fails visibly on every request instead of pretending.
 *
 * The API host is TRANSPORT, not identity: nothing here (or anywhere)
 * derives user identity from the host. Deep links use the app scheme;
 * Clerk is keyed by its publishable key; deviceId is random.
 */
import { Platform } from 'react-native';

export function resolveApiBase(): string {
  const explicit = process.env['EXPO_PUBLIC_API_BASE'];
  if (explicit) return explicit.replace(/\/+$/, '');

  const domain = process.env['EXPO_PUBLIC_DOMAIN'];
  if (domain) {
    const host = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${host}/api`;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS !== 'web') {
    throw new Error(
      '[AForce] No API base configured: set EXPO_PUBLIC_API_BASE (full URL ' +
        'incl. /api) or EXPO_PUBLIC_DOMAIN (host only). A native build ' +
        'without one cannot reach the server.',
    );
  }
  // Production native with no config — fail visibly, never fabricate.
  // eslint-disable-next-line no-console
  console.error('[AForce] No API base configured; API requests will fail.');
  return '/api';
}

/** Resolved once at module load — env is compile-time-inlined by Expo. */
export const API_BASE = resolveApiBase();

/** Origin form (no trailing /api) for clients that append full paths. */
export function apiOrigin(): string {
  return API_BASE.replace(/\/api$/, '');
}
