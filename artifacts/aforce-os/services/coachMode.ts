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
 * persona) — that stays in ttsConfigService.
 *
 * Gating (RC-1 Wave 4, audit item 7): `services/textToSpeech.speak()` is
 * the ONE place that actually enforces `shouldSpeak()` — every speak()
 * call site is gated there rather than re-checking at each caller.
 * `components/CoachModeVoiceSync.tsx` mirrors the effective mode (below)
 * into `textToSpeech`'s module-level singleton via `setEffectiveCoachMode()`,
 * mounted once in `app/_layout.tsx`. Do not add a second, redundant
 * `shouldSpeak()` check at a new call site — wire new voice paths through
 * `textToSpeech.speak()` and the gate applies automatically.
 *
 * Persisted PER MEMBER (storage isolation PR C: ACCOUNT-SCOPED). Whether
 * the coach speaks aloud is a personal choice — on a shared device one
 * member's silent mode must not silence another's coach, and the inverse
 * is worse: a member who chose silence should never be spoken to because
 * someone else chose otherwise.
 *
 * A tiny module-level store + `useSyncExternalStore` exposes the value to
 * React without pulling in another global store. Because that store caches
 * in RAM, it also resets on a scope change — account-scoped disk without
 * account-scoped RAM is not isolation.
 *
 * The hidden hook `useCoachMode()` returns 'spoken' (today's
 * behavior) whenever the `spec_coachV2` feature flag is off, so the
 * mode system is invisible to voice paths until the flag flips. The
 * raw `useCoachModeSetting()` hook always returns the stored value
 * for the Profile picker.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { scopedStorage } from './scopedStorage';
import { subscribeUserScope } from './userScope';
import { captureScope, commitIfCurrent } from './scopedWriteQueue';
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
  const token = captureScope();
  try {
    const raw = await scopedStorage.getItem(STORAGE_KEY);
    if (isCoachMode(raw) && raw !== current) {
      // W4 — a read issued under one member must not publish under another.
      commitIfCurrent(token, () => {
        current = raw;
        notify();
      });
    }
  } catch {
    /* ignore — defaults to DEFAULT_COACH_MODE */
  }
}

// Hydration is LAZY. It used to run at MODULE EVALUATION, which happens at
// import time — before Clerk has answered — so the read resolved against the
// pre-isolation GLOBAL key and cached a value before identity existed. The
// hook below triggers it instead.
// A scope change resets this store to un-hydrated, so the next member reads
// their own setting rather than inheriting the previous member's.
subscribeUserScope(() => {
  hydrated = false;
  current = DEFAULT_COACH_MODE;
  notify();
});

export function getCoachMode(): CoachMode {
  return current;
}

export async function setCoachMode(next: CoachMode): Promise<void> {
  if (current === next) return;
  current = next;
  notify();
  try {
    await scopedStorage.setItem(STORAGE_KEY, next);
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
  // Lazy hydration — module-evaluation hydration was removed because it read
  // storage before identity existed. Every consumer triggers the read itself.
  useEffect(() => {
    void hydrate();
  }, []);
  return useSyncExternalStore(subscribe, getCoachMode, getCoachMode);
}

/**
 * Pure formula for the effective mode: 'spoken' (today's behavior) until
 * `spec_coachV2` is on, at which point the user's stored choice takes
 * effect. Shared by `useCoachMode()` below and
 * `components/CoachModeVoiceSync.tsx` (which mirrors this same value into
 * `services/textToSpeech`'s speak() gate) so the two can never drift out
 * of sync, and so the rule is unit-testable without rendering a hook.
 */
export function resolveEffectiveCoachMode(specCoachV2: boolean, stored: CoachMode): CoachMode {
  return specCoachV2 ? stored : 'spoken';
}

/**
 * Effective coach mode for downstream voice / haptic gates. Returns
 * 'spoken' (today's behavior) until `spec_coachV2` is flipped on, at
 * which point the user's stored choice takes effect.
 */
export function useCoachMode(): CoachMode {
  const stored = useCoachModeSetting();
  const flags = useFeatureFlags();
  return resolveEffectiveCoachMode(flags.spec_coachV2, stored);
}
