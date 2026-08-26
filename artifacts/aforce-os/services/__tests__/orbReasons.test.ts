import { describe, it, expect, vi } from 'vitest';

// `services/orbReasons.ts` imports `useFeatureFlags` from
// `@/store/useAppStore` at module scope (for the hidden
// `useHiddenOrbReasons()` hook, which this suite does not test).
// The store transitively reaches RN/Expo native edges (the `expo`
// winter runtime, expo-notifications, AsyncStorage) that fail to
// load under Vitest's Node environment. Per repo convention
// (see coachModeResolution.test.ts, realApi.intake.test.ts), stub
// the RN-touching edge minimally and test the real pure logic.
vi.mock('@/store/useAppStore', () => ({
  useFeatureFlags: () => ({}),
}));

import {
  ORB_REASON_FACTORS,
  ORB_REASON_LABELS,
  type ScoreReason,
  buildReplay,
  formatReasonDelta,
  replayFrameAt,
  summarizeReasons,
} from '../orbReasons';

describe('orbReasons — spec factor vocabulary', () => {
  it('exposes exactly the four spec factors', () => {
    expect([...ORB_REASON_FACTORS].sort()).toEqual(
      ['water', 'heat', 'sleep', 'correction'].sort(),
    );
  });

  it('labels match the spec example strings verbatim', () => {
    expect(ORB_REASON_LABELS.water).toBe('Water');
    expect(ORB_REASON_LABELS.heat).toBe('Heat');
    expect(ORB_REASON_LABELS.sleep).toBe('Sleep');
    expect(ORB_REASON_LABELS.correction).toBe('Correction');
  });
});

describe('formatReasonDelta', () => {
  it('formats positives with a leading + (spec "Water +8")', () => {
    expect(formatReasonDelta(8)).toBe('+8');
    expect(formatReasonDelta(7)).toBe('+7');
  });

  it('formats negatives with a leading - (spec "Heat -3")', () => {
    expect(formatReasonDelta(-3)).toBe('-3');
  });

  it('formats zero as +0 (always signed)', () => {
    expect(formatReasonDelta(0)).toBe('+0');
  });

  it('truncates fractional deltas toward zero', () => {
    expect(formatReasonDelta(8.7)).toBe('+8');
    expect(formatReasonDelta(-3.7)).toBe('-3');
  });
});

describe('summarizeReasons', () => {
  const reasons: ScoreReason[] = [
    { factor: 'water', delta: 8, atIso: '2025-01-01T00:00:00Z' },
    { factor: 'heat', delta: -3, atIso: '2025-01-01T00:01:00Z' },
    { factor: 'sleep', delta: 4, atIso: '2025-01-01T00:02:00Z' },
    { factor: 'correction', delta: 7, atIso: '2025-01-01T00:03:00Z' },
  ];

  it('sums the spec examples to 16 net', () => {
    expect(summarizeReasons(reasons).total).toBe(16);
  });

  it('splits positive vs negative correctly', () => {
    const s = summarizeReasons(reasons);
    expect(s.positive).toBe(19);
    expect(s.negative).toBe(-3);
  });

  it('aggregates per factor', () => {
    const s = summarizeReasons(reasons);
    expect(s.byFactor.water).toBe(8);
    expect(s.byFactor.heat).toBe(-3);
    expect(s.byFactor.sleep).toBe(4);
    expect(s.byFactor.correction).toBe(7);
  });

  it('returns zero totals for empty input', () => {
    const s = summarizeReasons([]);
    expect(s.total).toBe(0);
    expect(s.positive).toBe(0);
    expect(s.negative).toBe(0);
  });
});

describe('buildReplay', () => {
  it('sorts frames ascending by atIso', () => {
    const out = buildReplay(50, [
      { factor: 'sleep', delta: 4, atIso: '2025-01-01T00:02:00Z' },
      { factor: 'water', delta: 8, atIso: '2025-01-01T00:00:00Z' },
      { factor: 'heat', delta: -3, atIso: '2025-01-01T00:01:00Z' },
    ]);
    expect(out.map((f) => f.reason.factor)).toEqual(['water', 'heat', 'sleep']);
  });

  it('accumulates running score from baseline', () => {
    const out = buildReplay(50, [
      { factor: 'water', delta: 8, atIso: '2025-01-01T00:00:00Z' },
      { factor: 'heat', delta: -3, atIso: '2025-01-01T00:01:00Z' },
      { factor: 'sleep', delta: 4, atIso: '2025-01-01T00:02:00Z' },
      { factor: 'correction', delta: 7, atIso: '2025-01-01T00:03:00Z' },
    ]);
    expect(out.map((f) => f.runningScore)).toEqual([58, 55, 59, 66]);
  });

  it('returns empty array for empty input', () => {
    expect(buildReplay(50, [])).toEqual([]);
  });

  it('preserves input length', () => {
    const reasons: ScoreReason[] = Array.from({ length: 7 }, (_, i) => ({
      factor: 'water' as const,
      delta: 1,
      atIso: `2025-01-01T00:0${i}:00Z`,
    }));
    expect(buildReplay(0, reasons)).toHaveLength(7);
  });
});

describe('replayFrameAt', () => {
  const frames = buildReplay(50, [
    { factor: 'water', delta: 8, atIso: '2025-01-01T00:00:00Z' },
    { factor: 'heat', delta: -3, atIso: '2025-01-01T00:01:00Z' },
    { factor: 'sleep', delta: 4, atIso: '2025-01-01T00:02:00Z' },
    { factor: 'correction', delta: 7, atIso: '2025-01-01T00:03:00Z' },
  ]);

  it('returns null for empty frames', () => {
    expect(replayFrameAt([], 500, 1000)).toBeNull();
  });

  it('returns the first frame at the start of the timeline', () => {
    expect(replayFrameAt(frames, 0, 1000)?.reason.factor).toBe('water');
    expect(replayFrameAt(frames, -100, 1000)?.reason.factor).toBe('water');
  });

  it('returns the last frame past the end of the timeline', () => {
    expect(replayFrameAt(frames, 1000, 1000)?.reason.factor).toBe('correction');
    expect(replayFrameAt(frames, 9999, 1000)?.reason.factor).toBe('correction');
  });

  it('returns the proportional frame mid-timeline', () => {
    // floor(0.25 * 4) = 1 → 'heat': a timeline boundary belongs to the
    // LATER frame (documented contract in replayFrameAt; the 500ms→'sleep'
    // and 750ms→'correction' expectations below encode the same rule).
    expect(replayFrameAt(frames, 250, 1000)?.reason.factor).toBe('heat');
    expect(replayFrameAt(frames, 500, 1000)?.reason.factor).toBe('sleep');
    expect(replayFrameAt(frames, 750, 1000)?.reason.factor).toBe('correction');
  });

  it('clamps to the last frame when totalDurationMs is zero', () => {
    expect(replayFrameAt(frames, 100, 0)?.reason.factor).toBe('correction');
  });
});
