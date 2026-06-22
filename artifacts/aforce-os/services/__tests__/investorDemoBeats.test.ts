/**
 * AForce — Investor Demo beat schedule tests (Phase 10, six-act flow).
 *
 * Locks the cinematic 60-second timeline (6 acts × 10s) so any future tweak
 * to the seed (`data/demoProfile.ts`) or the derivation trips a test instead
 * of silently de-syncing voice / visuals / total runtime. Voice timing is
 * asserted to fit inside the speaking act's window under the commandVoiceBus's
 * speech-length estimate.
 */

import { describe, expect, it } from 'vitest';

import {
  INVESTOR_DEMO_BEATS,
  INVESTOR_DEMO_TOTAL_MS,
  beatAtMs,
  bandToLevel,
  scoreToBand,
  type DemoBeat,
  type DemoBand,
  type DemoScene,
} from '../demo/investorDemoBeats';
import { DEMO_PROFILE } from '../../data/demoProfile';

const SPEECH_MS_PER_CHAR = 70;
const SPEECH_FLOOR_MS = 1400;

function estimatedSpeechMs(line: string): number {
  return Math.max(SPEECH_FLOOR_MS, line.length * SPEECH_MS_PER_CHAR);
}

const EXPECTED_SCENES: DemoScene[] = [
  'opening',
  'readiness',
  'hydroScan',
  'social',
  'territoryHeat',
  'standard',
];

