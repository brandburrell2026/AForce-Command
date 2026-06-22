/**
 * AForce — Investor Demo (60-second cinematic flow).
 *
 * Pure schedule library. The playable timeline is DERIVED from the seed
 * in `data/demoProfile.ts` — this module never invents narrative values,
 * it only turns the six authored acts into an ordered list of "beats"
 * with cumulative start times plus a couple of pure lookup helpers the
 * overlay uses to drive its animation.
 *
 * Six acts, ten seconds each (6 × 10s = 60s):
 *
 *   1  Opening          — AForce wordmark + "The Performance Operating System."
 *   2  Readiness Score  — orb climbs Depleted → Peak, score 14 → 97.
 *   3  HydroScan        — product recognition + AI voice moment.
 *   4  Social Mode      — BAC safety overlay (crimson ring) on the orb.
 *   5  Territory + Heat — stylized map + Heat Guard escalates to WARNING.
 *   6  The Standard     — clean Peak orb + brand sign-off.
 *
 * Score-Protection: the overlay only ever PROJECTS these seeded numbers;
 * nothing here (or in the overlay) awards, mutates, or persists score.
 */

import type { PerformanceLevel } from '../../types';
import {
  DEMO_PROFILE,
  type DemoActSeed,
  type DemoBand,
  type DemoScene,
  type DemoSceneData,
  type DemoVoiceCategory,
  type DemoVoiceSeed,
} from '../../data/demoProfile';

// Re-export the seed types so existing consumers (the overlay) can keep
// importing demo types from this module.
export type {
  DemoBand,
  DemoScene,
  DemoSceneData,
  DemoVoiceCategory,
} from '../../data/demoProfile';

/** Voice utterance attached to a beat (Act 3 only). */
export type DemoVoice = DemoVoiceSeed;

export interface DemoBeat {
  /** 1-indexed act number, used by the progress strip. */
  id: number;
  /** When this beat takes the stage, measured from demo start. */
  startMs: number;
  /** How long this beat owns the screen. Sum across all beats == 60_000. */
  durationMs: number;
  /** Which scene the overlay renders. */
  scene: DemoScene;
  /** Eyebrow / title (uppercase). */
  title: string;
  /** One-line caption rendered under the act (verbatim spec copy). */
  label: string;
  /** Hydration score displayed during the beat (animated from prev). */
  score: number;
  /** Optional starting score for an animated climb (Act 2: 14 → 97). */
  scoreFrom?: number;
  /** Band the orb tints to. */
  band: DemoBand;
  /** Optional voice utterance fired exactly once when the beat starts. */
  voice?: DemoVoice;
  /** Scene-specific seeded mock data. */
  sceneData?: DemoSceneData;
}

/** Total cinematic duration. Asserted in tests. */
export const INVESTOR_DEMO_TOTAL_MS = 60_000;

/**
 * The six-act timeline the overlay plays end-to-end, derived from
 * `DEMO_PROFILE.acts`. Start times are computed cumulatively so the seed
 * only has to declare each act's duration.
 */
export const INVESTOR_DEMO_BEATS: ReadonlyArray<DemoBeat> = Object.freeze(
  DEMO_PROFILE.acts.reduce<DemoBeat[]>((acc, act: DemoActSeed) => {
    const prev = acc[acc.length - 1];
    const startMs = prev ? prev.startMs + prev.durationMs : 0;
    acc.push({
      id: act.id,
      startMs,
      durationMs: act.durationMs,
      scene: act.scene,
      title: act.title,
      label: act.label,
      score: act.score,
      scoreFrom: act.scoreFrom,
      band: act.band,
      voice: act.voice,
      sceneData: act.sceneData,
    });
    return acc;
  }, []),
);

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

/**
 * Map a live score to a band so the orb can re-tint continuously while the
 * Readiness Score animates 14 → 97 (Depleted → Recovering → Balanced → Peak).
 * Pure; display-only (Score-Protection).
 */
export function scoreToBand(score: number): DemoBand {
  if (score >= 88) return 'PEAK';
  if (score >= 70) return 'STABLE';
  if (score >= 45) return 'RISK';
  return 'CRITICAL';
}
