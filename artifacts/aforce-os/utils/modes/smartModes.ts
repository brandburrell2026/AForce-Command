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
  /** English fallback label, e.g. "HEAT MODE". */
  label: string;
  /** i18n key for the localized label (resolved at render time). */
  labelKey: string;
  /** i18n key for the localized short label used in chips. */
  shortKey: string;
  /** ICON_MAP key (must exist in theme/icons.ts). */
  icon: string;
  /** English fallback guidance — always water-first. */
  guidance: string;
  /**
   * i18n key for the localized one-line guidance. Resolving the copy at
   * render time (instead of baking English into this pure module) keeps
   * the launch-locale lock intact. Travel reuses the shared Location
   * Intelligence travel-advisory key.
   */
  guidanceKey: string;
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
  labelKey: string;
  shortKey: string;
  icon: string;
  guidance: string;
  guidanceKey: string;
  reminderFactor: number;
  targetFactor: number;
}

/** Fixed priority order — also the display order. */
const MODE_ORDER: SmartModeId[] = ['heat', 'workout', 'travel', 'recovery'];

const MODE_SPECS: Record<SmartModeId, ModeSpec> = {
  heat: {
    label: 'HEAT MODE',
    labelKey: 'smartModes.heat.label',
    shortKey: 'smartModes.heat.short',
    icon: 'thermometer',
    guidance: 'HYDRATE NOW — heat detected. Aim for extra water today.',
    guidanceKey: 'smartModes.heat.guidance',
    reminderFactor: 1.2,
    targetFactor: 1.2,
  },
  workout: {
    label: 'WORKOUT MODE',
    labelKey: 'smartModes.workout.label',
    shortKey: 'smartModes.workout.short',
    icon: 'activity',
    guidance: 'HYDRATE NOW — workout underway. Recover with water after.',
    guidanceKey: 'smartModes.workout.guidance',
    reminderFactor: 1.2,
    targetFactor: 1.15,
  },
  travel: {
    label: 'TRAVEL MODE',
    labelKey: 'smartModes.travel.label',
    shortKey: 'smartModes.travel.short',
    icon: 'navigation',
    guidance: 'Start with water — travel day. Sip steadily to stay ahead.',
    // Travel reuses the shared, already-translated Location Intelligence
    // travel advisory so the copy stays in one place across locales.
    guidanceKey: 'locationIntel.protocol.travel_protocol',
    reminderFactor: 1.0,
    targetFactor: 1.1,
  },
  recovery: {
    label: 'RECOVERY MODE',
    labelKey: 'smartModes.recovery.label',
    shortKey: 'smartModes.recovery.short',
    icon: 'heart',
    // Mode INDICATOR, not a command restatement (ruling #8): the RECOVERY COACH
    // card is the single source of the active command on Home, so the banner
    // states the mode + tone and never re-prints "start with water".
    guidance: 'Recovery focus is on. Ease in — no pressure.',
    guidanceKey: 'smartModes.recovery.guidance',
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
    return {
      id,
      label: spec.label,
      labelKey: spec.labelKey,
      shortKey: spec.shortKey,
      icon: spec.icon,
      guidance: spec.guidance,
      guidanceKey: spec.guidanceKey,
    };
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

/**
 * Which active modes should render a FULL guidance line (vs. a label-only
 * chip) in the Smart Modes banner.
 *
 * The banner gives the top-priority mode its guidance line. Travel, however,
 * must ALWAYS surface its Travel Protocol advisory whenever it is active —
 * even when a higher-priority mode (heat / workout) is primary — because
 * Smart Modes owns the single travel surface (the ambient Location
 * Intelligence banner stays travel-free, so demoting travel to a chip would
 * drop the advisory entirely). Returns the primary mode, plus travel when
 * travel is active but not already the primary (never duplicated). Pure, so
 * it is unit-testable without the RN render layer.
 */
export function selectModeGuidanceLines(active: SmartMode[]): SmartMode[] {
  if (active.length === 0) return [];
  const [primary, ...rest] = active;
  const lines: SmartMode[] = [primary];
  const travel = rest.find((mode) => mode.id === 'travel');
  if (travel) lines.push(travel);
  return lines;
}
