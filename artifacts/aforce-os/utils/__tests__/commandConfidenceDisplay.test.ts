import { describe, it, expect } from 'vitest';
import {
  CONFIDENCE_LABEL_KEYS,
  CONFIDENCE_OPACITY,
} from '../commandConfidenceDisplay';
import type { CommandConfidenceLevel } from '../../types';

const LEVELS: CommandConfidenceLevel[] = ['high', 'medium', 'low'];

describe('Section 58 — Command Confidence display mapping', () => {
  it('has a coach.* label key for every confidence level', () => {
    for (const level of LEVELS) {
      expect(CONFIDENCE_LABEL_KEYS[level]).toMatch(/^coach\.confidence_/);
    }
    expect(Object.keys(CONFIDENCE_LABEL_KEYS).sort()).toEqual([...LEVELS].sort());
  });

  it('ramps opacity monotonically (high >= medium >= low), always within (0, 1]', () => {
    expect(CONFIDENCE_OPACITY.high).toBeGreaterThanOrEqual(CONFIDENCE_OPACITY.medium);
    expect(CONFIDENCE_OPACITY.medium).toBeGreaterThanOrEqual(CONFIDENCE_OPACITY.low);
    for (const level of LEVELS) {
      expect(CONFIDENCE_OPACITY[level]).toBeGreaterThan(0);
      expect(CONFIDENCE_OPACITY[level]).toBeLessThanOrEqual(1);
    }
  });

  it('never fabricates confidence — low stays visibly dimmer than high', () => {
    // Guards the no-fabrication intent: a "building" (low) state must never
    // render as strong as a fully-backed (high) one.
    expect(CONFIDENCE_OPACITY.low).toBeLessThan(CONFIDENCE_OPACITY.high);
  });
});
