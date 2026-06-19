/**
 * QR Activation — funnel + conversion engine (PURE).
 *
 * AForce's primary acquisition mechanism is a QR on a purchased can. This
 * module models the owner-specified activation funnel and the headline
 * conversions, as deterministic functions over already-recorded milestone
 * timestamps + attribution. It is the *underneath* of the funnel: no
 * React, no react-native, no storage, no `Date.now()` — so it is fully
 * unit-testable and ready for both per-device use and (Phase 2) server
 * cohort aggregation.
 *
 * Score-Protection: this engine only MEASURES progression that already
 * happened. It never dispatches, persists, awards, or mutates score/band.
 * "Build 100% · Show 10%": the math is complete; nothing is wired to a
 * surface — exposure is gated later behind the existing `spec_activation`
 * flag.
 *
 * Funnel order (owner spec):
 *   Can Purchased → QR Scanned → App Install/Open → Profile Completion →
 *   Performance Age Baseline → First Command Issued →
 *   First Command Completed (habit loop begins) → First Win Confirmed →
 *   Day-7 Subscription Offer.
 */

import type { ActivationAttribution } from './attribution';
import { EMPTY_ATTRIBUTION } from './attribution';

export type ActivationStage =
  | 'can_purchased'
  | 'qr_scanned'
  | 'app_opened'
  | 'profile_completed'
  | 'performance_age_baseline'
  | 'first_command_issued'
  | 'first_command_completed'
  | 'first_win_confirmed'
  | 'day7_subscription_offer';

/** The nine visible funnel stages, in exact owner order. */
export const ACTIVATION_STAGES: readonly ActivationStage[] = [
  'can_purchased',
  'qr_scanned',
  'app_opened',
  'profile_completed',
  'performance_age_baseline',
  'first_command_issued',
  'first_command_completed',
  'first_win_confirmed',
  'day7_subscription_offer',
];

/**
 * The paid outcome. Not a visible funnel stage (the funnel ends at the
 * Day-7 OFFER); tracked separately so the Activation→Subscription
 * conversion can measure the actual subscribe.
 */
export type ActivationMilestone = ActivationStage | 'subscription_started';

const ALL_MILESTONES: readonly ActivationMilestone[] = [
  ...ACTIVATION_STAGES,
  'subscription_started',
];

export type MilestoneTimestamps = Partial<
  Record<ActivationMilestone, string | null>
>;

export interface ActivationFunnelState {
  /** Per-milestone reached flag (true only when a valid timestamp exists). */
  reached: Record<ActivationMilestone, boolean>;
  /** Valid ISO timestamps for reached milestones. */
  reachedAt: Partial<Record<ActivationMilestone, string>>;
  /** Highest-index VISIBLE stage reached, or null. */
  furthestStage: ActivationStage | null;
  /** Index of `furthestStage` in ACTIVATION_STAGES, or -1. */
  furthestIndex: number;
  /** Count of visible stages reached (excludes `subscription_started`). */
  reachedCount: number;
  /** Attribution carried with this funnel (SKU / retail / geo / …). */
  attribution: ActivationAttribution;
}

export interface DeriveFunnelInput {
  milestones: MilestoneTimestamps;
  attribution?: ActivationAttribution | null;
}

function emptyReached(): Record<ActivationMilestone, boolean> {
  const r = {} as Record<ActivationMilestone, boolean>;
  for (const m of ALL_MILESTONES) r[m] = false;
  return r;
}

/**
 * Collapse a set of milestone timestamps + attribution into a single
 * funnel state. A milestone counts as "reached" only when its value is a
 * parseable timestamp — null / absent / unparseable are simply not
 * reached (never fabricated).
 */
export function deriveActivationFunnel(
  input: DeriveFunnelInput,
): ActivationFunnelState {
  const reached = emptyReached();
  const reachedAt: Partial<Record<ActivationMilestone, string>> = {};
  for (const m of ALL_MILESTONES) {
    const ts = input.milestones[m];
    if (ts == null) continue;
    if (Number.isFinite(Date.parse(ts))) {
      reached[m] = true;
      reachedAt[m] = ts;
    }
  }
  let furthestIndex = -1;
  let reachedCount = 0;
  ACTIVATION_STAGES.forEach((stage, i) => {
    if (reached[stage]) {
      furthestIndex = i;
      reachedCount += 1;
    }
  });
  return {
    reached,
    reachedAt,
    furthestStage:
      furthestIndex >= 0 ? ACTIVATION_STAGES[furthestIndex] ?? null : null,
    furthestIndex,
    reachedCount,
    attribution: input.attribution ?? { ...EMPTY_ATTRIBUTION },
  };
}

export type ConversionId =
  | 'scanToInstall'
  | 'installToActivation'
  | 'activationToSubscription';

