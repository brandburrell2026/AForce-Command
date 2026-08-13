/**
 * protocolV3Presentation — unit tests. Honest-data contract: missing readings
 * render an em dash, no invented denominators, "Live" only inside the shared
 * freshness window.
 */
import { describe, it, expect } from 'vitest';

import { LIVE_WINDOW_MS, formatHrvMs } from '@/components/home/homeV3Presentation';
import {
  formatBpm,
  hydrationProgress,
  signalsAreLive,
  ringFraction,
  anySignalReported,
  EM_DASH,
} from '../protocolV3Presentation';

const NOW = 1_754_900_000_000;

describe('formatBpm', () => {
  it('rounds and applies the leading-space unit rule', () => {
    expect(formatBpm(57.6)).toBe('58 bpm');
    expect(formatBpm(58)).toBe('58 bpm');
  });
  it('em-dashes missing/invalid readings — never invents a number', () => {
    expect(formatBpm(null)).toBe('—');
    expect(formatBpm(undefined)).toBe('—');
    expect(formatBpm(0)).toBe('—');
    expect(formatBpm(Number.NaN)).toBe('—');
  });
});

describe('hydrationProgress', () => {
  it('reports real oz with a clamped fraction', () => {
    expect(hydrationProgress(118, 128)).toEqual({ consumed: 118, target: 128, fraction: 118 / 128 });
    expect(hydrationProgress(140, 128)!.fraction).toBe(1);
    expect(hydrationProgress(-5, 128)).toEqual({ consumed: 0, target: 128, fraction: 0 });
  });
  it('returns null with no target — the bar renders nothing rather than a made-up denominator', () => {
    expect(hydrationProgress(50, 0)).toBeNull();
    expect(hydrationProgress(50, Number.NaN)).toBeNull();
  });
});

describe('signalsAreLive', () => {
  it('is live only inside the shared window', () => {
    expect(signalsAreLive(NOW - LIVE_WINDOW_MS + 1000, NOW)).toBe(true);
    expect(signalsAreLive(NOW - LIVE_WINDOW_MS - 1000, NOW)).toBe(false);
  });
  it('never live for absent or future (clock-skewed) timestamps', () => {
    expect(signalsAreLive(null, NOW)).toBe(false);
    expect(signalsAreLive(NOW + 60_000, NOW)).toBe(false);
  });
});

describe('anySignalReported', () => {
  it('is false only when EVERY value is the formatters\' own "no reading" mark', () => {
    expect(anySignalReported(EM_DASH, EM_DASH)).toBe(false);
    expect(anySignalReported(EM_DASH, '54 ms')).toBe(true);
    expect(anySignalReported('58 bpm', EM_DASH)).toBe(true);
  });

  it('composes with the real formatters — a fully unreported pair collapses the tiles', () => {
    // The screen swaps the two bordered tiles for one sentence on false; a
    // single real reading is enough to keep them, so nothing is ever hidden.
    expect(anySignalReported(formatBpm(null), formatHrvMs(null))).toBe(false);
    expect(anySignalReported(formatBpm(0), formatHrvMs(Number.NaN))).toBe(false);
    expect(anySignalReported(formatBpm(58), formatHrvMs(null))).toBe(true);
  });

  it('treats an empty argument list as nothing reported (never a stray true)', () => {
    expect(anySignalReported()).toBe(false);
  });
});

describe('ringFraction', () => {
  it('clamps and survives an empty plan', () => {
    expect(ringFraction(2, 4)).toBe(0.5);
    expect(ringFraction(5, 4)).toBe(1);
    expect(ringFraction(0, 0)).toBe(0);
    expect(ringFraction(1, Number.NaN)).toBe(0);
  });
});
