/**
 * DATA FRESHNESS™ (Section 53) — how CURRENT is a signal's supporting data?
 *
 * The fourth confidence-input layer, beside §54 Signal Quality (source) and §55
 * Profile Completeness. §53 answers RECENCY only: given a capture time and the
 * signal's per-kind windows, how old is the data and how much should its age cap
 * its usefulness? It reads timestamps and nothing else.
 *
 * SCOPE BOUNDARY (load-bearing — keep the layers orthogonal):
 *   - §53 grades AGE only. A stale Phantom reading is still Excellent-*source*
 *     (§54); §53 caps its EFFECTIVE quality for being old. It never inspects the
 *     source id (§54) or which profile fields are filled (§55).
 *
 * COMPOSITION (the anti-double-count ruling): §53 does NOT emit its own
 * confidence signals — that would count one signal twice and could let a single
 * fresh reading trip the ≥2-verified HIGH band on its own. Instead freshness
 * DOWNGRADES the §54 source rating via a floor (min) BEFORE the Data Confidence
 * bridge: `effective = min(sourceRating, freshnessCeiling(freshness))`. One
 * signal, one rating, counted once. Freshness can only lower a rating, never
 * promote it.
 *
 * Thresholds live in config/hydroStateModel.ts (build contract — never hardcoded
 * here). Pure module — no React Native, no I/O, no Date.now() (`now` is passed
 * in). Score-Protection: returns data only; never mutates a score, band, or color.
 */

import type { SignalQualityRating } from './signalQuality';
import {
  FRESHNESS_WINDOWS,
  type FreshnessSignalKind,
  type FreshnessWindows,
} from '../../config/hydroStateModel';

export type { FreshnessSignalKind, FreshnessWindows };

export type FreshnessRating = 'fresh' | 'aging' | 'stale' | 'expired';

export interface FreshnessResult {
  kind: FreshnessSignalKind;
  rating: FreshnessRating;
  /** Age in ms, or null when undated. */
  ageMs: number | null;
  undated: boolean;
  /** The cap this freshness places on a §54 source rating. */
  ceiling: SignalQualityRating;
}

// §54 rating scale, expressed locally so §53 stays decoupled from §54's internals
// (it imports only the shared TYPE). This ordinal vocabulary is fixed.
const QUALITY_ORDER: Record<SignalQualityRating, number> = {
  unavailable: 0,
  limited: 1,
  good: 2,
  excellent: 3,
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** fresh→excellent (no cap), aging→good, stale→limited, expired→unavailable. */
export function freshnessCeiling(rating: FreshnessRating): SignalQualityRating {
  switch (rating) {
    case 'fresh':
      return 'excellent';
    case 'aging':
      return 'good';
    case 'stale':
      return 'limited';
    case 'expired':
      return 'unavailable';
  }
}

/**
 * Age → freshness rating. Pure + deterministic.
 *   - undated (capturedAt null/undefined/non-finite) → `stale` (present but
 *     currency unconfirmable — the conservative middle, never `expired`).
 *   - future timestamp (age ≤ 0) → `fresh` (clock skew, certainly not stale).
 *   - age ≤ freshUntil → fresh; ≤ staleAfter → aging;
 *   - beyond expireAfter (when defined) → expired; otherwise → stale.
 */
export function assessFreshness(
  kind: FreshnessSignalKind,
  capturedAt: number | null | undefined,
  now: number,
  windows: FreshnessWindows = FRESHNESS_WINDOWS[kind],
): FreshnessResult {
  if (!isFiniteNumber(capturedAt) || !isFiniteNumber(now)) {
    return { kind, rating: 'stale', ageMs: null, undated: true, ceiling: freshnessCeiling('stale') };
  }
  const ageMs = now - capturedAt;
  let rating: FreshnessRating;
  if (ageMs <= 0) {
    rating = 'fresh';
  } else if (ageMs <= windows.freshUntilMs) {
    rating = 'fresh';
  } else if (ageMs <= windows.staleAfterMs) {
    rating = 'aging';
  } else if (windows.expireAfterMs != null && ageMs > windows.expireAfterMs) {
    rating = 'expired';
  } else {
    rating = 'stale';
  }
  return { kind, rating, ageMs, undated: false, ceiling: freshnessCeiling(rating) };
}

/**
 * The composition: cap a §54 source rating by freshness. `min` guarantees
 * freshness can only downgrade, never promote. This is the ONE call a consumer
 * makes to fold recency in before `ratingToQuality` / `assessDataConfidence`.
 */
export function applyFreshness(
  sourceRating: SignalQualityRating,
  freshness: FreshnessRating,
): SignalQualityRating {
  const ceiling = freshnessCeiling(freshness);
  return QUALITY_ORDER[sourceRating] <= QUALITY_ORDER[ceiling] ? sourceRating : ceiling;
}
