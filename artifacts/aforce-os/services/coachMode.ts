/**
 * Coach Mode — user-toggled voice posture for the AForce coach.
 *
 * Spec Rule #12: "Reduce talking." Three modes:
 *   - silent   no speech, no haptic; only Orb + Microcopy
 *   - ambient  (default) no speech; Orb + Microcopy + Haptic
 *   - spoken   speech enabled (today's shipped behavior)
 *
 * This module is the single source of truth for *whether* the coach
 * talks. It does NOT control *how* the coach sounds (rate / pitch /
 * persona) — that stays in ttsConfigService. Today's voice paths are
 * not yet gated on this value; later rules will read `shouldSpeak`
 * and `shouldHaptic` to wire the modes through.
 *
 * Persisted to AsyncStorage so the choice survives reloads. A tiny
 * module-level store + `useSyncExternalStore` exposes the value to
 * React without pulling in another global store.
 *
 * The hidden hook `useCoachMode()` returns 'spoken' (today's
 * behavior) whenever the `spec_coachV2` feature flag is off, so the
 * mode system is invisible to voice paths until the flag flips. The
 * raw `useCoachModeSetting()` hook always returns the stored value
 * for the Profile picker.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFeatureFlags } from '@/store/useAppStore';

export type CoachMode = 'silent' | 'ambient' | 'spoken';

export const COACH_MODES: ReadonlyArray<CoachMode> = ['silent', 'ambient', 'spoken'];

export const DEFAULT_COACH_MODE: CoachMode = 'ambient';

/**
 * Short-form microcopy vocabulary the coach falls back to when voice
 * is OFF. Pairs with the Orb pulse and the haptic tick. Surfaced by
 * later rules; declared here as the canonical source.
 */
export const COACH_MICROCOPY = {
  recover: 'Recover now',
  water: 'Water first',
  rising: 'Signal rising',
  meeting: 'Meeting aware',
} as const;

export type CoachMicrocopyKey = keyof typeof COACH_MICROCOPY;

const STORAGE_KEY = '@aforce/coachMode';

let current: CoachMode = DEFAULT_COACH_MODE;
const listeners = new Set<() => void>();
let hydrated = false;

function notify(): void {
  for (const l of listeners) l();
}

function isCoachMode(v: unknown): v is CoachMode {
  return v === 'silent' || v === 'ambient' || v === 'spoken';
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (isCoachMode(raw) && raw !== current) {
      current = raw;
      notify();
    }
  } catch {
    /* ignore — defaults to DEFAULT_COACH_MODE */
  }
}

void hydrate();

export function getCoachMode(): CoachMode {
  return current;
}

export async function setCoachMode(next: CoachMode): Promise<void> {
  if (current === next) return;
  current = next;
  notify();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* non-fatal: state is still updated in memory */
  }
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Pure predicate — only Spoken mode emits speech. */
export function shouldSpeak(mode: CoachMode): boolean {
  return mode === 'spoken';
}

/** Pure predicate — Silent mode suppresses haptics; others tick. */
export function shouldHaptic(mode: CoachMode): boolean {
  return mode === 'ambient' || mode === 'spoken';
}

/**
 * Raw stored value, always reactive. Use this for the Profile
 * picker so the user's selection persists regardless of the
 * feature flag.
 */
export function useCoachModeSetting(): CoachMode {
  return useSyncExternalStore(subscribe, getCoachMode, getCoachMode);
}

/**
 * Effective coach mode for downstream voice / haptic gates. Returns
 * 'spoken' (today's behavior) until `spec_coachV2` is flipped on, at
 * which point the user's stored choice takes effect.
 */
export function useCoachMode(): CoachMode {
  const stored = useCoachModeSetting();
  const flags = useFeatureFlags();
  return flags.spec_coachV2 ? stored : 'spoken';
}
