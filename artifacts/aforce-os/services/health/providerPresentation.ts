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
 * FOUNDER RULING I (RC-2, part 2 — this PR): "Observation freshness and
 * sync freshness must be displayed separately and truthfully." Part 1 (PR
 * #562) added `ProviderSnapshot.latestObservedAtMs` — optional, additive,
 * epoch ms of the newest underlying OBSERVATION, distinct from `fetchedAt`
 * (when AForce synced it). This layer is the FIRST consumer: when the
 * caller supplies `latestObservedAtMs`, presentation STATE is gated on
 * whichever axis is STALER (the conservative choice — a fresh sync of an
 * old observation must never present as fresh). `dataAgeMs` reflects that
 * same conservative age. `observedAgeMs` / `showBothFreshnessAxes` are
 * appended to the result ONLY when a real observation age was supplied —
 * never as `null` placeholders — so a caller that omits the field gets a
 * presentation object structurally IDENTICAL to pre-Ruling-I output. This is
 * a pinned parity contract; see providerPresentation.test.ts's dedicated
 * suite (including a mutation-verify key-set assertion that fails if this
 * omission discipline is ever broken).
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
  /**
   * Epoch ms of the newest OBSERVATION (Founder Ruling I, RC-2) — OPTIONAL
   * and ADDITIVE, mirrors `ProviderSnapshot.latestObservedAtMs` verbatim.
   * When present and finite, presentation state is gated on whichever axis
   * is STALER (see file header). Absent / null / non-finite ⇒ presentation
   * is byte-identical to pre-Ruling-I behavior — never fabricated, never
   * guessed from `latestFetchedAtMs`.
   */
  latestObservedAtMs?: number | null;
  nowMs: number;
}

export interface ProviderPresentation {
  state: ProviderPresentationState;
  /** True ONLY for a real link with non-stale data. */
  live: boolean;
  /**
   * Data age in ms when known — the CONSERVATIVE (staler) of sync-age and
   * observation-age once `latestObservedAtMs` was supplied; sync-age alone
   * otherwise (see `ProviderPresentationInput.latestObservedAtMs`).
   */
  dataAgeMs: number | null;
  /**
   * Observation-axis age alone, in ms — present ONLY when the input carried
   * a finite `latestObservedAtMs` (never `null`; simply absent otherwise —
   * see the parity contract in the file header). Diagnostic/composition
   * field: display copy is built from the raw `observedAtMs` timestamp
   * elsewhere (`connectedHealthContainerModel.ts` / `connectedHealthView.ts`),
   * never from this age.
   */
  observedAgeMs?: number;
  /**
   * True when sync-age and observation-age fall into genuinely different
   * §53 freshness buckets (live / stale / expired) — i.e. showing both axes
   * separately would say something a single "Synced …" line would not.
   * Present ONLY alongside `observedAgeMs` (both axes known); absent
   * whenever there is nothing extra worth saying (Ruling I's "keep the
   * existing single line — don't clutter" case).
   */
  showBothFreshnessAxes?: boolean;
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
 * windows: fresh ≤6h, stale >24h, expired >72h). Ruling I (see file header):
 * when `latestObservedAtMs` is supplied, the STALER of sync-age/
 * observation-age drives state — never the more flattering one.
 */
export function resolveProviderPresentation(input: ProviderPresentationInput): ProviderPresentation {
  const base = BASE_STATE[input.status.status];
  const isLiveBase = LIVE_BASE.has(input.status.status) && input.status.live;

  const syncAgeMs = rawAgeMs(input.latestFetchedAtMs, input.nowMs);
  const observedAgeMs = rawAgeMs(input.latestObservedAtMs, input.nowMs);
  // Parity contract: when observedAgeMs is unknown, this collapses to
  // syncAgeMs exactly — nothing downstream can tell a second axis was ever
  // considered.
  const conservativeAgeMs =
    observedAgeMs == null ? syncAgeMs : syncAgeMs == null ? observedAgeMs : Math.max(syncAgeMs, observedAgeMs);

  if (!isLiveBase) {
    return withObservationAxis({ state: base, live: false, dataAgeMs: conservativeAgeMs }, syncAgeMs, observedAgeMs);
  }

  // Real link — now gate "live" on data freshness. No snapshot at all is the
  // syncing/first-pull case, which stays honest ('syncing' already says so).
  if (conservativeAgeMs == null) {
    return withObservationAxis(
      { state: base, live: input.status.status === 'syncing', dataAgeMs: null },
      syncAgeMs,
      observedAgeMs,
    );
  }

  // #565 verdict SF-2: gate on the SAME `freshnessBucket` the axis-agreement
  // check below already uses, instead of re-deriving the §53 boundaries
  // inline. `conservativeAgeMs` is non-null here (the null case returned
  // above), so this is a direct 2/1/0 switch — behavior is byte-identical to
  // the prior inline comparisons (both read `FRESHNESS_WINDOWS.wearable_sync`
  // the same way), but now there is exactly one place that knows where the
  // §53 boundaries are, making the file header's "shared by both" comment
  // literally true.
  switch (freshnessBucket(conservativeAgeMs)) {
    case 2:
      // Stream is dark: connected credentials, no usable data. Not live.
      return withObservationAxis(
        { state: 'no_recent_data', live: false, dataAgeMs: conservativeAgeMs },
        syncAgeMs,
        observedAgeMs,
      );
    case 1:
      return withObservationAxis({ state: 'stale', live: false, dataAgeMs: conservativeAgeMs }, syncAgeMs, observedAgeMs);
    case 0:
      return withObservationAxis({ state: base, live: true, dataAgeMs: conservativeAgeMs }, syncAgeMs, observedAgeMs);
  }
}

function rawAgeMs(atMs: number | null | undefined, nowMs: number): number | null {
  if (atMs == null || !Number.isFinite(atMs)) return null;
  return Math.max(0, nowMs - atMs);
}

/** §53 freshness bucket for a single age value — 0 live/fresh-enough, 1
 *  stale, 2 expired. Shared by the conservative selection above and the
 *  "do the two axes actually disagree" check below, so both always agree
 *  on where the boundaries are. */
function freshnessBucket(ageMs: number): 0 | 1 | 2 {
  const w = FRESHNESS_WINDOWS.wearable_sync;
  if (w.expireAfterMs != null && ageMs > w.expireAfterMs) return 2;
  if (ageMs > w.staleAfterMs) return 1;
  return 0;
}

/**
 * Append the observation-axis fields ONLY when a real observation age was
 * supplied — omitted (never written as `null`) otherwise, so an absent
 * `latestObservedAtMs` produces an object structurally IDENTICAL to
 * pre-Ruling-I output (see file header + providerPresentation.test.ts).
 */
function withObservationAxis(
  base: { state: ProviderPresentationState; live: boolean; dataAgeMs: number | null },
  syncAgeMs: number | null,
  observedAgeMs: number | null,
): ProviderPresentation {
  if (observedAgeMs == null) return base;
  const showBothFreshnessAxes = syncAgeMs != null && freshnessBucket(syncAgeMs) !== freshnessBucket(observedAgeMs);
  return { ...base, observedAgeMs, showBothFreshnessAxes };
}
