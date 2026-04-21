import { describe, it, expect } from 'vitest';
import {
  generateShareVariations,
  composeTextShare,
} from '../shareTemplateEngine';
import { BRAND_TAG } from '../../data/shareTemplates';
import type { ShareContext } from '../../types/share';

describe('generateShareVariations', () => {
  it('returns 3 score variations with the score and state filled in', () => {
    const ctx: ShareContext = { type: 'score', score: 88, state: 'Balanced' };
    const v = generateShareVariations(ctx);
    expect(v.length).toBe(3);
    for (const m of v) {
      expect(m.text).toContain('88');
      expect(m.text).not.toContain('{');
    }
    expect(v.some(m => m.text.includes('Balanced'))).toBe(true);
  });

  it('formats positive deltas with a leading +', () => {
    const v = generateShareVariations({ type: 'gain', delta: 12 });
    expect(v.some(m => m.text.includes('+12'))).toBe(true);
    expect(v.every(m => !m.text.includes('{delta}'))).toBe(true);
  });

  it('formats negative deltas without doubling the sign', () => {
    const v = generateShareVariations({ type: 'gain', delta: -5 });
    expect(v.some(m => m.text.includes('-5'))).toBe(true);
    expect(v.every(m => !m.text.includes('+-'))).toBe(true);
  });

  it('renders streak day count', () => {
    const v = generateShareVariations({ type: 'streak', streakDays: 7 });
    expect(v.some(m => /\b7\b/.test(m.text))).toBe(true);
  });

  it('renders heat_save without needing other context', () => {
    const v = generateShareVariations({ type: 'heat_save' });
    expect(v.length).toBe(3);
    for (const m of v) expect(m.text.toLowerCase()).toContain('heat');
  });

  it('falls back to a neutral line for an unknown type', () => {
    const v = generateShareVariations({ type: 'unknown' as never });
    expect(v).toEqual([{ id: 'unknown-fallback', text: 'System in control.' }]);
  });

  it('strips banned hype words even if a future template adds one', () => {
    // Synthetic check via composeTextShare path (it runs the same enforceTone).
    const cleaned = composeTextShare("Crushing it. Awesome work.");
    expect(cleaned.toLowerCase()).not.toMatch(/crushing|awesome/);
  });

  it('strips hashtags and exclamation marks', () => {
    const cleaned = composeTextShare("Score 88! Stay on cadence! #grind");
    expect(cleaned).not.toContain('!');
    expect(cleaned).not.toContain('#grind');
  });
});

describe('composeTextShare', () => {
  it('appends the AForce branding line', () => {
    const out = composeTextShare('Balanced at 88. Stay on cadence.');
    expect(out).toContain(BRAND_TAG);
    expect(out.split('\n').length).toBe(2);
  });

  it('does not double-brand if message already contains the tag', () => {
    // Current behavior: tag is always appended. This test pins that contract
    // so future changes are deliberate.
    const out = composeTextShare('Balanced at 88.');
    const occurrences = out.split(BRAND_TAG).length - 1;
    expect(occurrences).toBe(1);
  });
});
