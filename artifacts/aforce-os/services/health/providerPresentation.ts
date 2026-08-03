/**
 * providerPresentation — freshness-aware presentation state for a health
 * provider row/card. Foundation 1A.
 *
 * The §26 resolver (`utils/health/healthProviderStatus.ts`) is the source of
 * truth for CONNECTION status and is deliberately timestamp-free. This layer
 * composes it with the §53 freshness windows (`config/hydroStateModel.ts`,
 * read-only import — that file is off-limits to modification) to answer the
 * question the resolver cannot: is the CONNECTED provider actually
 * delivering recent data?
 *
 * HONESTY RULES
 *   - A provider is NEVER presented as connected/live merely because a stale
 *     snapshot exists: a connected link with an expired snapshot presents as
 *     `no_recent_data`; with a stale one, `stale`. Both keep `live: false`
 *     at the presentation level.
 *   - This layer only DOWNGRADES a status by freshness; it never upgrades
 *     (a disconnected provider with a fresh leftover snapshot is still
 *     disconnected — that leftover is PR 1B's deletion-semantics problem).
 *
 * Pure: clock injected, no store, no I/O.
 */

import type { ProviderPresentationState } from '@workspace/health-core';
import {
  type HealthProviderStatus,
  type HealthProviderUiStatus,
} from '@/utils/health/healthProviderStatus';
import { FRESHNESS_WINDOWS } from '@/config/hydroStateModel';

export interface ProviderPresentationInput {
  /** Output of resolveHealthProviderStatus (via deriveProviderRowStatus). */
  status: HealthProviderStatus;
  /** fetchedAt (epoch ms) of this provider's newest snapshot; null when none. */
  latestFetchedAtMs: number | null;
  nowMs: number;
}

export interface ProviderPresentation {
  state: ProviderPresentationState;
  /** True ONLY for a real link with non-stale data. */
  live: boolean;
  /** Data age in ms when known. */
  dataAgeMs: number | null;
}

/** §26 UI status → canonical presentation vocabulary (health-core). */
const BASE_STATE: Record<HealthProviderUiStatus, ProviderPresentationState> = {
  connect: 'disconnected',
  connecting: 'connecting',
  connected: 'connected',
  partially_authorized: 'connected_limited',
  syncing: 'syncing',
  needs_attention: 'action_required',
  available_through_health_connect: 'via_health_connect',
  approval_pending: 'requires_external_approval',
  coming_soon: 'dormant',
  unsupported: 'unavailable',
};

const LIVE_BASE: ReadonlySet<HealthProviderUiStatus> = new Set([
  'connected', 'syncing', 'partially_authorized',
]);

/**
 * Compose connection status with data freshness (§53 `wearable_sync`
 * windows: fresh ≤6h, stale >24h, expired >72h).
 */
export function resolveProviderPresentation(input: ProviderPresentationInput): ProviderPresentation {
  const base = BASE_STATE[input.status.status];
  const isLiveBase = LIVE_BASE.has(input.status.status) && input.status.live;

  if (!isLiveBase) {
    return { state: base, live: false, dataAgeMs: ageOf(input) };
  }

  // Real link — now gate "live" on data freshness. No snapshot at all is the
  // syncing/first-pull case, which stays honest ('syncing' already says so).
  const age = ageOf(input);
  if (age == null) {
    return { state: base, live: input.status.status === 'syncing', dataAgeMs: null };
  }

  const w = FRESHNESS_WINDOWS.wearable_sync;
  if (w.expireAfterMs != null && age > w.expireAfterMs) {
    // Stream is dark: connected credentials, no usable data. Not live.
    return { state: 'no_recent_data', live: false, dataAgeMs: age };
  }
  if (age > w.staleAfterMs) {
    return { state: 'stale', live: false, dataAgeMs: age };
  }
  return { state: base, live: true, dataAgeMs: age };
}

function ageOf(input: ProviderPresentationInput): number | null {
  if (input.latestFetchedAtMs == null || !Number.isFinite(input.latestFetchedAtMs)) return null;
  return Math.max(0, input.nowMs - input.latestFetchedAtMs);
}
