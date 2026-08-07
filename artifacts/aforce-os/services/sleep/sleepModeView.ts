/**
 * SLEEP MODE (redesign) — pure view-model resolver.
 *
 * Turns the raw Sleep Mode inputs (system-derived phase, sleep target, health
 * signals, checklist progress, connection state) into a fully-resolved,
 * presentation-ready view model. RN-free and dependency-free so it stays
 * unit-testable and deterministic (`now` and all signals are injected).
 *
 * HONESTY DISCIPLINE (mirrors commandConfidence / healthProviderStatus):
 *   - Never fabricates a metric. The only sleep metric that can be REAL today is
 *     `sleepHoursLastNight`; everything else (HRV, resting HR, recovery %) is
 *     surfaced ONLY when a real value is supplied, otherwise the card shows an
 *     honest "waiting / connect" state. No placeholder numbers.
 *   - Phase stays the shipping 4-state, clock-derived model (idle / pre_sleep /
 *     recovery_window / morning). No fake sleep-start/end detection.
 *   - Compliance vocabulary preserved: supports / may help support / guidance.
 *     No diagnosis or medical claims.
 *
 * The screen container feeds this; the pure `SleepModeView` component renders it.
 */

export type SleepPhase = 'idle' | 'pre_sleep' | 'recovery_window' | 'morning';

/** Data-availability status for the whole screen (drives loading/offline shells). */
export type SleepScreenMode = 'ready' | 'loading' | 'offline';

/** Honest recovery-readiness posture — never a diagnosis. */
export type RecoveryPosture = 'ready' | 'limited' | 'waiting' | 'connect';

/** Health-source connection chip (color-independent; label always present). */
export type HealthChip = 'connected' | 'waiting' | 'needs_attention' | 'not_connected';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Lead times (min) matching the shipping SleepModeScreen derivation. */
export const PRE_SLEEP_LEAD_MIN = 90;
export const RECOVERY_WINDOW_LEAD_MIN = 60;
export const MORNING_START_HOUR = 5;
export const MORNING_END_HOUR = 11;

export const SLEEP_PHASES: readonly SleepPhase[] = [
  'idle', 'pre_sleep', 'recovery_window', 'morning',
] as const;

/** Pre-sleep protocol checklist — hydration is product-backed & primary; the
 *  rest are OPTIONAL, non-medical sleep-hygiene suggestions (never claims). */
export interface ChecklistItemDef {
  id: 'hydrate' | 'screens_down' | 'dim_lights' | 'breathe' | 'cool_room';
  icon: string; // Feather/Icon name
  label: string;
  target: string | null; // short optional target, e.g. "16–24 oz"
  primary: boolean; // hydration is the primary, product-backed action
}

export const CHECKLIST_DEFS: readonly ChecklistItemDef[] = [
  { id: 'hydrate', icon: 'droplet', label: 'Hydrate', target: '16–24 oz', primary: true },
  { id: 'screens_down', icon: 'smartphone', label: 'Screens Down', target: '30 min before bed', primary: false },
  { id: 'dim_lights', icon: 'moon', label: 'Dim Lights', target: 'reduce stimulation', primary: false },
  { id: 'breathe', icon: 'wind', label: 'Breathe', target: '2–4 min', primary: false },
  { id: 'cool_room', icon: 'thermometer', label: 'Cool Room', target: '65–68°F', primary: false },
] as const;

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface SleepMetricInput {
  key: 'sleep_last_night' | 'seven_night_avg' | 'hrv' | 'resting_hr' | 'respiratory_rate' | 'hydration';
  label: string;
  /** Present ONLY when a real value exists. null → shown as an honest "—". */
  value: number | null;
  unit: string;
  /** Whether this metric is a genuinely live/real signal (vs unavailable). */
  real: boolean;
}

