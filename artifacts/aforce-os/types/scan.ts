/**
 * Hydration Scan — type contracts.
 *
 * Real-time barcode / QR / AForce-product recognition. Returns a
 * physiology-aware fit score + AForce-equivalent recommendation.
 * NFC is reserved for future hardware integrations; the placeholder
 * field here lets the recognition service stay forward-compatible.
 */

import type { CompareProduct } from './comparison';
import type { FluidType, PerformanceLevel } from './index';

export type ScanSourceKind = 'barcode' | 'qr' | 'aforce_product' | 'nfc' | 'manual';

export interface ScanSource {
  kind: ScanSourceKind;
  /** Raw value as captured (barcode digits, QR payload, NFC tag id, or product slug). */
  rawValue: string;
}

export interface ScannedProduct {
  /** Stable id matching the comparison product database. */
  productId: string;
  productName: string;
  brand: string;
  category: CompareProduct['category'];
  /**
   * 0-100 sub-scores (mirrors comparison engine model).
   * `null` = UNKNOWN — no value on file. Never a zero (D5).
   */
  hydrationSpeed: number | null;
  electrolyteDensity: number | null;
  sugarLevel: number | null;        // higher = more sugar (worse)
  /** `null` = UNKNOWN. A measured 0 means "contains none". */
  stimulantLevel: number | null;
  recoveryFit: number | null;
  performanceFit: number | null;
  isAForce: boolean;
  /** Per-attribute evidence quality, carried from the catalog row (D3). */
  provenance?: import('./comparison').ProvenanceMap;
  /** Mapped fluid type (only set for items the user can log). */
  fluidType?: FluidType;
}

export interface ScanRecommendation {
  /** Plain-language verdict tied to the user's current state. */
  headline: string;
  /** Detailed explanation. */
  detail: string;
  /**
   * The strongest eligible alternative, if one genuinely outranked what was
   * scanned. Selected across the WHOLE catalog — any brand, plain water
   * included (D6). Was `aforceEquivalentId`, a name that encoded the
   * assumption the alternative is always AForce.
   */
  alternativeProductId?: string;
  /**
   * True when nothing on file outranked the scanned product. An explicit
   * outcome, not the absence of one (D6).
   */
  noChangeNeeded?: boolean;
  /** Decisive AI command (WHAT + WHEN + OUTCOME). */
  command: string;
  /** Whether logging the scanned product as-is is recommended. */
  shouldLog: boolean;
  /**
   * Personalization layer — dominant signals that shaped this
   * recommendation (heat, humidity, activity, recovery, alcohol,
   * consistency, mass). Surfaced as chips in `WhyThisForYouCard` so
   * the user feels the system reading their body + environment, not
   * a one-size-fits-all rule.
   *
   * Optional so older persisted scans still type-check.
   */
  personalization?: import('../utils/personalizationSignals').PersonalizationOutput;
  /**
   * Pre-Workout Support — surfaced when HydroScan recognizes a
   * pre-workout, stimulant-heavy formula, pump blend, or energy
   * formula (either in the scanned product itself or in the user's
   * recent intake). Always supportive, NEVER an attack on the
   * supplement: lines come from `utils/preWorkoutSupport.ts` and
   * talk about what the body needs next (hydration during training,
   * recovery after), not about the product being a problem. Omitted
   * when no pre-workout signal is detected.
   */
  supportiveNotes?: readonly string[];
  /**
   * Superfood Signals — surfaced when HydroScan recognizes an
   * AForce product. Carries the "SUPERFOOD SIGNALS ACTIVE" header,
   * five signal chips (Mineral / Recovery / Electrolyte Efficiency /
   * Cellular Hydration / Performance), the "TAP TO LEARN WHY" CTA,
   * the education layer (seamoss / dulse / chlorella / mineral
   * support / balanced hydration support), the AForce positioning
   * statement, and the canonical sodium-balance note. All copy
   * lives in `utils/superfoodSignals.ts` and is guarded by a
   * compliant-language regression test (no cures / treats /
   * prevents-disease wording). Omitted for non-AForce scans.
   */
  superfoodSignals?: import('../utils/superfoodSignals').SuperfoodSignalsBlock;
}

