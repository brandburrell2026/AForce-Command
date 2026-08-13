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
 * gated. It still respects `reducedHaptics` through `shouldFireHaptic`, and it
 * is still a no-op on web.
 *
 * Deliberately argument-free beyond the moment: giving call sites a `kind` knob
 * is how the app ended up with ~60 ad-hoc `expo-haptics` calls. Adding a fifth
 * moment should require editing `HapticMoment`, which is where the "do not
 * vibrate frequently" rule is written down.
 */
export function fireMoment(moment: HapticMoment): void {
  fireHaptic(hapticKindForMoment(moment), { enabled: true });
}
