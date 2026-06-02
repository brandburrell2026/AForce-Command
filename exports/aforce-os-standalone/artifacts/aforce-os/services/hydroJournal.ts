/**
 * HydroJournal — memory aggregator + recovery contributor taxonomy.
 *
 * Spec Rule #5:
 *   Keep exact visuals.
 *   Connect: Timeline / Commands / Hydration / Mood / Water /
 *            Recovery / Orb
 *   Add: Recovery Contributors / Water / Timing / Minerals /
 *        Environment
 *   Journal becomes memory.
 *
 * Hidden architecture only this turn — no UI changes, no edits to
 * JournalScreen, JournalChart, JournalDayCard, JournalRangePicker,
 * KPISummary, PerformanceSections, or StreakHero. Two manifests
 * land here:
 *   1. JOURNAL_SOURCES — the seven inputs that feed the Journal
 *      "memory" so a follow-up rule pass can wire provenance into
 *      the existing day card without inventing source names.
 *   2. RECOVERY_CONTRIBUTORS — the four-category taxonomy that
 *      classifies WHY a given day recovered, plus pure helpers
 *      for normalizing arbitrary weights to a 0–100 profile.
 *
 * Gate: `spec_hydroJournal` (default true — Journal is core; only
 * the formalized contributor taxonomy is new).
 */
import { useFeatureFlags } from '@/store/useAppStore';

/** The seven inputs that feed the Journal memory. Order = spec order. */
export const JOURNAL_SOURCES = [
  'timeline',
  'commands',
  'hydration',
  'mood',
  'water',
  'recovery',
  'orb',
] as const;

export type JournalSource = (typeof JOURNAL_SOURCES)[number];

/** Verbatim spec display strings for the seven journal sources. */
export const JOURNAL_SOURCE_LABELS: Readonly<Record<JournalSource, string>> = {
  timeline: 'Timeline',
  commands: 'Commands',
  hydration: 'Hydration',
  mood: 'Mood',
  water: 'Water',
  recovery: 'Recovery',
  orb: 'Orb',
};

/**
 * The four categories that classify WHY a given day recovered.
 * Order = spec order; stable ordering matters for tie-breaking in
 * topContributor below.
 */
export const RECOVERY_CONTRIBUTORS = [
  'water',
  'timing',
  'minerals',
  'environment',
] as const;

export type RecoveryContributor = (typeof RECOVERY_CONTRIBUTORS)[number];

/** Verbatim spec display strings for the four recovery contributors. */
export const RECOVERY_CONTRIBUTOR_LABELS: Readonly<
  Record<RecoveryContributor, string>
> = {
  water: 'Water',
  timing: 'Timing',
  minerals: 'Minerals',
  environment: 'Environment',
};

/** A normalized contributor profile that sums to 100. */
export type RecoveryContributorWeights = Record<RecoveryContributor, number>;

/**
 * Pure: normalize an arbitrary weight map to a 0–100 profile that
 * sums to exactly 100. Returns null if the input is empty (all
 * zero or negative). Rounding remainder is distributed
 * deterministically: each weight is rounded down, then any
 * remaining points are handed out one-by-one in spec order until
 * the total is 100. Negative inputs are clamped to 0.
 */
export function normalizeContributors(
  raw: Partial<Record<RecoveryContributor, number>>,
): RecoveryContributorWeights | null {
  const clamped: RecoveryContributorWeights = {
    water: Math.max(0, raw.water ?? 0),
    timing: Math.max(0, raw.timing ?? 0),
    minerals: Math.max(0, raw.minerals ?? 0),
    environment: Math.max(0, raw.environment ?? 0),
  };
  const sum =
    clamped.water + clamped.timing + clamped.minerals + clamped.environment;
  if (sum <= 0) return null;
  const scaled: RecoveryContributorWeights = {
    water: (clamped.water * 100) / sum,
    timing: (clamped.timing * 100) / sum,
    minerals: (clamped.minerals * 100) / sum,
    environment: (clamped.environment * 100) / sum,
  };
  const floored: RecoveryContributorWeights = {
    water: Math.floor(scaled.water),
    timing: Math.floor(scaled.timing),
    minerals: Math.floor(scaled.minerals),
    environment: Math.floor(scaled.environment),
  };
  let remaining =
    100 -
    (floored.water + floored.timing + floored.minerals + floored.environment);
  for (const key of RECOVERY_CONTRIBUTORS) {
    if (remaining <= 0) break;
    floored[key] += 1;
    remaining -= 1;
  }
  return floored;
}

/**
 * Pure: the single highest-weighted contributor in a normalized
 * profile. Ties resolve in spec order (water → timing → minerals
 * → environment). Returns null if every weight is zero.
 */
export function topContributor(
  weights: RecoveryContributorWeights,
): RecoveryContributor | null {
  let best: RecoveryContributor | null = null;
  let bestVal = -1;
  for (const key of RECOVERY_CONTRIBUTORS) {
    if (weights[key] > bestVal) {
      best = key;
      bestVal = weights[key];
    }
  }
  return bestVal > 0 ? best : null;
}

/** Aggregate view of which journal sources reported data today. */
export interface MemorySummary {
  connectedCount: number;
  missing: JournalSource[];
}

/**
 * Pure: summarize which of the seven journal sources are present
 * in a snapshot. `sources` is the set of sources that DID report
 * data; the rest are listed in `missing` in spec order.
 */
export function summarizeMemory(
  sources: ReadonlySet<JournalSource> | readonly JournalSource[],
): MemorySummary {
  const present =
    sources instanceof Set ? sources : new Set<JournalSource>(sources);
  const missing = JOURNAL_SOURCES.filter((s) => !present.has(s));
  return {
    connectedCount: JOURNAL_SOURCES.length - missing.length,
    missing,
  };
}

export interface HydroJournalState {
  enabled: boolean;
  sources: typeof JOURNAL_SOURCES;
  sourceLabels: typeof JOURNAL_SOURCE_LABELS;
  contributors: typeof RECOVERY_CONTRIBUTORS;
  contributorLabels: typeof RECOVERY_CONTRIBUTOR_LABELS;
}

/**
 * Hidden hook. Returns the source + contributor manifests plus an
 * `enabled` boolean gated on `spec_hydroJournal`. Not consumed by
 * any UI this turn — the existing Journal screen keeps its
 * current behavior.
 */
export function useHiddenHydroJournal(): HydroJournalState {
  const flags = useFeatureFlags();
  return {
    enabled: !!flags.spec_hydroJournal,
    sources: JOURNAL_SOURCES,
    sourceLabels: JOURNAL_SOURCE_LABELS,
    contributors: RECOVERY_CONTRIBUTORS,
    contributorLabels: RECOVERY_CONTRIBUTOR_LABELS,
  };
}