export interface ScanResult {
  /** ISO timestamp of recognition. */
  scannedAt: string;
  source: ScanSource;
  product: ScannedProduct;
  /** 0-100. Reflects fit for the user's CURRENT state. */
  /** 0-100, or `null` when nothing was known to compare on (D5). */
  currentFitScore: number | null;
  /** Coarse verdict bucket. */
  verdict: 'optimal' | 'strong' | 'acceptable' | 'suboptimal' | 'avoid';
  /** State the score was generated against (so the UI can label the verdict). */
  evaluatedAgainstState: PerformanceLevel;
  recommendation: ScanRecommendation;
  /**
   * Hydration efficiency 0..1 per spec:
   *   efficiency = M*0.4 + W*0.3 + LS*0.2 - S*0.1
   * where M = mineral / electrolyte adequacy, W = water-fraction
   * proxy (hydration speed), LS = low-sugar quality, S = sugar load.
   * Surfaced on the result card as "Hydrates at X% efficiency".
   */
  efficiency: number;
  efficiencyLabel: string;
  /**
   * HydroScan 2.0™ — profile-aware hydration impact headline (4-level).
   * Only populated when the `hydro_scan_2_enabled` flag path is used;
   * omitted otherwise so the legacy result shape stays byte-identical.
   * Advisory only — never mutates score.
   */
  hydrationImpact?: HydrationImpactResult;
  /**
   * HydroScan 2.0™ — timing guidance (3-level). Same flag-gated
   * population rule as `hydrationImpact`. Advisory only.
   */
  timingGuidance?: TimingGuidanceResult;
}

export interface ScanFailure {
  scannedAt: string;
  source: ScanSource;
  reason: 'unknown_barcode' | 'unrecognized_qr' | 'invalid_payload' | 'camera_unavailable';
  message: string;
}

export type ScanOutcome =
  | { ok: true; result: ScanResult }
  | { ok: false; failure: ScanFailure };

// ─── HydroScan 2.0™ — profile-aware impact, timing, consumption, history ──
//
// Everything below is additive and advisory. None of it mutates a
// hydration point, performance band, or recovery score (Score-Protection):
// recording consumption writes only to the local HydroScan History store
// and the explicit "Log Intake" tap remains the sole score path.

/**
 * Four-level public Hydration Impact headline. Spans beneficial →
 * neutral → load: the SAME product can land on different levels for
 * different users because weight, biological sex, activity, current
 * performance state, and environment all feed the computation.
 */
export type HydrationImpactLevel =
  | 'HIGH_SUPPORT'
  | 'NEUTRAL'
  | 'MODERATE_IMPACT'
  | 'HIGH_IMPACT';

/** A single factor that pushed the impact toward support or load. */
export interface HydrationImpactDriver {
  /** Stable key for i18n + testing (e.g. 'weight', 'heat', 'electrolytes', 'sugar'). */
  key: string;
  /** Whether this driver supported hydration or added load. */
  direction: 'support' | 'load';
}

export interface HydrationImpactResult {
  level: HydrationImpactLevel;
  /** 0..100 — higher = more supportive for THIS user. Display/sort only. */
  score: number;
  /** Dominant profile/environment drivers, most significant first. */
  drivers: HydrationImpactDriver[];
  /**
   * True when a key personalising field (body weight or activity) was
   * missing, so the output leaned more on state + environment than on
   * the user's profile.
   */
  lowConfidence: boolean;
}

/** Three-level timing guidance for when to take the product. */
export type TimingGuidanceLevel =
  | 'GOOD_TIMING'
  | 'HYDRATE_FIRST'
  | 'BEST_AFTER_NEXT_WATER_CYCLE';

export interface TimingGuidanceResult {
  level: TimingGuidanceLevel;
}

/** Consumption intent captured by the "Did you consume this?" prompt. */
export type ConsumptionStatus = 'consumed' | 'not_yet' | 'just_curious';

/** Manual category for the never-dead-end unknown-product flow. */
export type UnknownProductType =
  | 'water'
  | 'protein'
  | 'energy'
  | 'supplement'
  | 'other';

/**
 * One persisted HydroScan History row. Local + advisory: it records what
 * was scanned, whether it was consumed, the impact, and the timing
 * context. It never carries or affects score.
 */
export interface HydroScanHistoryEntry {
  id: string;
  /** ISO timestamp of the scan. */
  scannedAt: string;
  productName: string;
  brand?: string;
  isAForce: boolean;
  /** Known product category when the product was recognized. */
  category?: CompareProduct['category'];
  /** Manual type when the product came through the unknown-product flow. */
  unknownType?: UnknownProductType;
  /** Did the user consume it? */
  consumption: ConsumptionStatus;
  /** Approximate amount (oz) from the unknown-product flow; null if unknown. */
  approxOz?: number | null;
  /** Headline hydration impact at scan time. */
  impactLevel: HydrationImpactLevel;
  /** Timing context at scan time. */
  timingLevel: TimingGuidanceLevel;
}
