/**
 * SIGNAL QUALITY™ (Section 54) — a per-signal source-quality grader.
 *
 * Each named signal gets a rating in the §54 vocabulary — Excellent / Good /
 * Limited / Unavailable — driven ONLY by the quality of the SOURCE currently
 * behind it. This is the granular producer that FEEDS the Data Confidence Layer
 * (the aggregator); it does not reimplement it. `ratingToQuality` maps each
 * rating into the exact `SignalQuality` vocabulary `assessDataConfidence`
 * already consumes, so there is one aggregator, not two.
 *
 * SCOPE BOUNDARY (load-bearing — keep the layers orthogonal):
 *   - §54 grades SOURCE identity only (which device/entry produced the value).
 *   - Data RECENCY is §53 (Data Freshness) — this module NEVER reads a
 *     timestamp. A stale Phantom reading is still Excellent-*source*; §53 flags
 *     the staleness separately.
 *   - Profile COMPLETENESS is §55 — not consulted here.
 * The three compose at the display layer, never inside one another.
 *
 * REDISTRIBUTION ("never fail because one signal is unavailable"): already
 * satisfied upstream — `resolveSignal` (utils/signalHierarchy) walks the ladder
 * to the best-available source and `assessDataConfidence` renormalizes over
 * whatever is present. §54 EXPOSES and asserts that graceful degradation; it
 * implements NO new weighting and touches NO scoring. It must not claim the
 * score itself is reweighted (that is scoringEngine's off-limits contract,
 * unread here) — only that we always select the best available source and
 * report honest per-signal quality.
 *
 * Pure module — no React Native, no I/O, no Date.now(). Score-Protection:
 * returns data only; never mutates a score, band, or color. Build 100 / Show 10.
 */

import type { SignalTier } from '../verification/verificationLayer';
import type { SignalSourceId } from '../signalHierarchy';
import type { DataSignalInput, SignalQuality } from './dataConfidence';

// ─── Vocabulary ───────────────────────────────────────────────────────

export type SignalQualityRating = 'excellent' | 'good' | 'limited' | 'unavailable';

/** The §54 signal set, modeled as KINDS (sources are providers, never rated in the abstract). */
export type QualitySignalKind =
  | 'water_intake'
  | 'sleep'
  | 'heart_rate'
  | 'hrv'
  | 'activity'
  | 'hydration_verification'
  | 'weather'
  | 'climate_profile'
  | 'environmental_pressure';

/** Provenance rubric for environmental kinds (no wearable tier applies). */
export type EnvironmentalProvenance =
  | 'measured_live'      // measured, live, the user's actual location
  | 'measured_regional'  // measured but regional / interpolated
  | 'default'            // climatological normal / profile default
  | 'absent';            // no location / no reading

export interface SignalQualityInput {
  kind: QualitySignalKind;
  /** Winning source from resolveSignal, or null when it returned null. Biometric/hydration kinds. */
  source?: SignalSourceId | null;
  /** Corroborating wearable count — ANNOTATION only; never promotes the tier. */
  corroboratingCount?: number;
  /** Environmental kinds only. */
  provenance?: EnvironmentalProvenance;
  /** Derived kinds (e.g. environmental_pressure): rating = FLOOR of these kinds' ratings. */
  derivedFrom?: QualitySignalKind[];
}

export interface SignalQualityAssessment {
  kind: QualitySignalKind;
  rating: SignalQualityRating;
  /** The tier that drove the rating, when a source applied. */
  tier?: SignalTier;
  source: SignalSourceId | null;
  /** Internal debug hint — NOT UI copy, no i18n. */
  note: string;
}

export interface SignalQualitySummary {
  signals: SignalQualityAssessment[];
  counts: Record<SignalQualityRating, number>;
  /** Best-available headline ("strongest signal we have") — NOT a new score/band. */
  overall: SignalQualityRating;
  /** Bridge to the Data Confidence Layer — no aggregation duplicated here. */
  asDataSignals: DataSignalInput[];
}

// ─── Locked mapping tables (§54 owns these; provider catalog untouched) ─

/** Which tier each signal source belongs to. Aggregators/HydroScan are device-grade (wearable). */
export const SOURCE_TIER: Record<SignalSourceId, SignalTier> = {
  phantom: 'phantom',
  whoop: 'wearable',
  apple_watch: 'wearable',
  samsung_watch: 'wearable',
  garmin: 'wearable',
  apple_health: 'wearable',   // platform aggregator — a value here arrived from a device
  samsung_health: 'wearable',
  google_health: 'wearable',
  urine_intelligence: 'wearable', // HydroScan — proprietary optical measurement
  voice_checkin: 'phone',
  manual: 'phone',
  hydration_logs: 'phone',
};

const RATING_ORDER: Record<SignalQualityRating, number> = {
  unavailable: 0,
  limited: 1,
  good: 2,
  excellent: 3,
};

const ALL_RATINGS: readonly SignalQualityRating[] = ['excellent', 'good', 'limited', 'unavailable'];

// ─── Core mappings ────────────────────────────────────────────────────

