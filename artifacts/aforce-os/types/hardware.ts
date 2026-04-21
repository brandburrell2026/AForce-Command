/**
 * Phantom Band hardware types.
 *
 * Phantom Band is NOT a smartwatch. It is a private trigger surface +
 * passive signal relay for AForce OS. These types model the small set
 * of states and events the OS needs to coordinate with it.
 */

import type { PerformanceLevel } from './index';

export type BandConnectionStatus =
  | 'unpaired'
  | 'pairing'
  | 'connected'
  | 'syncing'
  | 'disconnected';

/** LED visual states mirror performance bands. */
export type LedColorState = 'peak' | 'balanced' | 'recovering' | 'depleted' | 'off';

export type LedPulseShape = 'steady' | 'slow_pulse' | 'fast_pulse' | 'urgent';

export interface LedPattern {
  color: LedColorState;
  shape: LedPulseShape;
  /** Hex used by the on-device preview. */
  hex: string;
  /** Pulse period in ms. 0 = steady. */
  periodMs: number;
}

export type HapticPattern =
  | 'tap'              // single light tap — confirmation
  | 'protocol_open'    // 1 short pulse
  | 'recovery_needed'  // 2 medium pulses
  | 'depleted'         // 3 sharp pulses
  | 'critical_heat'    // urgent pattern
  | 'wake'             // gentle morning wake
  | 'voice_open';      // band confirmation when voice mode opens

export type BandGesture =
  | 'single_tap'       // wake / acknowledge signal
  | 'double_tap'       // trigger voice input
  | 'long_press'       // quick status check
  | 'press_and_hold';  // emergency voice trigger

export interface HardwareDevice {
  deviceId: string;
  name: string;
  kind: 'phantom_band';
  firmwareVersion: string;
  batteryLevel: number; // 0-100
  signalStrengthDb: number; // negative dBm
}

export interface PhantomBandState {
  device: HardwareDevice | null;
  connection: BandConnectionStatus;
  ledPattern: LedPattern;
  /** Mirrored engine performance level — drives LED. */
  mirroredLevel: PerformanceLevel | null;
  /** Last sync timestamp in ms since epoch. */
  lastSyncAt: number | null;
  /** Cached LED state used while disconnected. */
  cachedLed: LedPattern | null;
}

/** Commands the OS sends TO the band over BLE. */
export type HardwareCommand =
  | { type: 'set_led'; pattern: LedPattern }
  | { type: 'haptic'; pattern: HapticPattern }
  | { type: 'sync_now' }
  | { type: 'identify' };

/** A signal observed by the band (gesture or environmental). */
export interface BandSignal {
  at: number;
  source: 'gesture' | 'sync' | 'system';
  gesture?: BandGesture;
  note?: string;
}

/** Mapping of gesture → semantic action for the OS. */
export const GESTURE_ACTION: Record<BandGesture, {
  label: string;
  description: string;
  haptic: HapticPattern;
}> = {
  single_tap: {
    label: 'Wake / Acknowledge',
    description: 'Single tap wakes the band or acknowledges an active signal.',
    haptic: 'tap',
  },
  double_tap: {
    label: 'Trigger Voice',
    description: 'Double tap opens AForce Voice on the phone.',
    haptic: 'voice_open',
  },
  long_press: {
    label: 'Status Check',
    description: 'Long press requests a silent status pulse.',
    haptic: 'tap',
  },
  press_and_hold: {
    label: 'Emergency Voice',
    description: 'Press and hold opens voice with priority routing.',
    haptic: 'voice_open',
  },
};
