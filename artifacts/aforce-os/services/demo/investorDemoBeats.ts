/**
 * AForce — Investor Demo (60-second cinematic flow).
 *
 * Pure script library: an ordered timeline of "beats" that the
 * `InvestorDemoOverlay` plays back end-to-end. Each beat encodes
 *
 *   - the on-screen status (score, band, risk-timer minutes),
 *   - the eyebrow + caption copy,
 *   - the voice utterance (if any) with its category + persona level,
 *   - and an optional `executed: true` flag that fires the
 *     bus-level "COMMAND EXECUTED" pulse on the orb.
 *
 * The overlay reads this list, schedules transitions with
 * `setTimeout`, and routes every voice line through the existing
 * `commandSpeak()` pipeline so the ElevenLabs proxy + voice bus +
 * playback lifecycle all light up exactly the way they would in
 * production. Nothing in the demo touches user state — it lives
 * entirely above the regular store.
 *
 * Brand language is verbatim from the AForce Command Voice Engine
 * spec; pressure beats use the same `pressureCommandLine()`-shaped
 * cadence as the runtime engine. Total runtime is exactly 60s.
 */

import type { PerformanceLevel } from '../../types';

export type DemoBand = 'PEAK' | 'STABLE' | 'CORRECT' | 'RISK' | 'CRITICAL';
export type DemoIntensity = 'calm' | 'standard' | 'pressure';
export type DemoVoiceCategory = 'score_band' | 'risk_timer' | 'system_command' | 'completion';

export interface DemoVoice {
  /** The exact line that will be spoken — runs through commandSpeak(). */
  line: string;
  /** Persona level used to drive ElevenLabs rate / pitch. */
  level: PerformanceLevel;
  /** UI category badge so the bus tags this utterance correctly. */
  category: DemoVoiceCategory;
}

export interface DemoBeat {
  /** 1-indexed beat number, used by the progress strip. */
  id: number;
  /** When this beat takes the stage, measured from demo start. */
  startMs: number;
  /** How long this beat owns the screen. Sum across all beats == 60_000. */
  durationMs: number;
  /** Eyebrow text (always uppercase, letterSpaced). */
  title: string;
  /** One-line caption rendered under the title. */
  subtitle: string;
  /** Hydration score displayed during the beat (animated from prev). */
  score: number;
  /** Band the orb tints to. */
  band: DemoBand;
  /** Minutes remaining on the risk timer (for the countdown chip). */
  riskMin: number;
  /** Intensity badge — flips to 'pressure' from beat 6 onward. */
  intensity: DemoIntensity;
  /** Optional voice utterance fired exactly once when the beat starts. */
  voice?: DemoVoice;
  /**
   * If true, fires `markCycleExecuted()` on the voice bus when the
   * beat starts so the orb pulses through its EXECUTED state. Used by
   * the "user completes hydration cycle" beat.
   */
  executed?: boolean;
}

/** Total cinematic duration. Asserted in tests. */
export const INVESTOR_DEMO_TOTAL_MS = 60_000;

/**
 * The 10-beat cinematic story that the overlay plays end-to-end.
 *
 *   01  Optimal Hydration       — 0–5s    — calm voice, PEAK band
 *   02  Depletion Detected      — 5–10s   — silent, score begins falling
 *   03  Risk State Engaged      — 10–15s  — silent, RISK band
 *   04  Command Issued          — 15–22s  — calm voice, full sentence
 *   05  User Ignores            — 22–28s  — silent, score keeps falling
 *   06  Pressure Mode Activated — 28–33s  — silent, CRITICAL band
 *   07  Pressure Command        — 33–41s  — sharp voice, military-style cadence
 *   08  Cycle Complete          — 41–49s  — executed pulse, score rebounds
 *   09  System Reset            — 49–55s  — voice, PEAK band restored
 *   10  Performance Restored    — 55–60s  — final brand sign-off
 */
