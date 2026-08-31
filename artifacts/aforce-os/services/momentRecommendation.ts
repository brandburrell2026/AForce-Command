/**
 * momentRecommendation — the AForce Moments preparation engine (Phases 1–2,
 * founder approval 2026-08-12). PURE: `(moments, signals, now) →
 * MomentRecommendation[]`. No store reads, no I/O, no clocks — callers pass
 * everything. Logic lives here, never in UI components (founder spec).
 *
 * CONTRACT
 *  - Advisory only (Score Protection, DR-001): output is a read-only
 *    projection; nothing mutates score, and no numeric moment score exists.
 *  - ONE HYDRATION ACTION (ruling RP-3, Wave 3 2026-08-31): Moments owns
 *    context — windows, timing, relevance, lifecycle. RecoveryCommand owns
 *    the hydration action. The primary action is a VERBATIM MIRROR of the
 *    canonical guarded command passed in via signals.canonicalCommand;
 *    with no eligible command a Moment renders NO hydration action at all.
 *    The old per-type ounce table — a parallel authority computed blind
 *    to the command (the E7 12-vs-14 oz contradiction) — is deleted.
 *  - Window tunables come from config/hydroStateModel.ts (Build Rule 13):
 *    MOMENT_PREP_WINDOW_MIN, MOMENT_LOCK_IN_BEFORE_MIN,
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
  /**
   * RP-3 (Wave 3, 2026-08-31): the ONE hydration action — the canonical
   * GUARDED RecoveryCommand, passed by callers who hold the guarded engine
   * slice. Moments mirror it verbatim; they never derive, adjust, or invent
   * an amount, unit, timing, urgency, or product. Absent ⇒ the Moment
   * renders no hydration action at all (silence is valid).
   */
  canonicalCommand?: { id: string; action: string };
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

/**
 * The mirror (ruling RP-3): the hydration action IS the canonical guarded
 * command, byte-verbatim, for every MomentType alike. No command ⇒ no
 * action: a Moment never manufactures hydration.
 *
 * NO bestBeforeIso here (Wave-3 adversarial review, 2026-08-31): the prep
 * window's midpoint is Moment-owned CONTEXT, but attaching it to the action
 * itself rendered as "Best before {{time}}" directly under the command
 * text — a Moment-authored deadline laid over whatever the command says.
 * Executed against a real Social Mode safety command, this produced
 * "Please don't drive. Use a rideshare or call a friend." / "Best before
 * 5:15 PM" — a do-not-drive instruction given an expiry the command
 * authority never gave it. RP-3 declares timing unchangeable; the
 * prep-window row (rendered separately, on every surface, always) already
 * carries the Moment's own timing.
 */
function primaryActionFor(signals: MomentSignals): MomentAction | undefined {
  const cmd = signals.canonicalCommand;
  if (!cmd || !cmd.action) return undefined;
  return {
    kind: 'hydrate',
    labelKey: 'moments.action.canonical_command',
    labelParams: { action: cmd.action, commandId: cmd.id },
  };
}

function secondaryActionFor(moment: Moment): MomentAction | undefined {
  switch (moment.type) {
    // RP-3: the old training 'electrolytes' secondary was a Moment-minted
    // product-class hydration recommendation — removed. When electrolytes
    // are right, the canonical command already says so and the mirror
    // carries it.
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
    // The HYDRATE stage exists only as the canonical command's mirror —
    // with no eligible command there is nothing a Moment may instruct
    // (RP-3: silence is valid), so the stage is omitted below.
    ...(signals.canonicalCommand?.action
      ? [
          {
            key: 'hydrate' as const,
            atIso: iso(prepStartMs),
            state: prepared ? 'completed' : stageState(prepStartMs, bestBeforeMs, nowMs),
            instructionKey: 'moments.ritual.canonical_command',
            instructionParams: { action: signals.canonicalCommand.action },
          },
        ]
      : []),
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
    primaryAction: primaryActionFor(signals),
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
