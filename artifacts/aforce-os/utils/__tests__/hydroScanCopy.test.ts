import { describe, it, expect } from 'vitest';
import {
  WATER_POSITIVE_LINES,
  BANNED_WATER_TERMS,
  IMPACT_I18N_KEY,
  TIMING_I18N_KEY,
  isWaterCopyCompliant,
  waterPositiveLine,
} from '../impact/hydroScanCopy';

describe('hydroScanCopy · Water-First lock', () => {
  it('every positive line is compliant (no banned water terms)', () => {
    for (const line of WATER_POSITIVE_LINES) {
      expect(isWaterCopyCompliant(line)).toBe(true);
    }
  });

  it('every positive line mentions water / hydration positively', () => {
    for (const line of WATER_POSITIVE_LINES) {
      expect(line.toLowerCase()).toMatch(/water|hydration/);
    }
  });

  it('the compliance guard catches each banned term', () => {
    for (const term of BANNED_WATER_TERMS) {
      expect(isWaterCopyCompliant(`This is ${term} honestly`)).toBe(false);
    }
  });

  it('compliance guard is case-insensitive and null-safe', () => {
    expect(isWaterCopyCompliant('JUST WATER again')).toBe(false);
    expect(isWaterCopyCompliant('')).toBe(true);
    // @ts-expect-error — runtime null tolerance
    expect(isWaterCopyCompliant(null)).toBe(true);
  });
});

describe('hydroScanCopy · deterministic line picker', () => {
  it('is deterministic and always in-range', () => {
    expect(waterPositiveLine(0)).toBe(WATER_POSITIVE_LINES[0]);
    expect(waterPositiveLine(0)).toBe(waterPositiveLine(0));
    for (const seed of [-5, 0, 3, 7, 99, 1000]) {
      expect(WATER_POSITIVE_LINES).toContain(waterPositiveLine(seed));
    }
  });
});

describe('hydroScanCopy · i18n key maps', () => {
  it('maps every impact level to a hydroScan2 key', () => {
    expect(IMPACT_I18N_KEY.HIGH_SUPPORT).toMatch(/^hydroScan2\.impact\./);
    expect(IMPACT_I18N_KEY.HIGH_IMPACT).toMatch(/^hydroScan2\.impact\./);
    expect(Object.keys(IMPACT_I18N_KEY)).toHaveLength(4);
  });

  it('maps every timing level to a hydroScan2 key', () => {
    expect(TIMING_I18N_KEY.GOOD_TIMING).toMatch(/^hydroScan2\.timing\./);
    expect(Object.keys(TIMING_I18N_KEY)).toHaveLength(3);
  });
});