export interface SleepModeInput {
  now: number; // epoch ms — injected for testability
  mode: SleepScreenMode; // ready | loading | offline
  phase: SleepPhase;
  /** Target bedtime as {h,m} 24h, or null if unset. */
  target: { h: number; m: number } | null;
  minutesUntilTarget: number | null; // null when target unset
  /** Real last-night sleep hours, or null (unavailable / not detected). */
  sleepLastNight: number | null;
  sevenNightAvg: number | null;
  /** Extra recovery metrics — pass only real ones; unavailable ones omitted. */
  recoveryMetrics: readonly SleepMetricInput[];
  confidence: ConfidenceLevel;
  health: {
    provider: string; // e.g. "Apple Health"
    chip: HealthChip;
    freshness: string | null; // e.g. "Synced 6h ago" — null when never
  };
  /** Completed checklist item ids (subset of CHECKLIST_DEFS ids). */
  completed: readonly ChecklistItemDef['id'][];
  /**
   * Public kill switch (`flags.sleep_mode_enabled`). Optional so existing
   * callers/fixtures are unchanged; omitted ⇒ treated as enabled. When false
   * the view model carries `gatedNotice` so the screen NEVER silently renders
   * the normal experience with the kill switch off (legacy-banner parity).
   */
  sleepModeEnabled?: boolean;
}

// ─── Resolved view model ─────────────────────────────────────────────────────

export interface SleepRingView {
  kind: 'countdown' | 'readiness' | 'none';
  valueLabel: string; // big numeral/label inside the ring
  caption: string; // small label under it
  /** 0..1 progress for the ring sweep (deterministic; presentation only). */
  progress: number;
}

export interface SleepHeroView {
  eyebrow: string; // "CURRENT STATE"
  state: string; // "IDLE" | "PRE-SLEEP" | "RECOVERY WINDOW" | "MORNING"
  description: string;
  ring: SleepRingView;
}

export interface SleepTargetView {
  timeLabel: string; // "11:00 PM" or "—:—"
  countdownCopy: string;
  timeline: { nowLabel: string; preSleepLabel: string; targetLabel: string; nowFraction: number };
  canEdit: boolean;
}

export interface SleepRecoveryView {
  posture: RecoveryPosture;
  interpretation: string;
  metrics: readonly { label: string; value: string; real: boolean }[];
  confidence: ConfidenceLevel;
  confidenceLabel: string;
}

export interface SleepHealthView {
  provider: string;
  chip: HealthChip;
  chipLabel: string;
  freshness: string;
  cta: 'connect' | 'view_source' | 'manage';
  ctaLabel: string;
}

export interface SleepChecklistItemView {
  id: ChecklistItemDef['id'];
  icon: string;
  label: string;
  target: string | null;
  primary: boolean;
  done: boolean;
}

export interface SleepChecklistView {
  items: readonly SleepChecklistItemView[];
  completedCount: number;
  totalCount: number;
  progressLabel: string; // "0 / 5 complete"
  primaryCta: 'start' | 'continue' | 'complete';
  primaryCtaLabel: string; // "START PRE-SLEEP PROTOCOL" | ...
}

export interface SleepLifecycleView {
  states: readonly { key: SleepPhase; label: string; active: boolean; done: boolean }[];
  activeIndex: number;
  systemDerived: true; // states are system-derived — render as a lifecycle, not tabs
}

export interface SleepGuidanceView {
  title: string;
  body: string;
  secondary: string;
}

export interface SleepModeView {
  mode: SleepScreenMode;
  /**
   * Non-null when the public kill switch (`sleep_mode_enabled`) is OFF: the
   * exact legacy internal-preview copy, rendered as a loud banner so the
   * gated state is explicit — never silent.
   */
  gatedNotice: string | null;
  header: { title: string; tagline: string };
  hero: SleepHeroView;
  target: SleepTargetView;
  recovery: SleepRecoveryView;
  health: SleepHealthView;
  checklist: SleepChecklistView;
  lifecycle: SleepLifecycleView;
  guidance: SleepGuidanceView;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<SleepPhase, string> = {
  idle: 'IDLE',
  pre_sleep: 'PRE-SLEEP',
  recovery_window: 'RECOVERY WINDOW',
  morning: 'MORNING',
};

const CHIP_LABEL: Record<HealthChip, string> = {
  connected: 'Connected',
  waiting: 'Waiting for signals',
  needs_attention: 'Needs attention',
  not_connected: 'Not connected',
};

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: 'HIGH CONFIDENCE',
  medium: 'MEDIUM CONFIDENCE',
  low: 'BUILDING', // low is framed as "building", never a failure
};

