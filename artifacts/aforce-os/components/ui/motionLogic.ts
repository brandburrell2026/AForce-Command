/**
 * Motion system (E3) — pure decision logic.
 *
 * The AForce premium-motion contract in one place: "every motion MUST have a
 * reduced/static alternative" (`afTokens.ts`). These pure functions encode the
 * gates (feature flag + OS/user reduced-motion + reduced-haptics) so the
 * behavior is unit-tested rather than living implicitly inside components.
 * No react-native import — numbers/booleans only.
 */
import { afMotion } from '@/theme';

/** Motion runs only when it is enabled AND the user hasn't asked to reduce it. */
export function shouldAnimate(opts: { enabled: boolean; reducedMotion: boolean }): boolean {
  return opts.enabled && !opts.reducedMotion;
}

/**
 * Target scale for an interactive surface. When motion is off (flag off or
 * reduced-motion) it stays at rest (1) — the static alternative — so a pressed
 * button never jumps. `pressedScale` overrides the token default.
 */
export function pressScale(opts: {
  animate: boolean;
  pressed: boolean;
  pressedScale?: number;
}): number {
  if (!opts.animate) return afMotion.scale.rest;
  return opts.pressed ? (opts.pressedScale ?? afMotion.scale.pressed) : afMotion.scale.rest;
}

export type HapticKind = 'selection' | 'impact' | 'success' | 'warning';

/**
 * Whether a haptic should actually fire. Haptics are for *meaningful* moments
 * only (verified completion, acknowledgement, warning) — the caller decides the
 * kind; this gate just enforces the global switches so we never buzz on every
 * tap or against a reduce-haptics preference.
 */
export function shouldFireHaptic(
  _kind: HapticKind,
  opts: { enabled: boolean; reducedHaptics?: boolean },
): boolean {
  if (!opts.enabled) return false;
  if (opts.reducedHaptics) return false;
  return true;
}

/** Shimmer runs only when animating; otherwise the skeleton is a static block. */
export function shimmerEnabled(opts: { enabled: boolean; reducedMotion: boolean }): boolean {
  return shouldAnimate(opts);
}
