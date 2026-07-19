/**
 * Reconcile server-fetched provider biometrics into the client-owned map.
 *
 * The split of ownership is deliberate and load-bearing:
 *   - The CLIENT owns WHICH providers are linked — its key set. Connecting adds
 *     a key (a placeholder on connect); disconnecting removes it. A stale or
 *     in-flight server payload that still echoes a since-removed provider must
 *     NEVER resurrect it (the disconnect race).
 *   - The SERVER owns the DATA for a linked provider — the backend fetches WHOOP
 *     and persists it, and it rides in on `GET /aforce/state`.
 *
 * So we iterate the CLIENT's keys only, and adopt the server's snapshot for a
 * key only when it is STRICTLY fresher by `fetchedAt` — real fetched data
 * (positive timestamp) supersedes the connect-time placeholder, while an
 * equal/older server echo is ignored. Server entries for providers the client
 * doesn't have a key for are dropped (disconnected or never connected).
 *
 * Pure + total: no I/O, no input mutation, `undefined` when the client has none.
 */
import type { ProviderBiometrics, ProviderSnapshot } from '../types';

export function mergeBiometrics(
  server: ProviderBiometrics | undefined,
  client: ProviderBiometrics | undefined,
): ProviderBiometrics | undefined {
  if (!client) return undefined;
  const c = client as Record<string, ProviderSnapshot>;
  const s = (server ?? {}) as Record<string, ProviderSnapshot>;
  const out: Record<string, ProviderSnapshot> = {};
  for (const id of Object.keys(c)) {
    const cv = c[id];
    const sv = s[id];
    out[id] = sv && sv.fetchedAt > cv.fetchedAt ? sv : cv;
  }
  return Object.keys(out).length > 0 ? (out as ProviderBiometrics) : undefined;
}
