/**
 * Ring Service — AForce Ring biometric stream (mocked, no hardware).
 *
 * The AForce Ring is a wearable companion that continuously streams
 * physiological signals into the AForce engine: galvanic skin response
 * (GSR sweat-onset), skin temperature, heart rate / HR zone, movement
 * classification, and (when active) auto-detected sport. This module
 * exposes a single source of truth for that stream and a tiny pub/sub
 * hook so any screen can subscribe.
 *
 * Implementation:
 *   - 1 Hz tick loop driven by setInterval.
 *   - Two operating modes: idle (resting) and session (active workout).
 *   - Session is started/stopped manually via startMockSession() /
 *     stopMockSession() — these are demo affordances. In production the
 *     ring would auto-detect a session start when movement class jumps
 *     to 'vigorous' and HR crosses zone 3+.
 *   - Subscribers are notified on every tick + every state mutation.
 *
 * The data layer is pure TS so it can be unit-tested without React.
 * The useRingStream() hook is the only React-bound surface.
 */

import { useEffect, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MovementClass = 'sedentary' | 'light' | 'moderate' | 'vigorous';

export type Sport =
  | 'Soccer'
  | 'Running'
  | 'Cycling'
  | 'Tennis'
  | 'Basketball'
  | 'Walking'
  | null;

export interface RingBiometrics {
  /** Heart rate, bpm. */
  heartRateBpm: number;
  /** HR zone 1–5 derived from %HRmax assuming HRmax ≈ 190. */
  hrZone: 1 | 2 | 3 | 4 | 5;
  /** Skin temperature in degrees Celsius. */
  skinTempC: number;
  /** True when GSR has detected sustained sweat onset. */
  gsrActive: boolean;
  /** Unix-ms timestamp of GSR onset, or null if not active. */
  gsrOnsetAt: number | null;
  /** Coarse activity classification. */
  movementClass: MovementClass;
  /** Auto-detected sport when movementClass === 'vigorous', else null. */
  sport: Sport;
}

export interface RingState {
  /** Whether the app sees the ring on Bluetooth. */
  connected: boolean;
  /** Battery level, 0–100. */
  batteryPct: number;
  /** Latest biometrics snapshot. */
  biometrics: RingBiometrics;
  /** Demo flag — true when a mock session has been started. */
  sessionActive: boolean;
}

// ─── Singleton state + subscribers ───────────────────────────────────────────

const IDLE: RingBiometrics = {
  heartRateBpm: 72,
  hrZone: 1,
  skinTempC: 36.4,
  gsrActive: false,
  gsrOnsetAt: null,
  movementClass: 'sedentary',
  sport: null,
};

let state: RingState = {
  connected: true,
  batteryPct: 82,
  biometrics: { ...IDLE },
  sessionActive: false,
};

type Listener = (s: RingState) => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(state);
}

function deriveHrZone(bpm: number): RingBiometrics['hrZone'] {
  // Assumes HRmax ≈ 190 bpm. Standard 5-zone split (50/60/70/80/90% HRmax).
  const pct = bpm / 190;
  if (pct < 0.6) return 1;
  if (pct < 0.7) return 2;
  if (pct < 0.8) return 3;
  if (pct < 0.9) return 4;
  return 5;
}

// ─── Mutators ────────────────────────────────────────────────────────────────

export function startMockSession(): void {
  if (state.sessionActive) return;
  state = {
    ...state,
    sessionActive: true,
    biometrics: {
      ...state.biometrics,
      heartRateBpm: 142,
      hrZone: deriveHrZone(142),
      skinTempC: 37.1,
      movementClass: 'vigorous',
      sport: 'Soccer',
      // GSR onset triggers ~30s into a session in real life — we delay
      // it a few ticks so the UI shows "onset detected N seconds ago"
      // climbing from 0.
      gsrActive: false,
      gsrOnsetAt: null,
    },
  };
  emit();
}

export function stopMockSession(): void {
  if (!state.sessionActive) return;
  state = {
    ...state,
    sessionActive: false,
    biometrics: { ...IDLE },
  };
  emit();
}

export function getRingSnapshot(): RingState {
  return state;
}

// ─── Tick loop ───────────────────────────────────────────────────────────────

function tick() {
  const b = state.biometrics;

  if (state.sessionActive) {
    // Drift HR around 168 ± 4 with smoothing
    const targetHr = 168;
    const nextHr = Math.round(b.heartRateBpm + (targetHr - b.heartRateBpm) * 0.15 + (Math.random() - 0.5) * 4);
    const nextSkin = Math.min(38.6, b.skinTempC + 0.005 + (Math.random() - 0.5) * 0.02);
    const onset = b.gsrOnsetAt ?? (Math.random() < 0.18 ? Date.now() : null);
    state = {
      ...state,
      biometrics: {
        ...b,
        heartRateBpm: nextHr,
        hrZone: deriveHrZone(nextHr),
        skinTempC: +nextSkin.toFixed(2),
        gsrActive: onset != null,
        gsrOnsetAt: onset,
        movementClass: 'vigorous',
        sport: 'Soccer',
      },
    };
  } else {
    // Idle drift around 72 bpm, skin temp slowly returning to 36.4
    const nextHr = Math.round(b.heartRateBpm + (72 - b.heartRateBpm) * 0.2 + (Math.random() - 0.5) * 2);
    const nextSkin = +(b.skinTempC + (36.4 - b.skinTempC) * 0.1).toFixed(2);
    state = {
      ...state,
      biometrics: {
        ...b,
        heartRateBpm: nextHr,
        hrZone: deriveHrZone(nextHr),
        skinTempC: nextSkin,
      },
    };
  }
  emit();
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;
function ensureRunning() {
  if (intervalHandle != null) return;
  intervalHandle = setInterval(tick, 1000);
}

// ─── React hook ──────────────────────────────────────────────────────────────

/**
 * Subscribe to the ring stream. Returns the latest RingState and ensures
 * the global tick loop is running while at least one subscriber exists.
 */
export function useRingStream(): RingState {
  const [snapshot, setSnapshot] = useState<RingState>(state);

  useEffect(() => {
    ensureRunning();
    const listener: Listener = (s) => setSnapshot(s);
    listeners.add(listener);
    setSnapshot(state);
    return () => {
      listeners.delete(listener);
      // Leave the interval running — cheap and keeps biometrics warm
      // even when no screen is mounted, so navigating back is instant.
    };
  }, []);

  return snapshot;
}

// ─── Helpers exposed to UI ───────────────────────────────────────────────────

/**
 * Translate the ring's continuous stream into a coarse intensity (1–5)
 * suitable for sweatRateEngine EstimateInputs.
 */
export function intensityFromMovement(m: MovementClass): 1 | 2 | 3 | 4 | 5 {
  switch (m) {
    case 'sedentary': return 1;
    case 'light': return 2;
    case 'moderate': return 3;
    case 'vigorous': return 4;
  }
}

/**
 * Minutes elapsed since GSR onset, or 0 if GSR is not active.
 */
export function minutesSinceOnset(b: RingBiometrics, now: number = Date.now()): number {
  if (!b.gsrOnsetAt) return 0;
  return Math.max(0, (now - b.gsrOnsetAt) / 60_000);
}
