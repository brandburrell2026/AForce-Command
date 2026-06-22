/**
 * AForce — Investor Demo seed profile (Phase 10).
 *
 * The 60-second cinematic overlay (`InvestorDemoOverlay`) is driven ENTIRELY
 * by this seed. Nothing here is read from the live store, the scoring engine,
 * or any real user data — every value is a hand-authored mock so the demo is
 * deterministic and Score-Protection-safe (the overlay only ever PROJECTS
 * these numbers; it never awards, mutates, or persists score).
 *
 * The demo is six acts, ten seconds each (6 × 10s = 60s):
 *
 *   1  Opening          — AForce wordmark + "The Performance Operating System."
 *   2  Readiness Score  — orb climbs Depleted → Peak, score 14 → 97.
 *   3  HydroScan        — product recognition + AI voice moment.
 *   4  Social Mode      — BAC safety overlay (crimson ring) on the orb.
 *   5  Territory + Heat — stylized map + Heat Guard escalates to WARNING.
 *   6  The Standard     — clean Peak orb + "Built for people who don't get to be off."
 *
 * `services/demo/investorDemoBeats.ts` derives the playable beat schedule
 * (cumulative start times + helpers) from `DEMO_PROFILE.acts`.
 */

import type { PerformanceLevel } from '../types';

/** Which on-screen scene an act renders. */
export type DemoScene =
  | 'opening'
  | 'readiness'
  | 'hydroScan'
  | 'social'
  | 'territoryHeat'
  | 'standard';

/** Orb tint band (kept compatible with the legacy demo band names). */
export type DemoBand = 'PEAK' | 'STABLE' | 'CORRECT' | 'RISK' | 'CRITICAL';

export type DemoVoiceCategory =
  | 'score_band'
  | 'risk_timer'
  | 'system_command'
  | 'completion';

export interface DemoVoiceSeed {
  /** Exact line spoken — routed through the real commandSpeak() pipeline. */
  line: string;
  /** Persona level used to drive ElevenLabs rate / pitch. */
  level: PerformanceLevel;
  /** UI category badge so the voice bus tags this utterance correctly. */
  category: DemoVoiceCategory;
}

/** Scene-specific mock fields (all seeded, never real user data). */
export interface DemoSceneData {
  /** hydroScan — recognized product name. */
  productName?: string;
  /** hydroScan — recognition verdict chip. */
  productVerdict?: string;
  /** social — blood-alcohol / safety-shield caption. */
  bacText?: string;
  /** territoryHeat — Heat Guard status chip (e.g. "HEAT GUARD · WARNING"). */
  heatStatus?: string;
  /** territoryHeat — supporting environmental detail line. */
  heatDetail?: string;
  /** territoryHeat — stylized map sector label. */
  territoryLabel?: string;
}

export interface DemoActSeed {
  /** 1-indexed act number. */
  id: number;
  /** Scene the overlay renders for this act. */
  scene: DemoScene;
  /** How long this act owns the screen. Six acts each own 10s. */
  durationMs: number;
  /** Eyebrow / title (uppercase). */
  title: string;
  /** One-line caption — verbatim from the Phase 10 spec. */
  label: string;
  /** Score displayed / animated to during the act. */
  score: number;
  /** Optional starting score for an animated climb (Act 2: 14 → 97). */
  scoreFrom?: number;
  /** Orb tint band. */
  band: DemoBand;
  /** Voice utterance — only Act 3 (HydroScan) speaks. */
  voice?: DemoVoiceSeed;
  /** Scene-specific seeded mock data. */
  sceneData?: DemoSceneData;
}

/** Each act owns exactly ten seconds. */
export const DEMO_ACT_MS = 10_000;

export const DEMO_PROFILE = {
  brand: {
    wordmark: 'AFORCE',
    tagline: 'The Performance Operating System.',
    signOff: "Built for people who don't get to be off.",
  },
  acts: [
    {
      id: 1,
      scene: 'opening',
      durationMs: DEMO_ACT_MS,
      title: 'AFORCE',
      label: 'The Performance Operating System.',
      // Seeded low so Act 2 can climb from here.
      score: 14,
      band: 'CRITICAL',
    },
    {
      id: 2,
      scene: 'readiness',
      durationMs: DEMO_ACT_MS,
      title: 'READINESS SCORE',
      label: 'From depleted to peak. In real time.',
      scoreFrom: 14,
      score: 97,
      band: 'PEAK',
    },
    {
      id: 3,
      scene: 'hydroScan',
      durationMs: DEMO_ACT_MS,
      title: 'HYDROSCAN',
      label: 'AI-powered hydration intelligence.',
      score: 97,
      band: 'PEAK',
      voice: {
        line: "You're back in range. Lock in.",
        level: 'PEAK',
        category: 'system_command',
      },
      sceneData: {
        productName: 'AFORCE HYDRATION STICK',
        productVerdict: 'OPTIMAL MATCH',
      },
    },
    {
      id: 4,
      scene: 'social',
      durationMs: DEMO_ACT_MS,
      title: 'SOCIAL MODE',
      label: 'Performance protection. Even off the clock.',
      score: 88,
      band: 'STABLE',
      sceneData: {
        bacText: 'BAC 0.04 · HYDRATION SHIELD ACTIVE',
      },
    },
    {
      id: 5,
      scene: 'territoryHeat',
      durationMs: DEMO_ACT_MS,
      title: 'TERRITORY · HEAT GUARD',
      label: 'Environmental intelligence. Real-time.',
      score: 84,
      band: 'RISK',
      sceneData: {
        heatStatus: 'HEAT GUARD · WARNING',
        heatDetail: '94°F · HIGH SWEAT RISK',
        territoryLabel: 'MIAMI SECTOR',
      },
    },
    {
      id: 6,
      scene: 'standard',
      durationMs: DEMO_ACT_MS,
      title: 'AFORCE',
      label: "Built for people who don't get to be off.",
      score: 97,
      band: 'PEAK',
    },
  ] as ReadonlyArray<DemoActSeed>,
} as const;