/** Exact legacy internal-preview copy (SleepModeScreenLegacy banner parity). */
export const SLEEP_GATED_NOTICE =
  'INTERNAL PREVIEW — sleep_mode_enabled is off for the public build.';

function fmt12(t: { h: number; m: number }): string {
  const ap = t.h >= 12 ? 'PM' : 'AM';
  const h12 = t.h % 12 === 0 ? 12 : t.h % 12;
  return `${h12}:${String(t.m).padStart(2, '0')} ${ap}`;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// ─── H2 — once-per-calendar-day EMA fold guard (pure, unit-tested) ───────────
// The container folds `sleepLastNight` into the persisted 7-night EMA. Without
// a guard, every mount re-folds the SAME night, biasing the average the honest
// morning comparison is built on. These helpers make the guard deterministic.

/** Local calendar day (YYYY-MM-DD) for an epoch-ms instant. */
export function localDayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when the EMA should fold today: there is a real sleep value AND the
 * stored guard is missing, malformed, or from a different (stale) day. A
 * malformed guard is treated as absent — never as "already folded" — so a
 * corrupt value can only cause one extra fold, not a silent permanent skip.
 */
export function shouldFoldSleepAvg(
  lastFoldedDay: string | null | undefined,
  today: string,
  sleepLastNight: number | null,
): boolean {
  if (sleepLastNight == null || !Number.isFinite(sleepLastNight)) return false;
  if (typeof lastFoldedDay !== 'string' || !DAY_KEY_RE.test(lastFoldedDay)) return true;
  return lastFoldedDay !== today;
}

/** One EMA step (alpha = 1/7) — the exact math the container has always used. */
export function foldSevenNightAvg(prev: number | null, lastNight: number): number {
  return prev == null || !Number.isFinite(prev) ? lastNight : prev + (lastNight - prev) / 7;
}

// ─── H3 — primary CTA semantics (pure, unit-tested) ──────────────────────────

/**
 * What pressing the primary CTA should DO (observable, honest — no score
 * mutation, no fabricated data): complete the primary product-backed item
 * (hydrate) when it isn't done yet; otherwise move the user to the checklist.
 */
export type PrimaryCtaAction = 'complete_hydrate' | 'focus_checklist';

export function primaryCtaAction(
  completed: readonly ChecklistItemDef['id'][],
): PrimaryCtaAction {
  return completed.includes('hydrate') ? 'focus_checklist' : 'complete_hydrate';
}

function morningSentence(lastNight: number | null, avg: number | null): string {
  if (lastNight == null || !Number.isFinite(lastNight)) {
    return 'Sleep data not detected last night. Hydration guidance continues as usual.';
  }
  if (avg == null || !Number.isFinite(avg)) return 'Recovery trend appeared steady overnight.';
  const delta = lastNight - avg;
  if (delta >= 0.3) return 'Recovery trend appeared stronger than your recent average.';
  if (delta <= -0.3) return 'Recovery trend appeared lighter than your recent average.';
  return 'Recovery trend appeared in line with your recent average.';
}

// ─── Resolver ────────────────────────────────────────────────────────────────

export function resolveSleepModeView(input: SleepModeInput): SleepModeView {
  const {
    mode, phase, target, minutesUntilTarget, sleepLastNight, sevenNightAvg,
    recoveryMetrics, confidence, health, completed,
  } = input;

  const minsUntil = minutesUntilTarget ?? null;
  const minsToWindow = minsUntil == null ? null : Math.max(0, minsUntil - RECOVERY_WINDOW_LEAD_MIN);
  const minsToTrigger = minsUntil == null ? null : Math.max(0, minsUntil - PRE_SLEEP_LEAD_MIN);

  // ── Hero ──
  const hero = resolveHero(phase, minsUntil, minsToWindow, sleepLastNight, sevenNightAvg);

  // ── Sleep target ──
  const targetView: SleepTargetView = {
    timeLabel: target ? fmt12(target) : '—:—',
    countdownCopy:
      target == null
        ? 'Set a sleep target to begin your pre-sleep protocol.'
        : phase === 'idle' && minsToTrigger != null
          ? `Pre-sleep protocol begins in ${minsToTrigger} minutes`
          : phase === 'pre_sleep' && minsToWindow != null
            ? `Recovery window opens in ${minsToWindow} minutes`
            : phase === 'recovery_window'
              ? 'Recovery window is open now'
              : 'Protocol complete for tonight',
    timeline: {
      nowLabel: 'Now',
      preSleepLabel: 'Pre-sleep',
      targetLabel: target ? fmt12(target) : 'Target',
      // Fraction of the 90-min pre-sleep runway already elapsed (0 far out → 1 at target).
      nowFraction:
        minsUntil == null ? 0 : clamp01(1 - Math.min(minsUntil, PRE_SLEEP_LEAD_MIN) / PRE_SLEEP_LEAD_MIN),
    },
    canEdit: mode === 'ready',
  };

  // ── Recovery readiness (honest — real metrics only) ──
  const recovery = resolveRecovery(sleepLastNight, recoveryMetrics, confidence, health.chip);

  // ── Health source ──
  const healthView: SleepHealthView = {
    provider: health.provider,
    chip: health.chip,
    chipLabel: CHIP_LABEL[health.chip],
    freshness: health.freshness ?? (health.chip === 'not_connected' ? 'No source connected' : 'No recent signal'),
    cta: health.chip === 'connected' ? 'view_source' : health.chip === 'needs_attention' ? 'manage' : 'connect',
    ctaLabel:
      health.chip === 'connected' ? 'View Source' : health.chip === 'needs_attention' ? 'Manage Connection' : 'Connect',
  };

  // ── Checklist ──
  const checklist = resolveChecklist(phase, completed);

  // ── Lifecycle indicator (system-derived states) ──
  const activeIndex = SLEEP_PHASES.indexOf(phase);
  const lifecycle: SleepLifecycleView = {
    states: SLEEP_PHASES.map((k, i) => ({
      key: k,
      label: PHASE_LABEL[k],
      active: k === phase,
      done: i < activeIndex,
    })),
    activeIndex,
    systemDerived: true,
  };

  // ── Guidance (concise; replaces oversized disclaimer) ──
  const guidance: SleepGuidanceView = {
    title: 'ABOUT SLEEP MODE',
    body: 'Sleep Mode provides hydration and recovery guidance. It supports — and does not replace — your normal sleep, medical, or wellness routine.',
    secondary: 'AForce OS does not diagnose or treat medical conditions.',
  };

  return {
    mode,
    // Kill switch: omitted ⇒ enabled. False ⇒ loud internal-preview banner.
    gatedNotice: input.sleepModeEnabled === false ? SLEEP_GATED_NOTICE : null,
    header: { title: 'SLEEP MODE', tagline: 'Recover. Rehydrate. Reset.' },
    hero,
    target: targetView,
    recovery,
    health: healthView,
    checklist,
    lifecycle,
    guidance,
  };
}

function resolveHero(
  phase: SleepPhase,
  minsUntil: number | null,
  minsToWindow: number | null,
  sleepLastNight: number | null,
  sevenNightAvg: number | null,
): SleepHeroView {
  const eyebrow = 'CURRENT STATE';
  const state = PHASE_LABEL[phase];
  if (phase === 'idle') {
    return {
      eyebrow, state,
      description:
        minsUntil == null
          ? 'Set your sleep target to begin tonight’s pre-sleep protocol.'
          : 'You’re ahead of your protocol. Stay hydrated and wind down when the window opens.',
      ring: {
        kind: minsUntil == null ? 'none' : 'countdown',
        valueLabel: minsUntil == null ? '—' : `${Math.max(0, (minsUntil ?? 0) - PRE_SLEEP_LEAD_MIN)}`,
        caption: 'MIN TO PROTOCOL',
        progress: minsUntil == null ? 0 : clamp01(1 - Math.min(minsUntil, 360) / 360),
      },
    };
  }
  if (phase === 'pre_sleep') {
    return {
      eyebrow, state,
      description: 'Pre-sleep protocol is active. Hydrate now and begin winding down.',
      ring: {
        kind: 'countdown',
        valueLabel: `${minsToWindow ?? 0}`,
        caption: 'MIN TO WINDOW',
        progress: clamp01(1 - Math.min(minsToWindow ?? 0, 30) / 30),
      },
    };
  }
  if (phase === 'recovery_window') {
    return {
      eyebrow, state,
      description: 'Recovery window is open. Hydration may help support overnight recovery. Lights down, devices away.',
      ring: { kind: 'readiness', valueLabel: 'OPEN', caption: 'RECOVERY WINDOW', progress: 1 },
    };
  }
  // morning
  return {
    eyebrow, state,
    description: morningSentence(sleepLastNight, sevenNightAvg),
    ring: {
      kind: sleepLastNight != null ? 'readiness' : 'none',
      // RC-2 ruling E (item 3): unit-spacing sweep — was "7.9h" (no space),
      // inconsistent with the Apple card's i18n "{{value}} h" convention.
      valueLabel: sleepLastNight != null ? `${sleepLastNight.toFixed(1)} h` : '—',
      caption: sleepLastNight != null ? 'LAST NIGHT' : 'NO SLEEP SIGNAL',
      progress: sleepLastNight != null ? clamp01(sleepLastNight / 9) : 0,
    },
  };
}

function resolveRecovery(
  sleepLastNight: number | null,
  metrics: readonly SleepMetricInput[],
  confidence: ConfidenceLevel,
  chip: HealthChip,
): SleepRecoveryView {
  const realMetrics = metrics.filter((m) => m.real && m.value != null);
  let posture: RecoveryPosture;
  let interpretation: string;

  if (chip === 'not_connected') {
    posture = 'connect';
    interpretation = 'Connect a health source to surface recovery signals. Hydration remains the strongest available signal.';
  } else if (realMetrics.length === 0 && sleepLastNight == null) {
    posture = 'waiting';
    interpretation = 'Waiting for recovery signals. Hydration remains the strongest available signal tonight.';
  } else if (confidence === 'low') {
    posture = 'limited';
    interpretation = 'Recovery signals are limited tonight. Hydration remains the strongest available signal.';
  } else {
    posture = 'ready';
    interpretation = 'Your body is ready to recover. Keep hydration steady through the window.';
  }

  // Only surface metrics with real values — never a fabricated number.
  const shown: { label: string; value: string; real: boolean }[] = [];
  if (sleepLastNight != null) {
    // RC-2 ruling E (item 3): same unit-spacing normalization as the ring
    // `valueLabel` above.
    shown.push({ label: 'Sleep (last night)', value: `${sleepLastNight.toFixed(1)} h`, real: true });
  }
  for (const m of realMetrics) {
    shown.push({ label: m.label, value: `${m.value}${m.unit}`, real: true });
  }

  return {
    posture,
    interpretation,
    metrics: shown,
    confidence,
    confidenceLabel: CONFIDENCE_LABEL[confidence],
  };
}

function resolveChecklist(
  phase: SleepPhase,
  completed: readonly ChecklistItemDef['id'][],
): SleepChecklistView {
  const done = new Set(completed);
  const items: SleepChecklistItemView[] = CHECKLIST_DEFS.map((d) => ({
    id: d.id, icon: d.icon, label: d.label, target: d.target, primary: d.primary, done: done.has(d.id),
  }));
  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;

  let primaryCta: SleepChecklistView['primaryCta'];
  let primaryCtaLabel: string;
  if (completedCount === 0) {
    primaryCta = 'start';
    primaryCtaLabel = 'START PRE-SLEEP PROTOCOL';
  } else if (completedCount < totalCount) {
    primaryCta = 'continue';
    primaryCtaLabel = 'CONTINUE PROTOCOL';
  } else {
    primaryCta = 'complete';
    primaryCtaLabel = 'COMPLETE PROTOCOL';
  }
  // In recovery_window / morning the wind-down is past its active point; label
  // stays coherent but the container may disable it — presentation only here.

  return {
    items,
    completedCount,
    totalCount,
    progressLabel: `${completedCount} / ${totalCount} complete`,
    primaryCta,
    primaryCtaLabel,
  };
}
