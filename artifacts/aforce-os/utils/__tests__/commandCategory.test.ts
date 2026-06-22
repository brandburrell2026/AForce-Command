import { describe, it, expect } from 'vitest';

import {
  categorizeCommand,
  isCommandCategory,
  COMMAND_CATEGORIES,
} from '../intelligence/commandCategory';

describe('commandCategory', () => {
  describe('categorizeCommand', () => {
    it('critical urgency always resolves to hydration_urgent (Water-First)', () => {
      // Even a PEAK / high score is overridden by critical urgency.
      expect(
        categorizeCommand({ level: 'PEAK', score: 99, urgencyLevel: 'critical' }),
      ).toBe('hydration_urgent');
    });

    it('DEPLETED or score < 40 → hydration_urgent', () => {
      expect(categorizeCommand({ level: 'DEPLETED', score: 80 })).toBe('hydration_urgent');
      expect(categorizeCommand({ level: 'BALANCED', score: 39 })).toBe('hydration_urgent');
    });

    it('RECOVERING or score < 65 → recovery_reset', () => {
      expect(categorizeCommand({ level: 'RECOVERING', score: 90 })).toBe('recovery_reset');
      expect(categorizeCommand({ level: 'BALANCED', score: 64 })).toBe('recovery_reset');
    });

    it('PEAK and score >= 90 → performance_activation', () => {
      expect(categorizeCommand({ level: 'PEAK', score: 90 })).toBe('performance_activation');
      expect(categorizeCommand({ level: 'PEAK', score: 100 })).toBe('performance_activation');
    });

    it('PEAK but score < 90 falls through to hydration_maintain', () => {
      expect(categorizeCommand({ level: 'PEAK', score: 80 })).toBe('hydration_maintain');
    });

    it('default balanced state → hydration_maintain', () => {
      expect(categorizeCommand({ level: 'BALANCED', score: 75 })).toBe('hydration_maintain');
    });

    it('boundary: score exactly 40 is no longer urgent, 65 is no longer recovery', () => {
      expect(categorizeCommand({ level: 'BALANCED', score: 40 })).toBe('recovery_reset');
      expect(categorizeCommand({ level: 'BALANCED', score: 65 })).toBe('hydration_maintain');
    });
  });

  describe('isCommandCategory', () => {
    it('accepts every known category', () => {
      for (const c of COMMAND_CATEGORIES) {
        expect(isCommandCategory(c)).toBe(true);
      }
    });

    it('rejects unknown strings and non-strings', () => {
      expect(isCommandCategory('bogus')).toBe(false);
      expect(isCommandCategory('')).toBe(false);
      expect(isCommandCategory(undefined)).toBe(false);
      expect(isCommandCategory(null)).toBe(false);
      expect(isCommandCategory(42)).toBe(false);
    });
  });

  it('COMMAND_CATEGORIES covers the full taxonomy with no duplicates', () => {
    expect(new Set(COMMAND_CATEGORIES).size).toBe(COMMAND_CATEGORIES.length);
    expect(COMMAND_CATEGORIES).toContain('hydration_urgent');
    expect(COMMAND_CATEGORIES).toContain('hydration_maintain');
    expect(COMMAND_CATEGORIES).toContain('recovery_reset');
    expect(COMMAND_CATEGORIES).toContain('performance_activation');
    expect(COMMAND_CATEGORIES).toContain('morning_reset');
  });
});
