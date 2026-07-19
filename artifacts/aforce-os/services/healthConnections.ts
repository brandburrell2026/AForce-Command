/**
 * HEALTH CONNECTIONS — thin client over each cloud provider's GET /status route.
 *
 * Fetches the real, server-verified connection state for a cloud OAuth provider
 * (WHOOP / Garmin / Oura / Strava) and maps it — via the pure
 * utils/health/healthConnectionMapping helpers — into the (integrationReady, link)
 * signals that resolveHealthProviderStatus consumes. The 404-means-not-credentialed
 * semantics are handled in the pure layer, which is where the honesty rule is
 * tested; this file is just the fetch.
 *
 * Mirrors the injectable-seam pattern in services/garmin.ts so the mapping stays
 * unit-testable without global fetch mocking. Never fabricates a connection.
 */
import { AforceApiError, getJsonAforceApi } from './aforceApiClient';
import {
  mapHealthConnectionProbe,
  probeFromStatusResult,
  type HealthConnectionSignals,
  type HealthStatusResponse,
} from '../utils/health/healthConnectionMapping';
import type { HealthProviderId } from '../data/healthProviders';

/** Cloud OAuth providers that expose GET /api/<provider>/status. */
export const CLOUD_STATUS_PATH: Partial<Record<HealthProviderId, string>> = {
  whoop: '/whoop/status',
  garmin: '/garmin/status',
  oura: '/oura/status',
  strava: '/strava/status',
};

export interface HealthConnectionsDeps {
  /** Injectable client seam (defaults to the real api-client) — keeps mapping testable. */
  getJson?: (path: string) => Promise<unknown>;
  /** Epoch ms for expiry evaluation (defaults to Date.now()). */
  now?: number;
}

/**
 * Resolve a cloud provider's real connection signals. Non-cloud providers (Apple
 * Health / Google Health Connect / Samsung) have no /status route — they return
 * not-ready here and are resolved from native availability by the caller instead.
 */
export async function fetchHealthConnectionSignals(
  provider: HealthProviderId,
  deps: HealthConnectionsDeps = {},
): Promise<HealthConnectionSignals> {
  const path = CLOUD_STATUS_PATH[provider];
  if (!path) return { integrationReady: false, link: 'none' };

  const getJson = deps.getJson ?? getJsonAforceApi;
  const now = deps.now ?? Date.now();
  try {
    const body = (await getJson(path)) as HealthStatusResponse;
    return mapHealthConnectionProbe(probeFromStatusResult({ ok: true, body }, now));
  } catch (e) {
    // 404 (route not mounted) → not credentialed; any other error → indeterminate.
    const status = e instanceof AforceApiError ? e.status : 0;
    return mapHealthConnectionProbe(probeFromStatusResult({ ok: false, status }));
  }
}
