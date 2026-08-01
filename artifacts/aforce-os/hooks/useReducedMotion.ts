/**
 * useReducedMotion — the single shared reduced-motion signal (E3).
 *
 * The app previously read reduce-motion three different ways (Reanimated's
 * `ReduceMotion.System`, `useReducedMotion`, and raw
 * `AccessibilityInfo.isReduceMotionEnabled`). This is the one hook every elite
 * motion surface should use, so the "every motion has a static alternative"
 * contract is honored consistently. Thin wrapper over Reanimated's own
 * subscription (which tracks the OS setting + `prefers-reduced-motion` on web),
 * coerced to a plain boolean.
 */
import { useReducedMotion as useReanimatedReducedMotion } from 'react-native-reanimated';

export function useReducedMotion(): boolean {
  return useReanimatedReducedMotion() ?? false;
}
