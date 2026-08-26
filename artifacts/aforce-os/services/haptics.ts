/**
 * haptics — the central UI-haptics façade (E3).
 *
 * The app fires `expo-haptics` inline from ~60 call sites with no shared gate.
 * This façade is the single entry point for *interaction* haptics: it enforces
 * the global switches (`shouldFireHaptic` — enabled + reduce-haptics) so we never
 * buzz on every tap, maps a semantic kind to the right Expo call, no-ops on web,
 * and is best-effort (a haptics failure never throws into an interaction).
 * (This is distinct from `services/hapticService.ts`, which plays Phantom-Band
 * pattern sequences — a different subsystem.)
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  shouldFireHaptic,
  hapticKindForMoment,
  type HapticKind,
  type HapticMoment,
} from '@/components/ui/motionLogic';

export type { HapticKind, HapticMoment } from '@/components/ui/motionLogic';

export function fireHaptic(
  kind: HapticKind,
  opts: { enabled: boolean; reducedHaptics?: boolean },
): void {
  if (!shouldFireHaptic(kind, opts)) return;
  if (Platform.OS === 'web') return; // web has no haptics engine
  try {
    switch (kind) {
      case 'selection':
        void Haptics.selectionAsync();
        break;
      case 'impact':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
    }
  } catch {
    // Best-effort only — never surface a haptics error into the interaction.
  }
}

/**
 * Fire one of the FOUR named Phase-1 moments (see `HapticMoment`).
 *
 * This is the entry point every product surface should use. `fireHaptic` still
 * exists for the *press-feel* texture, which is a UI affordance gated behind
 * `elite_motion_enabled`; a moment is not an affordance — it is the product
 * acknowledging something the member did to their body — so it is not flag-
 * gated. NOTE (S2-6): no reduce-haptics preference exists yet to respect —
 * see `gate()` above, the single point where one will plug in. Still a
 * no-op on web via that same gate path.
 *
 * Deliberately argument-free beyond the moment: giving call sites a `kind` knob
 * is how the app ended up with ~60 ad-hoc `expo-haptics` calls. Adding a fifth
 * moment should require editing `HapticMoment`, which is where the "do not
 * vibrate frequently" rule is written down.
 */

/**
 * S2-6 — the gated texture primitives. Every UI haptic in the app routes
 * through these three (the boundary lock enforces it), preserving each call
 * site's original texture exactly. `gate()` is the ONE place a member or
 * system haptics preference will plug in.
 *
 * HONESTY NOTE (replacing an aspirational claim that used to live on
 * `fireMoment`): no reduce-haptics preference EXISTS yet — not in the store,
 * not in settings. Until the founder commissions one, the gate is
 * deliberately always-open and says so here rather than pretending. When the
 * preference lands, wiring it HERE gates all ~127 call sites at once.
 */
function gate(): boolean {
  if (Platform.OS === 'web') return false; // web has no haptics engine
  return true;
}

export function hapticSelection(): void {
  if (!gate()) return;
  try {
    void Haptics.selectionAsync();
  } catch {
    // Best-effort only.
  }
}

export type HapticImpactWeight = 'light' | 'medium' | 'heavy';

export function hapticImpact(weight: HapticImpactWeight = 'medium'): void {
  if (!gate()) return;
  try {
    // Enum resolved at CALL time inside the try, not at module init:
    // several render suites mock 'expo-haptics' with only the async fns,
    // and a module-level enum table would crash every such import chain.
    const style = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    }[weight];
    void Haptics.impactAsync(style);
  } catch {
    // Best-effort only.
  }
}

export type HapticNotifyType = 'success' | 'warning' | 'error';

export function hapticNotify(type: HapticNotifyType): void {
  if (!gate()) return;
  try {
    const kind = {
      success: Haptics.NotificationFeedbackType.Success,
      warning: Haptics.NotificationFeedbackType.Warning,
      error: Haptics.NotificationFeedbackType.Error,
    }[type];
    void Haptics.notificationAsync(kind);
  } catch {
    // Best-effort only.
  }
}

export function fireMoment(moment: HapticMoment): void {
  if (!gate()) return;
  fireHaptic(hapticKindForMoment(moment), { enabled: true });
}
