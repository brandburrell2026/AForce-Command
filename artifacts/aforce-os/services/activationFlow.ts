/**
 * Activation Flow — 6-stage post-purchase funnel state machine.
 *
 * Spec Rule #9:
 *   Build:    Buy → Activate → Install → First Command → Return → Subscribe
 *   Headline: YOUR RECOVERY SYSTEM IS READY
 *   Button:   ACTIVATE NOW
 *   Activation: Recovery Activated
 *   Do not open dashboard.
 *   Open:     First Command → "Drink 12 oz water."
 *   Completion: Water Cycle Complete → Signal Unlocked
 *   Unlock:   Timeline / Journal / Protocol / HydroScan
 *
 * Hidden architecture only this turn — no UI, no routing changes.
 * The state machine, copy table, and unlock predicates land here so
 * the future "Activate screen + First Command sequence + tab locks"
 * rule pass has a single source of truth to wire against. Existing
 * welcome.tsx and root routing are intentionally untouched.
 *
 * Persistence: AsyncStorage key `@aforce/activation`. Default state
 * on first read = stage 'buy', firstCommandCompletedAt null. The
 * `useHiddenActivationFlow` hook is gated on `spec_activation` (true
 * by Rule #17) — but `isSurfaceUnlocked` returns true for every
 * surface until a future rule wires the locks, so the existing app
 * stays fully reachable.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { useFeatureFlags } from '@/store/useAppStore';

/** Six-stage funnel in spec order. */
export const ACTIVATION_STAGES = [
  'buy',
  'activate',
  'install',
  'first_command',
  'return',
  'subscribe',
] as const;
export type ActivationStage = (typeof ACTIVATION_STAGES)[number];

/** Surfaces gated behind Signal Unlocked. */
export const UNLOCKED_SURFACES = ['timeline', 'journal', 'protocol', 'hydroscan'] as const;
export type UnlockedSurface = (typeof UNLOCKED_SURFACES)[number];

/** Every spec string verbatim. Brand words unchanged per Rule #16. */
export const ACTIVATION_COPY = {
  headline: 'YOUR RECOVERY SYSTEM IS READY',
  activateButton: 'ACTIVATE NOW',
  activated: 'Recovery Activated',
  firstCommand: 'Drink 12 oz water.',
  completion: 'Water Cycle Complete',
  unlocked: 'Signal Unlocked',
} as const;

export interface ActivationState {
  stage: ActivationStage;
  /** ISO timestamp when First Command was completed; null until then. */
  firstCommandCompletedAt: string | null;
}

const STORAGE_KEY = '@aforce/activation';

const DEFAULT_STATE: ActivationState = {
  stage: 'buy',
  firstCommandCompletedAt: null,
};

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the next stage in the funnel, or null when already at the
 * final stage. Pure, no I/O.
 */
export function nextStage(current: ActivationStage): ActivationStage | null {
  const i = ACTIVATION_STAGES.indexOf(current);
  if (i < 0 || i >= ACTIVATION_STAGES.length - 1) return null;
  return ACTIVATION_STAGES[i + 1] ?? null;
}

/** True when `state.stage` is at-or-past `target` in the spec order. */
export function isStageReached(state: ActivationState, target: ActivationStage): boolean {
  const current = ACTIVATION_STAGES.indexOf(state.stage);
  const want = ACTIVATION_STAGES.indexOf(target);
  if (current < 0 || want < 0) return false;
  return current >= want;
}

/**
 * Signal is unlocked when the user has completed First Command —
 * i.e. `firstCommandCompletedAt` is set OR the funnel has advanced
 * past `first_command`.
 */
export function isSignalUnlocked(state: ActivationState): boolean {
  if (state.firstCommandCompletedAt) return true;
  const current = ACTIVATION_STAGES.indexOf(state.stage);
  const firstCommandIdx = ACTIVATION_STAGES.indexOf('first_command');
  return current > firstCommandIdx;
}

/**
 * Whether a Signal-gated surface (Timeline / Journal / Protocol /
 * HydroScan) is reachable. Today: gated only on Signal Unlocked. A
 * future rule may differentiate per surface.
 */
export function isSurfaceUnlocked(
  state: ActivationState,
  _surface: UnlockedSurface,
): boolean {
  return isSignalUnlocked(state);
}

// ── Persistence ──────────────────────────────────────────────────────────────

function isActivationStage(v: unknown): v is ActivationStage {
  return typeof v === 'string' && (ACTIVATION_STAGES as readonly string[]).includes(v);
}

function isActivationState(v: unknown): v is ActivationState {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    isActivationStage(s.stage) &&
    (s.firstCommandCompletedAt === null || typeof s.firstCommandCompletedAt === 'string')
  );
}

export async function getActivationState(): Promise<ActivationState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as unknown;
    return isActivationState(parsed) ? parsed : { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(state: ActivationState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* non-fatal */
  }
}

export async function setActivationStage(stage: ActivationStage): Promise<ActivationState> {
  const current = await getActivationState();
  const next: ActivationState = { ...current, stage };
  await writeState(next);
  return next;
}

/** Marks First Command complete and advances stage past `first_command`. */
export async function markFirstCommandComplete(nowIso: string): Promise<ActivationState> {
  const current = await getActivationState();
  const stage: ActivationStage = isStageReached(current, 'return') ? current.stage : 'return';
  const next: ActivationState = { stage, firstCommandCompletedAt: nowIso };
  await writeState(next);
  return next;
}

/** Create-if-missing helper for the gate layer to bootstrap state. */
export async function ensureActivationState(): Promise<ActivationState> {
  const existing = await getActivationState();
  await writeState(existing); // idempotent persist of resolved default
  return existing;
}

// ── Hidden hook ──────────────────────────────────────────────────────────────

/**
 * Returns the current activation state when `spec_activation` is on
 * (default true per Rule #17). Returns null when the flag is off, so
 * a future kill-switch can disable the whole flow without touching
 * the consumer code.
 */
export function useHiddenActivationFlow(): ActivationState | null {
  const flags = useFeatureFlags();
  const [state, setState] = useState<ActivationState | null>(null);

  useEffect(() => {
    if (!flags.spec_activation) {
      setState(null);
      return;
    }
    let cancelled = false;
    void getActivationState().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [flags.spec_activation]);

  return state;
}
