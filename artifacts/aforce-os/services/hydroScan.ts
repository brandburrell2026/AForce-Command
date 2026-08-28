/**
 * HydroScan — flow manifest + Current Moment classifier.
 *
 * Spec Rule #4:
 *   Keep current UI.
 *   Flow: Scan → Context → Command → Confirm → Orb → Timeline →
 *         Journal
 *   Add: Current Moment
 *   Examples: Warm + Stable / Cool + Recovery / Indoor + Building
 *   Add confidence.
 *   Water first.
 *   Optional support second.
 *
 * Hidden architecture only this turn — no UI changes, no edits to
 * HydrationScanScreen, urineHydrationCheck, or the existing
 * hydrationScanRecommendation tests. (beverageComparisonEngine, once
 * listed here, was retired as an orphan — its Compare-vs-Competitors
 * screen was never wired.) The canonical
 * 7-step flow, the Current Moment vocabulary (3 environments × 3
 * states), the confidence clamp, and the water-first recommendation
 * ordering land here so a follow-up rule pass can wire them into
 * the existing scan UI without inventing labels or ordering.
 *
 * Gate: `spec_hydroScan` (default true — HydroScan is core; only
 * the formalized flow + Moment classifier are new).
 */
import { useFeatureFlags } from '@/store/useAppStore';

/** Canonical 7-step HydroScan flow, in spec order. */
export const HYDROSCAN_FLOW = [
  'scan',
  'context',
  'command',
  'confirm',
  'orb',
  'timeline',
  'journal',
] as const;

export type HydroScanStep = (typeof HYDROSCAN_FLOW)[number];

/** Verbatim spec display strings for the flow steps. */
export const HYDROSCAN_FLOW_LABELS: Readonly<Record<HydroScanStep, string>> = {
  scan: 'Scan',
  context: 'Context',
  command: 'Command',
  confirm: 'Confirm',
  orb: 'Orb',
  timeline: 'Timeline',
  journal: 'Journal',
};

/**
 * Pure: the next step after `stage` in the flow, or null if
 * `stage` is the terminal step.
 */
export function nextFlowStep(stage: HydroScanStep): HydroScanStep | null {
  const idx = HYDROSCAN_FLOW.indexOf(stage);
  if (idx < 0 || idx >= HYDROSCAN_FLOW.length - 1) return null;
  return HYDROSCAN_FLOW[idx + 1]!;
}

/** Pure: has the user reached the terminal Journal step? */
export function isFlowComplete(stage: HydroScanStep): boolean {
  return stage === 'journal';
}

/** Environment half of a Current Moment. Spec examples: Warm / Cool / Indoor. */
export const MOMENT_ENVIRONMENTS = ['warm', 'cool', 'indoor'] as const;
export type MomentEnvironment = (typeof MOMENT_ENVIRONMENTS)[number];

export const MOMENT_ENVIRONMENT_LABELS: Readonly<
  Record<MomentEnvironment, string>
> = {
  warm: 'Warm',
  cool: 'Cool',
  indoor: 'Indoor',
};

/** Body-state half of a Current Moment. Spec examples: Stable / Recovery / Building. */
export const MOMENT_STATES = ['stable', 'recovery', 'building'] as const;
export type MomentState = (typeof MOMENT_STATES)[number];

export const MOMENT_STATE_LABELS: Readonly<Record<MomentState, string>> = {
  stable: 'Stable',
  recovery: 'Recovery',
  building: 'Building',
};

/** A Current Moment paired with a confidence score in [0, 1]. */
export interface CurrentMoment {
  environment: MomentEnvironment;
  state: MomentState;
  /** Classifier confidence, clamped to [0, 1]. */
  confidence: number;
}

/**
 * Pure: format a Moment for display. Output matches the spec
 * examples exactly: "Warm + Stable" / "Cool + Recovery" /
 * "Indoor + Building".
 */
export function formatMoment(
  moment: Pick<CurrentMoment, 'environment' | 'state'>,
): string {
  return `${MOMENT_ENVIRONMENT_LABELS[moment.environment]} + ${MOMENT_STATE_LABELS[moment.state]}`;
}

/**
 * Pure: clamp a confidence value to [0, 1]. NaN and non-finite
 * inputs collapse to 0 — a classifier that returns garbage gets
 * treated as "no confidence" rather than poisoning downstream UI.
 */
export function clampConfidence(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** One post-scan recommendation. `kind` enforces the spec ordering. */
export interface ScanRecommendation {
  /** 'water' rows always sort before 'support' rows. */
  kind: 'water' | 'support';
  label: string;
  /** Recommendation confidence, expected to be already clamped to [0, 1]. */
  confidence: number;
}

/**
 * Pure: order recommendations per spec — "Water first. Optional
 * support second." Within each group, sort by descending
 * confidence. Stable for equal-confidence ties (preserves input
 * order). Returns a new array; does not mutate input.
 */
export function orderRecommendations(
  recs: readonly ScanRecommendation[],
): ScanRecommendation[] {
  const water = recs
    .map((r, i) => ({ r, i }))
    .filter((x) => x.r.kind === 'water');
  const support = recs
    .map((r, i) => ({ r, i }))
    .filter((x) => x.r.kind === 'support');
  const byConfThenIndex = (a: { r: ScanRecommendation; i: number },
                           b: { r: ScanRecommendation; i: number }) =>
    b.r.confidence - a.r.confidence || a.i - b.i;
  water.sort(byConfThenIndex);
  support.sort(byConfThenIndex);
  return [...water, ...support].map((x) => x.r);
}

export interface HydroScanState {
  enabled: boolean;
  flow: typeof HYDROSCAN_FLOW;
  flowLabels: typeof HYDROSCAN_FLOW_LABELS;
  environments: typeof MOMENT_ENVIRONMENTS;
  environmentLabels: typeof MOMENT_ENVIRONMENT_LABELS;
  states: typeof MOMENT_STATES;
  stateLabels: typeof MOMENT_STATE_LABELS;
}

/**
 * Hidden hook. Returns the flow + Moment manifests plus an
 * `enabled` boolean gated on `spec_hydroScan`. Not consumed by
 * any UI this turn — the existing scan screen keeps its current
 * behavior.
 */
export function useHiddenHydroScan(): HydroScanState {
  const flags = useFeatureFlags();
  return {
    enabled: !!flags.spec_hydroScan,
    flow: HYDROSCAN_FLOW,
    flowLabels: HYDROSCAN_FLOW_LABELS,
    environments: MOMENT_ENVIRONMENTS,
    environmentLabels: MOMENT_ENVIRONMENT_LABELS,
    states: MOMENT_STATES,
    stateLabels: MOMENT_STATE_LABELS,
  };
}
