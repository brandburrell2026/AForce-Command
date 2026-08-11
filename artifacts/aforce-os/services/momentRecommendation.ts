/**
 * momentRecommendation — the AForce Moments preparation engine (Phases 1–2,
 * founder approval 2026-08-12). PURE: `(moments, signals, now) →
 * MomentRecommendation[]`. No store reads, no I/O, no clocks — callers pass
 * everything. Logic lives here, never in UI components (founder spec).
 *
 * CONTRACT
 *  - Advisory only (Score Protection, DR-001): output is a read-only
 *    projection; nothing mutates score, and no numeric moment score exists.
 *  - Water-First: the primary action of every ritual is hydration; optional
 *    support (electrolytes / breathe) only ever rides second.
 *  - All tunables come from config/hydroStateModel.ts (Build Rule 13):
 *    MOMENT_PREP_WINDOW_MIN, MOMENT_HYDRATE_OZ, MOMENT_LOCK_IN_BEFORE_MIN,
 *    MOMENT_PAUSE_SECONDS, MOMENT_HYDRATE_BEST_BEFORE_FRACTION,
 *    MOMENT_SURFACE_HORIZON_HOURS.
 *  - WHY THIS reuses the Evidence Engine's fail-closed CommandEvidence shape:
 *    every item is a REAL signal the recommendation actually used, with
 *    freshness + provenance; degraded signals lower confidence, never
 *    fabricate. Works with zero health/wearable inputs (timing + event type
 *    + hydration behavior only) — the founder's fallback requirement.
 */

import type {
  Moment,
  MomentAction,
  MomentRecommendation,
  RitualStage,
  RitualStageState,
} from '@/types/moments';
import type { CommandEvidence, EvidenceItem } from '@/utils/scoring/commandEvidence';
import {
  MOMENT_PREP_WINDOW_MIN,
  MOMENT_IMPORTANCE_WINDOW_SCALE,
  MOMENT_HYDRATE_OZ,
  MOMENT_LOCK_IN_BEFORE_MIN,
  MOMENT_PAUSE_SECONDS,
  MOMENT_HYDRATE_BEST_BEFORE_FRACTION,
  MOMENT_SURFACE_HORIZON_HOURS,
} from '@/config/hydroStateModel';

const MIN_MS = 60_000;

/** Real signals the engine may cite. Every field optional — missing inputs
 *  degrade confidence, never block (founder fallback requirement). */
