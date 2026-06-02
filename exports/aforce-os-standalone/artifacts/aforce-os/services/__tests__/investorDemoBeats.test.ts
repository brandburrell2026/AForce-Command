/**
 * AForce — Investor Demo beat schedule tests.
 *
 * Locks the cinematic 60-second timeline so any future tweak to the
 * beat list trips a test instead of silently de-syncing voice/visual.
 * Voice lines are asserted to fit inside their beat windows under the
 * commandVoiceBus's 70ms-per-character speech estimate.
 */

import { describe, expect, it } from 'vitest';

import {
  INVESTOR_DEMO_BEATS,
  INVESTOR_DEMO_TOTAL_MS,
  beatAtMs,
  bandToLevel,
  type DemoBeat,
} from '../demo/investorDemoBeats';

const SPEECH_MS_PER_CHAR = 70;
const SPEECH_FLOOR_MS = 1400;

function estimatedSpeechMs(line: string): number {
  return Math.max(SPEECH_FLOOR_MS, line.length * SPEECH_MS_PER_CHAR);
}

describe('investorDemoBeats — schedule integrity', () => {
  it('runs for exactly 60 seconds total', () => {
    expect(INVESTOR_DEMO_TOTAL_MS).toBe(60_000);
    const lastBeat = INVESTOR_DEMO_BEATS[INVESTOR_DEMO_BEATS.length - 1];
    expect(lastBeat.startMs + lastBeat.durationMs).toBe(60_000);
  });

  it('contains exactly the 10 narrative beats', () => {
    expect(INVESTOR_DEMO_BEATS).toHaveLength(10);
    expect(INVESTOR_DEMO_BEATS.map((b: DemoBeat) => b.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('beats are gap-free and monotonically ordered', () => {
    let cursor = 0;
    for (const b of INVESTOR_DEMO_BEATS) {
      expect(b.startMs).toBe(cursor);
      expect(b.durationMs).toBeGreaterThan(0);
      cursor += b.durationMs;
    }
    expect(cursor).toBe(INVESTOR_DEMO_TOTAL_MS);
  });
});

describe('investorDemoBeats — voice timing safety', () => {
  it('every voice line fits inside its beat window under the bus speech estimate', () => {
    for (const b of INVESTOR_DEMO_BEATS) {
      if (!b.voice) continue;
      const estimate = estimatedSpeechMs(b.voice.line);
      // Allow a small post-roll cushion so the playback "idle" lands
      // before the next beat starts (matches the bus's 220ms pre-roll).
      expect(estimate).toBeLessThanOrEqual(b.durationMs - 220);
    }
  });

  it('every voice line is non-empty and ends with a sentence terminator', () => {
    for (const b of INVESTOR_DEMO_BEATS) {
      if (!b.voice) continue;
      expect(b.voice.line.trim().length).toBeGreaterThan(0);
      expect(b.voice.line).toMatch(/[.!?]$/);
    }
  });
});

describe('investorDemoBeats — narrative correctness', () => {
  it('beat 1 establishes optimal hydration in PEAK', () => {
    const b = INVESTOR_DEMO_BEATS[0];
    expect(b.band).toBe('PEAK');
    expect(b.score).toBeGreaterThanOrEqual(85);
    expect(b.intensity).toBe('calm');
  });

  it('beats 1–6 trace a strict downward score arc', () => {
    const downward = INVESTOR_DEMO_BEATS.slice(0, 6);
    for (let i = 1; i < downward.length; i += 1) {
      expect(downward[i].score).toBeLessThan(downward[i - 1].score);
    }
  });

  it('beat 4 issues a calm/standard command — not Pressure Mode', () => {
    const b = INVESTOR_DEMO_BEATS[3];
    expect(b.intensity).toBe('standard');
    expect(b.voice).toBeDefined();
    // Calm command keeps full sentence + the soft "approaching" cadence.
    expect(b.voice?.line.toLowerCase()).toContain('approaching');
  });

  it('beat 6 flips intensity to pressure', () => {
    expect(INVESTOR_DEMO_BEATS[5].intensity).toBe('pressure');
    expect(INVESTOR_DEMO_BEATS[5].band).toBe('CRITICAL');
  });

  it('beat 7 voice line uses Pressure Mode cadence (sharp + short)', () => {
    const b = INVESTOR_DEMO_BEATS[6];
    expect(b.voice).toBeDefined();
    const line = b.voice!.line;
    // Pressure cadence assertions: short, contains "now", uses digit + ounces.
    expect(line.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(line.toLowerCase()).toContain('now');
    expect(line.toLowerCase()).toMatch(/\b\d+\s*ounces\b/);
    expect(line.toLowerCase()).not.toContain('please');
  });

  it('beat 8 marks the cycle as executed and rebounds the score', () => {
    const b = INVESTOR_DEMO_BEATS[7];
    expect(b.executed).toBe(true);
    expect(b.score).toBeGreaterThan(INVESTOR_DEMO_BEATS[6].score);
  });

  it('beats 8–10 trace a strict upward recovery arc', () => {
    const recovery = INVESTOR_DEMO_BEATS.slice(7);
    for (let i = 1; i < recovery.length; i += 1) {
      expect(recovery[i].score).toBeGreaterThanOrEqual(recovery[i - 1].score);
    }
    expect(recovery[recovery.length - 1].band).toBe('PEAK');
  });

  it('final beat closes with the brand sign-off line', () => {
    const finalBeat = INVESTOR_DEMO_BEATS[INVESTOR_DEMO_BEATS.length - 1];
    expect(finalBeat.voice?.line).toBe('Command executed. Performance restored.');
    expect(finalBeat.band).toBe('PEAK');
  });

  it('beat 9 speaks the System Reset line', () => {
    expect(INVESTOR_DEMO_BEATS[8].voice?.line).toBe('Cycle complete. System reset.');
  });
});

describe('investorDemoBeats — helpers', () => {
  it('beatAtMs returns the correct beat for any elapsed time', () => {
    expect(beatAtMs(-10).id).toBe(1);
    expect(beatAtMs(0).id).toBe(1);
    expect(beatAtMs(4999).id).toBe(1);
    expect(beatAtMs(5000).id).toBe(2);
    expect(beatAtMs(15000).id).toBe(4);
    expect(beatAtMs(33000).id).toBe(7);
    expect(beatAtMs(41000).id).toBe(8);
    expect(beatAtMs(59999).id).toBe(10);
    // Past the end clamps to the final beat.
    expect(beatAtMs(99999).id).toBe(10);
  });

  it('bandToLevel maps every demo band to a real PerformanceLevel', () => {
    expect(bandToLevel('PEAK')).toBe('PEAK');
    expect(bandToLevel('STABLE')).toBe('BALANCED');
    expect(bandToLevel('CORRECT')).toBe('BALANCED');
    expect(bandToLevel('RISK')).toBe('RECOVERING');
    expect(bandToLevel('CRITICAL')).toBe('DEPLETED');
  });
});