/** Tier → rating. `null` (no source) → unavailable. Wearable never promotes to excellent. */
export function ratingForTier(tier: SignalTier | null): SignalQualityRating {
  switch (tier) {
    case 'phantom':
      return 'excellent';
    case 'wearable':
      return 'good';
    case 'phone':
      return 'limited';
    default:
      return 'unavailable';
  }
}

/**
 * Bridge into the Data Confidence Layer's vocabulary. excellent|good → verified
 * (device/measurement-grade, ≥ the wearable line), limited → partial
 * (phone/self-report floor), unavailable → estimated (absent).
 */
export function ratingToQuality(rating: SignalQualityRating): SignalQuality {
  switch (rating) {
    case 'excellent':
    case 'good':
      return 'verified';
    case 'limited':
      return 'partial';
    case 'unavailable':
      return 'estimated';
  }
}

/** Environmental provenance → rating. Ceiling is `good` — never excellent (no ground truth about the individual). */
function ratingForProvenance(p: EnvironmentalProvenance | undefined): SignalQualityRating {
  switch (p) {
    case 'measured_live':
      return 'good';
    case 'measured_regional':
    case 'default':
      return 'limited';
    default: // 'absent' | undefined
      return 'unavailable';
  }
}

const ENVIRONMENTAL_KINDS: ReadonlySet<QualitySignalKind> = new Set([
  'weather', 'climate_profile', 'environmental_pressure',
]);

function tierForSource(source: SignalSourceId | null | undefined): SignalTier | null {
  if (source == null) return null;
  return SOURCE_TIER[source] ?? null;
}

function minRating(a: SignalQualityRating, b: SignalQualityRating): SignalQualityRating {
  return RATING_ORDER[a] <= RATING_ORDER[b] ? a : b;
}

function maxRating(a: SignalQualityRating, b: SignalQualityRating): SignalQualityRating {
  return RATING_ORDER[a] >= RATING_ORDER[b] ? a : b;
}

/** Base rating ignoring derivation (source/provenance only). */
function baseRating(input: SignalQualityInput): { rating: SignalQualityRating; tier: SignalTier | null } {
  if (ENVIRONMENTAL_KINDS.has(input.kind)) {
    return { rating: ratingForProvenance(input.provenance), tier: null };
  }
  const tier = tierForSource(input.source);
  return { rating: ratingForTier(tier), tier };
}

// ─── Resolver ─────────────────────────────────────────────────────────

/**
 * Grade a set of signals. Pure + deterministic. A derived kind (its
 * `derivedFrom` non-empty) rates as the FLOOR of its inputs' base ratings — a
 * composite is only as trustworthy as its weakest input; a referenced kind not
 * present is treated as `unavailable` (the floor). Everything else rates from
 * its own source (biometric/hydration) or provenance (environmental).
 *
 * Derivation is SINGLE-LEVEL: `derivedFrom` is resolved against base ratings
 * only, so a derived kind that references another derived kind reads that kind's
 * BASE rating (never its resolved one). Today the only derived kind
 * (`environmental_pressure`) references non-derived kinds; keep it that way, or
 * resolve in dependency order if chaining is ever intended. The direction is
 * always conservative (floor), so a chain can only under-rate, never overstate.
 */
export function assessSignalQuality(
  inputs: readonly SignalQualityInput[],
): SignalQualitySummary {
  // Pass 1 — base ratings for every input, indexed by kind for derivation lookups.
  const baseByKind = new Map<QualitySignalKind, SignalQualityRating>();
  const bases = inputs.map((input) => {
    const b = baseRating(input);
    baseByKind.set(input.kind, b.rating);
    return b;
  });

  // Pass 2 — resolve derived kinds against the base map.
  const signals: SignalQualityAssessment[] = inputs.map((input, i) => {
    let { rating } = bases[i];
    const { tier } = bases[i];
    if (input.derivedFrom && input.derivedFrom.length > 0) {
      rating = input.derivedFrom.reduce<SignalQualityRating>(
        (floor, dep) => minRating(floor, baseByKind.get(dep) ?? 'unavailable'),
        'excellent',
      );
    }
    const source = input.source ?? null;
    const corr = input.corroboratingCount && input.corroboratingCount > 1
      ? ` (corroborated ×${Math.floor(input.corroboratingCount)})`
      : '';
    const note = tier
      ? `${input.kind}: ${rating} — ${source ?? 'unknown'} [${tier}]${corr}`
      : `${input.kind}: ${rating}`;
    return { kind: input.kind, rating, tier: tier ?? undefined, source, note };
  });

  const counts: Record<SignalQualityRating, number> = {
    excellent: 0, good: 0, limited: 0, unavailable: 0,
  };
  for (const s of signals) counts[s.rating] += 1;

  const overall = signals.reduce<SignalQualityRating>(
    (best, s) => maxRating(best, s.rating),
    'unavailable',
  );

  const asDataSignals: DataSignalInput[] = signals.map((s) => ({
    key: s.kind,
    quality: ratingToQuality(s.rating),
  }));

  return { signals, counts, overall, asDataSignals };
}

/** Exposed for exhaustiveness tests / display ordering. */
export const SIGNAL_QUALITY_RATINGS = ALL_RATINGS;