export interface MomentSignals {
  /** Whole-% progress toward today's hydration target (real store state). */
  hydrationPct?: number;
  /** Engine band label, e.g. 'BALANCED' (read-only engine output). */
  performanceLevel?: string;
  /** Current compliance streak in days. */
  streakDays?: number;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function stageState(startMs: number, endMs: number, nowMs: number): RitualStageState {
  if (nowMs >= endMs) return 'completed';
  if (nowMs >= startMs) return 'active';
  return 'upcoming';
}

function buildEvidence(moment: Moment, signals: MomentSignals, nowMs: number): CommandEvidence {
  const startMs = Date.parse(moment.startAtIso);
  const minutesUntil = Math.max(0, Math.round((startMs - nowMs) / MIN_MS));
  const items: EvidenceItem[] = [
    {
      key: 'moment_timing',
      labelKey: 'moments.evidence.timing',
      labelParams: { minutes: minutesUntil },
      value: minutesUntil,
      unit: 'min',
      freshness: { status: 'fresh' },
      direction: 'context',
      provenance: 'clock',
    },
    {
      key: 'moment_type',
      labelKey: `moments.evidence.type_${moment.type}`,
      value: moment.type,
      freshness: { status: 'fresh' },
      direction: 'raises_demand',
      provenance: 'user_behavior',
    },
  ];
  if (typeof signals.hydrationPct === 'number' && Number.isFinite(signals.hydrationPct)) {
    items.push({
      key: 'hydration_progress',
      labelKey: 'moments.evidence.hydration',
      labelParams: { pct: Math.round(signals.hydrationPct) },
      value: Math.round(signals.hydrationPct),
      unit: '%',
      freshness: { status: 'fresh' },
      direction: signals.hydrationPct >= 100 ? 'protective' : 'lowers_readiness',
      provenance: 'score_engine',
    });
  }
  if (typeof signals.streakDays === 'number' && signals.streakDays > 0) {
    items.push({
      key: 'streak',
      labelKey: 'moments.evidence.streak',
      labelParams: { days: signals.streakDays },
      value: signals.streakDays,
      unit: 'days',
      freshness: { status: 'fresh' },
      direction: 'positive_reinforcement',
      provenance: 'user_behavior',
    });
  }
  const confidence = typeof signals.hydrationPct === 'number' ? 'high' : 'medium';
  return {
    commandId: `moment:${moment.id}`,
    summaryKey: `moments.evidence.summary_${moment.type}`,
    confidence,
    items,
    integrity: 'matched',
  };
}

function primaryActionFor(moment: Moment, bestBeforeIso: string): MomentAction {
  const [ozMin, ozMax] = MOMENT_HYDRATE_OZ[moment.type];
  return {
    kind: 'hydrate',
    labelKey: ozMin === ozMax ? 'moments.action.hydrate_exact' : 'moments.action.hydrate_range',
    labelParams: { ozMin, ozMax, oz: ozMin },
    bestBeforeIso,
  };
}

function secondaryActionFor(moment: Moment): MomentAction | undefined {
  switch (moment.type) {
    case 'training':
      return { kind: 'electrolytes', labelKey: 'moments.action.electrolytes' };
    case 'travel':
      return { kind: 'breathe', labelKey: 'moments.action.breathe' };
    default:
      return undefined; // never more than 2 actions; most types carry 1
  }
}

/** Build the preparation projection for one moment. Pure. */
export function buildRecommendation(
  moment: Moment,
  signals: MomentSignals,
  nowIso: string,
): MomentRecommendation {
  const nowMs = Date.parse(nowIso);
  const startMs = Date.parse(moment.startAtIso);
  const windowSpec = MOMENT_PREP_WINDOW_MIN[moment.type];
  const scale = MOMENT_IMPORTANCE_WINDOW_SCALE[moment.importance];
  const prepStartMs = startMs - windowSpec.startBefore * scale * MIN_MS;
  const prepEndMs = startMs - windowSpec.endBefore * scale * MIN_MS;
  const bestBeforeMs =
    prepStartMs + (prepEndMs - prepStartMs) * MOMENT_HYDRATE_BEST_BEFORE_FRACTION;
  const lockInMs = startMs - MOMENT_LOCK_IN_BEFORE_MIN * MIN_MS;

  const prepared = Boolean(moment.preparedAtIso);
  const ritual: RitualStage[] = [
    {
      key: 'pause',
      atIso: iso(prepStartMs),
      state: prepared ? 'completed' : stageState(prepStartMs, prepStartMs + MOMENT_PAUSE_SECONDS * 1000, nowMs),
      instructionKey: 'moments.ritual.pause',
      instructionParams: { seconds: MOMENT_PAUSE_SECONDS },
    },
    {
      key: 'hydrate',
      atIso: iso(prepStartMs),
      state: prepared ? 'completed' : stageState(prepStartMs, bestBeforeMs, nowMs),
      instructionKey: 'moments.ritual.hydrate',
      instructionParams: {
        ozMin: MOMENT_HYDRATE_OZ[moment.type][0],
        ozMax: MOMENT_HYDRATE_OZ[moment.type][1],
      },
    },
    {
      key: 'lock_in',
      atIso: iso(lockInMs),
      state: prepared ? 'completed' : stageState(lockInMs, startMs, nowMs),
      instructionKey: 'moments.ritual.lock_in',
      instructionParams: { minutes: MOMENT_LOCK_IN_BEFORE_MIN },
    },
    {
      key: 'perform',
      atIso: iso(startMs),
      state: nowMs >= startMs ? 'completed' : prepared ? 'active' : 'upcoming',
      instructionKey: `moments.ritual.perform_${moment.type}`,
    },
  ];

  return {
    momentId: moment.id,
    prepWindowStartIso: iso(prepStartMs),
    prepWindowEndIso: iso(prepEndMs),
    primaryAction: primaryActionFor(moment, iso(bestBeforeMs)),
    secondaryAction: secondaryActionFor(moment),
    ritual,
    evidence: buildEvidence(moment, signals, nowMs),
    confidence: moment.source === 'manual' || moment.source === 'demo' ? 'high' : 'medium',
  };
}

/**
 * The Today set: moments inside the surfacing horizon, soonest first.
 * Past moments stay listed for the rest of their calendar day (the comp's
 * "Completed" row) but never beyond it.
 */
export function surfaceableMoments(moments: readonly Moment[], nowIso: string): Moment[] {
  const nowMs = Date.parse(nowIso);
  const horizonMs = nowMs + MOMENT_SURFACE_HORIZON_HOURS * 60 * MIN_MS;
  const dayStart = new Date(nowIso);
  dayStart.setHours(0, 0, 0, 0);
  return [...moments]
    .filter((m) => {
      const t = Date.parse(m.startAtIso);
      return Number.isFinite(t) && t >= dayStart.getTime() && t <= horizonMs;
    })
    .sort((a, b) => Date.parse(a.startAtIso) - Date.parse(b.startAtIso));
}

/** The single NEXT moment for the Home card: first not-yet-started. */
export function nextMoment(moments: readonly Moment[], nowIso: string): Moment | null {
  const nowMs = Date.parse(nowIso);
  return (
    surfaceableMoments(moments, nowIso).find((m) => Date.parse(m.startAtIso) > nowMs) ?? null
  );
}
