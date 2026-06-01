/**
 * Smart Modes — Priority #7 (Context Engine).
 *
 * A PURE, deterministic context engine. Given a snapshot of the user's
 * situation (heat, workout, travel, recovery/deficit) it returns which
 * of the FOUR sanctioned modes are active, the water-first guidance for
 * each, and the multipliers the existing engines apply:
 *
 *   - reminderIntensityMultiplier → fed to the adaptive reminder policy
 *     (heat / workout sharpen cadence; recovery softens it).
 *   - hydrationTargetMultiplier → advisory target bump surfaced as
 *     guidance (the live scoring engine stays the source of truth).
 *
 * Hard scope lock: ONLY Heat, Workout, Travel, Recovery. No nutrition,
 * no social, no new navigation. No RN, no storage, no Date.now — every
 * input is passed in, so it is fully unit-testable. "Build once. Expose
 * over time": the brain is complete here; surfaces expose a slice of it.
 */

export type SmartModeId = 'heat' | 'workout' | 'travel' | 'recovery';

export interface SmartModeContext {
  /** Apparent temperature (heat index) in °C, or null when unknown. */
  heatIndexC: number | null;
  /** Active workout / exercise minutes today. */
  workoutMinutesToday: number;
  /** Live hydration score 0..100, or null when unknown. */
  hydrationScore: number | null;
  /** Hydration goal progress: consumed / target. >= 1 means met. */
  goalProgress: number;
  /** Explicit travel-day / time-zone-shift signal (dormant until wired). */
  isTravelDay?: boolean;
}

export interface SmartMode {
  id: SmartModeId;
  /** Display label, e.g. "HEAT MODE". */
  label: string;
  /** ICON_MAP key (must exist in theme/icons.ts). */
  icon: string;
  /** One-line behavioral guidance — always water-first. */
  guidance: string;
}

export interface SmartModeResult {
  /** Active modes, fixed priority order, length 0..4. */
  active: SmartMode[];
  /** Multiply reminder aggressiveness (heat/workout ↑, recovery ↓). */
  reminderIntensityMultiplier: number;
  /** Advisory hydration-target multiplier (>= 1). */
  hydrationTargetMultiplier: number;
}

// ── Trigger thresholds ────────────────────────────────────────────────
/** Heat index at/above this (°C) is "hot" — mirrors the reminder policy. */
export const MODE_HEAT_INDEX_C = 30;
/** Workout minutes at/above this count as an active session. */
export const MODE_WORKOUT_MIN_MINUTES = 20;
/** Hydration score below this signals poor recovery / elevated deficit. */
export const MODE_RECOVERY_SCORE = 50;

// ── Per-mode tuning ───────────────────────────────────────────────────
interface ModeSpec {
  label: string;
  icon: string;
  guidance: string;
  reminderFactor: number;
  targetFactor: number;
}

/** Fixed priority order — also the display order. */
const MODE_ORDER: SmartModeId[] = ['heat', 'workout', 'travel', 'recovery'];

const MODE_SPECS: Record<SmartModeId, ModeSpec> = {
  heat: {
    label: 'HEAT MODE',
    icon: 'thermometer',
    guidance: 'HYDRATE NOW — heat detected. Aim for extra water today.',
    reminderFactor: 1.2,
    targetFactor: 1.2,
  },
  workout: {
    label: 'WORKOUT MODE',
    icon: 'activity',
    guidance: 'HYDRATE NOW — workout underway. Recover with water after.',
    reminderFactor: 1.2,
    targetFactor: 1.15,
  },
  travel: {
    label: 'TRAVEL MODE',
    icon: 'navigation',
    guidance: 'Start with water — travel day. Sip steadily to stay ahead.',
    reminderFactor: 1.0,
    targetFactor: 1.1,
  },
  recovery: {
    label: 'RECOVERY MODE',
    icon: 'heart',
    guidance: 'Start with water — recovery focus. Ease in, no pressure.',
    reminderFactor: 0.6,
    targetFactor: 1.0,
  },
};

// ── Aggregate bounds (keep extremes sane; policy guardrails do the rest) ─
const REMINDER_MULT_MIN = 0.5;
const REMINDER_MULT_MAX = 1.5;
const TARGET_MULT_MAX = 1.3;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function isActive(id: SmartModeId, ctx: SmartModeContext): boolean {
  switch (id) {
    case 'heat':
      return ctx.heatIndexC != null && ctx.heatIndexC >= MODE_HEAT_INDEX_C;
    case 'workout':
      return ctx.workoutMinutesToday >= MODE_WORKOUT_MIN_MINUTES;
    case 'travel':
      return ctx.isTravelDay === true;
    case 'recovery':
      return ctx.hydrationScore != null && ctx.hydrationScore < MODE_RECOVERY_SCORE;
  }
}

/**
 * Derive the active Smart Modes and the engine multipliers for a context.
 * Deterministic: same input → same output.
 */
export function deriveActiveModes(ctx: SmartModeContext): SmartModeResult {
  const activeIds = MODE_ORDER.filter((id) => isActive(id, ctx));

  const active: SmartMode[] = activeIds.map((id) => {
    const spec = MODE_SPECS[id];
    return { id, label: spec.label, icon: spec.icon, guidance: spec.guidance };
  });

  let reminderMult = 1;
  let targetMult = 1;
  for (const id of activeIds) {
    const spec = MODE_SPECS[id];
    reminderMult *= spec.reminderFactor;
    targetMult = Math.max(targetMult, spec.targetFactor);
  }

  return {
    active,
    reminderIntensityMultiplier: clamp(
      reminderMult,
      REMINDER_MULT_MIN,
      REMINDER_MULT_MAX,
    ),
    hydrationTargetMultiplier: clamp(targetMult, 1, TARGET_MULT_MAX),
  };
}