describe('investorDemoBeats — schedule integrity', () => {
  it('runs for exactly 60 seconds total', () => {
    expect(INVESTOR_DEMO_TOTAL_MS).toBe(60_000);
    const lastBeat = INVESTOR_DEMO_BEATS[INVESTOR_DEMO_BEATS.length - 1];
    expect(lastBeat.startMs + lastBeat.durationMs).toBe(60_000);
  });

  it('contains exactly the six narrative acts', () => {
    expect(INVESTOR_DEMO_BEATS).toHaveLength(6);
    expect(INVESTOR_DEMO_BEATS.map((b: DemoBeat) => b.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('renders the six scenes in the authored order', () => {
    expect(INVESTOR_DEMO_BEATS.map((b: DemoBeat) => b.scene)).toEqual(EXPECTED_SCENES);
  });

  it('acts are gap-free, monotonically ordered, and each owns 10s', () => {
    let cursor = 0;
    for (const b of INVESTOR_DEMO_BEATS) {
      expect(b.startMs).toBe(cursor);
      expect(b.durationMs).toBe(10_000);
      cursor += b.durationMs;
    }
    expect(cursor).toBe(INVESTOR_DEMO_TOTAL_MS);
  });

  it('is derived from the seed (start times are cumulative)', () => {
    expect(INVESTOR_DEMO_BEATS.map((b) => b.startMs)).toEqual([
      0, 10_000, 20_000, 30_000, 40_000, 50_000,
    ]);
  });
});

describe('investorDemoBeats — voice timing safety', () => {
  it('only Act 3 (HydroScan) speaks', () => {
    const speaking = INVESTOR_DEMO_BEATS.filter((b) => b.voice);
    expect(speaking).toHaveLength(1);
    expect(speaking[0].id).toBe(3);
    expect(speaking[0].scene).toBe('hydroScan');
  });

  it('the spoken line fits inside its act window under the bus speech estimate', () => {
    for (const b of INVESTOR_DEMO_BEATS) {
      if (!b.voice) continue;
      const estimate = estimatedSpeechMs(b.voice.line);
      // Small post-roll cushion so playback lands before the next act starts.
      expect(estimate).toBeLessThanOrEqual(b.durationMs - 220);
    }
  });

  it('the spoken line is non-empty and ends with a sentence terminator', () => {
    for (const b of INVESTOR_DEMO_BEATS) {
      if (!b.voice) continue;
      expect(b.voice.line.trim().length).toBeGreaterThan(0);
      expect(b.voice.line).toMatch(/[.!?]$/);
    }
  });
});

describe('investorDemoBeats — narrative correctness', () => {
  it('Act 1 opens depleted with the brand wordmark', () => {
    const b = INVESTOR_DEMO_BEATS[0];
    expect(b.scene).toBe('opening');
    expect(b.band).toBe('CRITICAL');
    expect(b.score).toBe(14);
    expect(b.title).toBe(DEMO_PROFILE.brand.wordmark);
  });

  it('Act 2 climbs from depleted (14) to peak (97)', () => {
    const b = INVESTOR_DEMO_BEATS[1];
    expect(b.scene).toBe('readiness');
    expect(b.scoreFrom).toBe(14);
    expect(b.score).toBe(97);
    expect(b.band).toBe('PEAK');
  });

  it('Act 3 recognizes a product and speaks a system command', () => {
    const b = INVESTOR_DEMO_BEATS[2];
    expect(b.scene).toBe('hydroScan');
    expect(b.sceneData?.productName).toBeTruthy();
    expect(b.sceneData?.productVerdict).toBeTruthy();
    expect(b.voice?.category).toBe('system_command');
  });

  it('Act 4 surfaces a Social-Mode safety overlay (BAC)', () => {
    const b = INVESTOR_DEMO_BEATS[3];
    expect(b.scene).toBe('social');
    expect(b.band).toBe('STABLE');
    expect(b.sceneData?.bacText).toBeTruthy();
  });

  it('Act 5 escalates Heat Guard to a warning over a territory sector', () => {
    const b = INVESTOR_DEMO_BEATS[4];
    expect(b.scene).toBe('territoryHeat');
    expect(b.band).toBe('RISK');
    expect(b.sceneData?.heatStatus?.toUpperCase()).toContain('WARNING');
    expect(b.sceneData?.heatDetail).toBeTruthy();
    expect(b.sceneData?.territoryLabel).toBeTruthy();
  });

  it('Act 6 closes on a clean Peak orb with the brand sign-off', () => {
    const b = INVESTOR_DEMO_BEATS[5];
    expect(b.scene).toBe('standard');
    expect(b.band).toBe('PEAK');
    expect(b.label).toBe(DEMO_PROFILE.brand.signOff);
  });
});

describe('investorDemoBeats — helpers', () => {
  it('beatAtMs returns the correct act for any elapsed time', () => {
    expect(beatAtMs(-10).id).toBe(1);
    expect(beatAtMs(0).id).toBe(1);
    expect(beatAtMs(9_999).id).toBe(1);
    expect(beatAtMs(10_000).id).toBe(2);
    expect(beatAtMs(20_000).id).toBe(3);
    expect(beatAtMs(29_999).id).toBe(3);
    expect(beatAtMs(30_000).id).toBe(4);
    expect(beatAtMs(40_000).id).toBe(5);
    expect(beatAtMs(50_000).id).toBe(6);
    expect(beatAtMs(59_999).id).toBe(6);
    // Past the end clamps to the final act.
    expect(beatAtMs(99_999).id).toBe(6);
  });

  it('bandToLevel maps every demo band to a real PerformanceLevel', () => {
    expect(bandToLevel('PEAK')).toBe('PEAK');
    expect(bandToLevel('STABLE')).toBe('BALANCED');
    expect(bandToLevel('CORRECT')).toBe('BALANCED');
    expect(bandToLevel('RISK')).toBe('RECOVERING');
    expect(bandToLevel('CRITICAL')).toBe('DEPLETED');
  });

  it('scoreToBand tints the climbing orb across every threshold', () => {
    const cases: Array<[number, DemoBand]> = [
      [97, 'PEAK'],
      [88, 'PEAK'],
      [87, 'STABLE'],
      [70, 'STABLE'],
      [69, 'RISK'],
      [45, 'RISK'],
      [44, 'CRITICAL'],
      [14, 'CRITICAL'],
      [0, 'CRITICAL'],
    ];
    for (const [score, band] of cases) {
      expect(scoreToBand(score)).toBe(band);
    }
  });

  it('scoreToBand bands are monotonic as the score rises', () => {
    const order: DemoBand[] = ['CRITICAL', 'RISK', 'STABLE', 'PEAK'];
    let lastRank = -1;
    for (let s = 0; s <= 100; s += 1) {
      const rank = order.indexOf(scoreToBand(s));
      expect(rank).toBeGreaterThanOrEqual(lastRank);
      lastRank = rank;
    }
  });
});