export interface ConversionDef {
  id: ConversionId;
  from: ActivationMilestone;
  to: ActivationMilestone;
}

/**
 * The three headline conversions. "Activation" = First Command Completed
 * (the owner-annotated start of the habit loop).
 */
export const ACTIVATION_CONVERSIONS: readonly ConversionDef[] = [
  { id: 'scanToInstall', from: 'qr_scanned', to: 'app_opened' },
  {
    id: 'installToActivation',
    from: 'app_opened',
    to: 'first_command_completed',
  },
  {
    id: 'activationToSubscription',
    from: 'first_command_completed',
    to: 'subscription_started',
  },
];

export interface ConversionResult {
  id: ConversionId;
  from: ActivationMilestone;
  to: ActivationMilestone;
  /** Funnels that reached `from`. */
  entered: number;
  /** Funnels that reached both `from` and `to`. */
  converted: number;
  /** converted / entered, or null when none entered. */
  rate: number | null;
}

/** Aggregate one conversion across a cohort of funnels. */
export function aggregateConversion(
  funnels: readonly ActivationFunnelState[],
  def: ConversionDef,
): ConversionResult {
  let entered = 0;
  let converted = 0;
  for (const f of funnels) {
    if (!f.reached[def.from]) continue;
    entered += 1;
    // A conversion counts only when `to` was reached at or after `from`
    // (chronological progression). `elapsedMsBetween` is non-null exactly
    // when both endpoints have valid timestamps and `to >= from`, so an
    // out-of-order `to` (which is not a real conversion) never inflates the
    // headline rate.
    if (f.reached[def.to] && elapsedMsBetween(f, def.from, def.to) !== null) {
      converted += 1;
    }
  }
  return {
    id: def.id,
    from: def.from,
    to: def.to,
    entered,
    converted,
    rate: entered > 0 ? converted / entered : null,
  };
}

/** Aggregate every headline conversion across a cohort. */
export function aggregateConversions(
  funnels: readonly ActivationFunnelState[],
  defs: readonly ConversionDef[] = ACTIVATION_CONVERSIONS,
): ConversionResult[] {
  return defs.map((d) => aggregateConversion(funnels, d));
}

export type StageCounts = Record<ActivationStage, number>;

/** Count how many funnels reached each visible stage. */
export function aggregateStageCounts(
  funnels: readonly ActivationFunnelState[],
): StageCounts {
  const counts = {} as StageCounts;
  for (const s of ACTIVATION_STAGES) counts[s] = 0;
  for (const f of funnels) {
    for (const s of ACTIVATION_STAGES) if (f.reached[s]) counts[s] += 1;
  }
  return counts;
}

export type AttributionDimension =
  | 'sku'
  | 'retailLocationId'
  | 'geo'
  | 'campaign';

/** Bucket key used for funnels with no value on the segmenting dimension. */
export const UNATTRIBUTED = '(unattributed)';

/** Group funnels by an attribution dimension (SKU / retail / geo / campaign). */
export function segmentByAttribution(
  funnels: readonly ActivationFunnelState[],
  dimension: AttributionDimension,
): Map<string, ActivationFunnelState[]> {
  const out = new Map<string, ActivationFunnelState[]>();
  for (const f of funnels) {
    const key = f.attribution[dimension] ?? UNATTRIBUTED;
    const bucket = out.get(key);
    if (bucket) bucket.push(f);
    else out.set(key, [f]);
  }
  return out;
}

export interface SegmentedConversion {
  segment: string;
  results: ConversionResult[];
}

/**
 * The "track every step by SKU / Retail Location / Geography" view:
 * conversions computed per attribution segment.
 */
export function conversionsBySegment(
  funnels: readonly ActivationFunnelState[],
  dimension: AttributionDimension,
  defs: readonly ConversionDef[] = ACTIVATION_CONVERSIONS,
): SegmentedConversion[] {
  const out: SegmentedConversion[] = [];
  for (const [segment, group] of segmentByAttribution(funnels, dimension)) {
    out.push({ segment, results: aggregateConversions(group, defs) });
  }
  return out;
}

/**
 * Elapsed ms between two reached milestones for one funnel (funnel
 * velocity), or null when either is missing/unparseable or `to` precedes
 * `from`.
 */
export function elapsedMsBetween(
  funnel: ActivationFunnelState,
  from: ActivationMilestone,
  to: ActivationMilestone,
): number | null {
  const a = funnel.reachedAt[from];
  const b = funnel.reachedAt[to];
  if (a == null || b == null) return null;
  const ams = Date.parse(a);
  const bms = Date.parse(b);
  if (!Number.isFinite(ams) || !Number.isFinite(bms)) return null;
  const delta = bms - ams;
  return delta >= 0 ? delta : null;
}