export const INVESTOR_DEMO_BEATS: ReadonlyArray<DemoBeat> = Object.freeze([
  {
    id: 1,
    startMs: 0,
    durationMs: 5000,
    title: 'OPTIMAL HYDRATION',
    subtitle: 'AForce Command Voice Engine online. All systems peak.',
    score: 92,
    band: 'PEAK',
    riskMin: 32,
    intensity: 'calm',
    voice: {
      line: 'System optimized. Hydration status is elite.',
      level: 'PEAK',
      category: 'score_band',
    },
  },
  {
    id: 2,
    startMs: 5000,
    durationMs: 5000,
    title: 'DEPLETION DETECTED',
    subtitle: 'Sweat rate climbing. Hydration reserves drawing down.',
    score: 78,
    band: 'STABLE',
    riskMin: 24,
    intensity: 'standard',
  },
  {
    id: 3,
    startMs: 10000,
    durationMs: 5000,
    title: 'RISK STATE ENGAGED',
    subtitle: 'AForce engine flags an approaching hydration deficit.',
    score: 58,
    band: 'RISK',
    riskMin: 16,
    intensity: 'standard',
  },
  {
    id: 4,
    startMs: 15000,
    durationMs: 7000,
    title: 'COMMAND ISSUED',
    subtitle: 'Calm performance command. Plenty of runway to act.',
    score: 52,
    band: 'RISK',
    riskMin: 14,
    intensity: 'standard',
    voice: {
      line: 'Hydration window approaching. Drink twelve ounces of water.',
      level: 'RECOVERING',
      category: 'system_command',
    },
  },
  {
    id: 5,
    startMs: 22000,
    durationMs: 6000,
    title: 'USER IGNORES',
    subtitle: 'No intake logged. Window collapsing. Engine escalates.',
    score: 38,
    band: 'RISK',
    riskMin: 8,
    intensity: 'standard',
  },
  {
    id: 6,
    startMs: 28000,
    durationMs: 5000,
    title: 'PRESSURE MODE ACTIVATED',
    subtitle: 'Voice engine shifts into Pressure cadence. Filler stripped.',
    score: 26,
    band: 'CRITICAL',
    riskMin: 4,
    intensity: 'pressure',
  },
  {
    id: 7,
    startMs: 33000,
    durationMs: 8000,
    title: 'PRESSURE COMMAND',
    subtitle: 'Sharper. Shorter. Unmistakable.',
    score: 22,
    band: 'CRITICAL',
    riskMin: 2,
    intensity: 'pressure',
    voice: {
      line: 'Drink 12 oz. AForce. Now.',
      level: 'DEPLETED',
      category: 'system_command',
    },
  },
  {
    id: 8,
    startMs: 41000,
    durationMs: 8000,
    title: 'CYCLE COMPLETE',
    subtitle: 'Hydration cycle executed. Score rebuilding.',
    score: 78,
    band: 'STABLE',
    riskMin: 28,
    intensity: 'standard',
    executed: true,
  },
  {
    id: 9,
    startMs: 49000,
    durationMs: 6000,
    title: 'SYSTEM RESET',
    subtitle: 'Engine returns to baseline. Risk window closed.',
    score: 92,
    band: 'PEAK',
    riskMin: 32,
    intensity: 'standard',
    voice: {
      line: 'Cycle complete. System reset.',
      level: 'BALANCED',
      category: 'completion',
    },
  },
  {
    id: 10,
    startMs: 55000,
    durationMs: 5000,
    title: 'PERFORMANCE RESTORED',
    subtitle: 'AForce closes the loop. The athlete is back to peak.',
    score: 96,
    band: 'PEAK',
    riskMin: 32,
    intensity: 'standard',
    voice: {
      line: 'Command executed. Performance restored.',
      level: 'PEAK',
      category: 'completion',
    },
  },
] as const);

/** Find the beat that owns the given elapsed time (ms from demo start). */
export function beatAtMs(elapsedMs: number): DemoBeat {
  if (elapsedMs <= 0) return INVESTOR_DEMO_BEATS[0];
  for (let i = INVESTOR_DEMO_BEATS.length - 1; i >= 0; i -= 1) {
    if (elapsedMs >= INVESTOR_DEMO_BEATS[i].startMs) return INVESTOR_DEMO_BEATS[i];
  }
  return INVESTOR_DEMO_BEATS[0];
}

/** PEAK / STABLE / CORRECT / RISK / CRITICAL → engine performance level. */
export function bandToLevel(band: DemoBand): PerformanceLevel {
  switch (band) {
    case 'PEAK':     return 'PEAK';
    case 'STABLE':   return 'BALANCED';
    case 'CORRECT':  return 'BALANCED';
    case 'RISK':     return 'RECOVERING';
    case 'CRITICAL': return 'DEPLETED';
  }
}
