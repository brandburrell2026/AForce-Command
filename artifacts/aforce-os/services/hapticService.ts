/**
 * Haptic service — named haptic patterns for the Phantom Band.
 *
 * Real hardware would translate these to actuator commands over BLE.
 * In the OS, we replay the pattern on the phone using expo-haptics so the
 * user feels the same beat the band would produce.
 */

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { HapticPattern } from '../types/hardware';

interface Pulse {
  /** Haptic intensity — light/medium/heavy. */
  weight: 'light' | 'medium' | 'heavy';
  /** Delay in ms after the previous pulse. */
  delay: number;
}

const PATTERNS: Record<HapticPattern, Pulse[]> = {
  tap:              [{ weight: 'light',  delay: 0 }],
  voice_open:       [{ weight: 'medium', delay: 0 }],
  protocol_open:    [{ weight: 'medium', delay: 0 }],
  wake:             [{ weight: 'light',  delay: 0 }, { weight: 'light', delay: 220 }],
  recovery_needed:  [{ weight: 'medium', delay: 0 }, { weight: 'medium', delay: 220 }],
  depleted:         [{ weight: 'heavy',  delay: 0 }, { weight: 'heavy', delay: 140 }, { weight: 'heavy', delay: 140 }],
  critical_heat:    [
    { weight: 'heavy', delay: 0 },
    { weight: 'heavy', delay: 90 },
    { weight: 'heavy', delay: 90 },
    { weight: 'heavy', delay: 220 },
    { weight: 'heavy', delay: 90 },
  ],
};

const STYLE: Record<Pulse['weight'], Haptics.ImpactFeedbackStyle> = {
  light:  Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy:  Haptics.ImpactFeedbackStyle.Heavy,
};

export function playHaptic(pattern: HapticPattern): void {
  if (Platform.OS === 'web') return; // Haptics is a no-op on web — silent skip.
  const pulses = PATTERNS[pattern];
  if (!pulses?.length) return;
  let cumulative = 0;
  for (const p of pulses) {
    cumulative += p.delay;
    setTimeout(() => {
      Haptics.impactAsync(STYLE[p.weight]).catch(() => { /* swallow */ });
    }, cumulative);
  }
}

/** Shape inspector for the settings preview. */
export function describeHaptic(pattern: HapticPattern): string {
  const beats = PATTERNS[pattern].length;
  const weight = PATTERNS[pattern][0]?.weight ?? 'light';
  return `${beats} ${weight} pulse${beats === 1 ? '' : 's'}`;
}
