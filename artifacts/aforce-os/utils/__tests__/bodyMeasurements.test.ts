import { describe, expect, it } from 'vitest';

import {
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  WEIGHT_LBS_MAX,
  WEIGHT_LBS_MIN,
} from '../profileIdentity';
import {
  cmToNearestHalfInches,
  halfInchesToCm,
  kgToLbs,
} from '../units';
import {
  DEFAULT_HEIGHT_CM,
  MAX_HALF_INCHES,
  MIN_HALF_INCHES,
  formatHeightValue,
  formatWeightInputValue,
  parseWeightToLbs,
  stepHeightCm,
} from '../bodyMeasurements';

describe('parseWeightToLbs', () => {
  it('returns null for empty / whitespace / junk input', () => {
    expect(parseWeightToLbs('', 'lbs')).toBeNull();
    expect(parseWeightToLbs('   ', 'lbs')).toBeNull();
    expect(parseWeightToLbs('abc', 'lbs')).toBeNull();
  });

  it('parses pounds as integer pounds within range', () => {
    expect(parseWeightToLbs('175', 'lbs')).toBe(175);
    expect(parseWeightToLbs('175.4', 'lbs')).toBe(175);
    expect(parseWeightToLbs('175.6', 'lbs')).toBe(176);
  });

  it('converts kilograms into canonical pounds', () => {
    expect(parseWeightToLbs('80', 'kg')).toBe(Math.round(kgToLbs(80)));
    expect(parseWeightToLbs('100', 'kg')).toBe(Math.round(kgToLbs(100)));
  });

  it('returns null for out-of-range values (clears rather than clamps)', () => {
    expect(parseWeightToLbs(String(WEIGHT_LBS_MIN - 1), 'lbs')).toBeNull();
    expect(parseWeightToLbs(String(WEIGHT_LBS_MAX + 1), 'lbs')).toBeNull();
    expect(parseWeightToLbs('1', 'lbs')).toBeNull();
  });

  it('accepts the inclusive range boundaries', () => {
    expect(parseWeightToLbs(String(WEIGHT_LBS_MIN), 'lbs')).toBe(WEIGHT_LBS_MIN);
    expect(parseWeightToLbs(String(WEIGHT_LBS_MAX), 'lbs')).toBe(WEIGHT_LBS_MAX);
  });
});

describe('formatWeightInputValue', () => {
  it('renders empty string for null', () => {
    expect(formatWeightInputValue(null, 'lbs')).toBe('');
    expect(formatWeightInputValue(null, 'kg')).toBe('');
  });

  it('renders whole pounds unchanged', () => {
    expect(formatWeightInputValue(175, 'lbs')).toBe('175');
  });

  it('renders kilograms rounded to a whole number', () => {
    expect(formatWeightInputValue(181, 'kg')).toBe('82');
  });

  it('round-trips parse(format(x)) back to x in lbs', () => {
    for (const lbs of [WEIGHT_LBS_MIN, 120, 175, 240, WEIGHT_LBS_MAX]) {
      expect(parseWeightToLbs(formatWeightInputValue(lbs, 'lbs'), 'lbs')).toBe(lbs);
    }
  });
});

describe('stepHeightCm', () => {
  it('lands on the default for an unset field regardless of direction', () => {
    expect(stepHeightCm(null, 1, 'cm')).toBe(DEFAULT_HEIGHT_CM);
    expect(stepHeightCm(null, -1, 'cm')).toBe(DEFAULT_HEIGHT_CM);
    expect(stepHeightCm(null, 1, 'ft')).toBe(DEFAULT_HEIGHT_CM);
    expect(stepHeightCm(null, -1, 'ft')).toBe(DEFAULT_HEIGHT_CM);
  });

  it('steps metric by exactly 1 cm', () => {
    expect(stepHeightCm(180, 1, 'cm')).toBe(181);
    expect(stepHeightCm(180, -1, 'cm')).toBe(179);
  });

  it('clamps metric at the canonical range boundaries', () => {
    expect(stepHeightCm(HEIGHT_CM_MAX, 1, 'cm')).toBe(HEIGHT_CM_MAX);
    expect(stepHeightCm(HEIGHT_CM_MIN, -1, 'cm')).toBe(HEIGHT_CM_MIN);
  });

  it('steps imperial by exactly one half-inch', () => {
    const cm = 178; // 5'10"
    const up = stepHeightCm(cm, 1, 'ft');
    const down = stepHeightCm(cm, -1, 'ft');
    expect(cmToNearestHalfInches(up)).toBe(cmToNearestHalfInches(cm) + 1);
    expect(cmToNearestHalfInches(down)).toBe(cmToNearestHalfInches(cm) - 1);
  });

  it('clamps imperial at the half-inch bounds', () => {
    const max = halfInchesToCm(MAX_HALF_INCHES);
    const min = halfInchesToCm(MIN_HALF_INCHES);
    expect(cmToNearestHalfInches(stepHeightCm(max, 1, 'ft'))).toBe(MAX_HALF_INCHES);
    expect(cmToNearestHalfInches(stepHeightCm(min, -1, 'ft'))).toBe(MIN_HALF_INCHES);
  });

  it('is drift-free: every half-inch step maps to a distinct, stable cm', () => {
    // If cm -> half-inch -> cm round-trips for every canonical step
    // position, then repeated stepping is monotonic and never sticks.
    for (let hi = MIN_HALF_INCHES; hi <= MAX_HALF_INCHES; hi++) {
      const cm = halfInchesToCm(hi);
      expect(cmToNearestHalfInches(cm)).toBe(hi);
    }
  });

  it('produces a strictly increasing display when stepped up across the range', () => {
    let cur: number | null = null;
    let prevHi = -Infinity;
    cur = stepHeightCm(cur, 1, 'ft'); // seed at default
    for (let i = 0; i < MAX_HALF_INCHES - MIN_HALF_INCHES + 5; i++) {
      const hi = cmToNearestHalfInches(cur);
      expect(hi).toBeGreaterThanOrEqual(prevHi);
      prevHi = hi;
      cur = stepHeightCm(cur, 1, 'ft');
    }
    expect(cmToNearestHalfInches(cur)).toBe(MAX_HALF_INCHES);
  });
});

describe('formatHeightValue', () => {
  it('formats metric as whole centimetres', () => {
    expect(formatHeightValue(180, 'cm')).toBe('180 cm');
    expect(formatHeightValue(180.4, 'cm')).toBe('180 cm');
  });

  it('formats imperial to the nearest half-inch', () => {
    expect(formatHeightValue(178, 'ft')).toBe("5'10\"");
    expect(formatHeightValue(179, 'ft')).toBe("5'10.5\"");
  });
});
