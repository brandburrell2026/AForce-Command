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
import { shouldFireHaptic, type HapticKind } from '@/components/ui/motionLogic';

export type { HapticKind } from '@/components/ui/motionLogic';

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
