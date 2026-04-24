import { describe, it, expect } from 'vitest';
import { selectQuote, buildQuoteContext, type QuoteContext } from '../quoteEngine';
import {
  ALL_QUOTES,
  COMMAND_QUOTES,
  RESULT_QUOTES,
  IDENTITY_QUOTES,
  PRODUCT_QUOTES,
  SOCIAL_QUOTES,
} from '../../data/quotes';

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

const baseCtx: QuoteContext = {
  level: 'BALANCED',
  socialModeActive: false,
  hourOfDay: 14,
  minutesSinceLastIntake: 90,
  streakDays: 0,
};

describe('quote pools — hard rules', () => {
  it('every quote is ≤ 4 words', () => {
    for (const q of ALL_QUOTES) {
      expect(
        wordCount(q.text),
        `quote > 4 words: "${q.text}" (${q.id})`,
      ).toBeLessThanOrEqual(4);
    }
  });

  it('no quote is empty or whitespace-only', () => {
    for (const q of ALL_QUOTES) {
      expect(q.text.trim().length).toBeGreaterThan(0);
    }
  });

  it('no exclamation marks anywhere', () => {
    for (const q of ALL_QUOTES) {
      expect(q.text).not.toMatch(/!/);
    }
  });

  it('no filler / motivational / generic-fitness words', () => {
    const banned =
      /\b(just|really|very|maybe|kinda|sorta|believe|crush|conquer|warrior|beast|grind|hustle|amazing|awesome|epic|literally)\b/i;
    for (const q of ALL_QUOTES) {
      expect(banned.test(q.text), `banned word in: "${q.text}"`).toBe(false);
    }
  });

  it('all quote ids are unique', () => {
    const ids = new Set<string>();
    for (const q of ALL_QUOTES) {
      expect(ids.has(q.id), `duplicate id: ${q.id}`).toBe(false);
      ids.add(q.id);
    }
  });

  it('every pool entry is tagged with the matching type', () => {
    for (const q of COMMAND_QUOTES)  expect(q.type).toBe('command');
    for (const q of RESULT_QUOTES)   expect(q.type).toBe('result');
    for (const q of IDENTITY_QUOTES) expect(q.type).toBe('identity');
    for (const q of PRODUCT_QUOTES)  expect(q.type).toBe('product');
    for (const q of SOCIAL_QUOTES)   expect(q.type).toBe('social');
  });
});

describe('selectQuote — pool routing by trigger', () => {
  it('SOCIAL pool wins when social mode is active (overrides everything)', () => {
    const q = selectQuote({ ...baseCtx, socialModeActive: true, level: 'DEPLETED', hourOfDay: 22 });
    expect(q.type).toBe('social');
    expect(q.reason).toBe('social_mode');
  });

  it('DEPLETED level → COMMAND pool (urgency)', () => {
    const q = selectQuote({ ...baseCtx, level: 'DEPLETED', hourOfDay: 14 });
    expect(q.type).toBe('command');
    expect(q.reason).toBe('depleted');
  });

  it('RECOVERING + recent intake (< 30 min) → RESULT pool', () => {
    const q = selectQuote({ ...baseCtx, level: 'RECOVERING', minutesSinceLastIntake: 5 });
    expect(q.type).toBe('result');
    expect(q.reason).toBe('recent_action_recovering');
  });

  it('RECOVERING but stale intake → does NOT fire RESULT', () => {
    const q = selectQuote({ ...baseCtx, level: 'RECOVERING', minutesSinceLastIntake: 120, hourOfDay: 14 });
    expect(q.reason).not.toBe('recent_action_recovering');
  });

  it('morning window (5–11h) → COMMAND pool', () => {
    const q = selectQuote({ ...baseCtx, hourOfDay: 7 });
    expect(q.type).toBe('command');
    expect(q.reason).toBe('morning');
  });

  it('night window (≥21h) → IDENTITY pool', () => {
    const q = selectQuote({ ...baseCtx, hourOfDay: 22 });
    expect(q.type).toBe('identity');
    expect(q.reason).toBe('night');
  });

  it('night window (< 4h) → IDENTITY pool', () => {
    const q = selectQuote({ ...baseCtx, hourOfDay: 2 });
    expect(q.reason).toBe('night');
  });

  it('PEAK + streak ≥ 3 in afternoon → IDENTITY pool', () => {
    const q = selectQuote({ ...baseCtx, level: 'PEAK', streakDays: 5, hourOfDay: 14 });
    expect(q.type).toBe('identity');
    expect(q.reason).toBe('peak_streak');
  });

  it('default afternoon, balanced → PRODUCT pool', () => {
    const q = selectQuote({ ...baseCtx, hourOfDay: 14 });
    expect(q.type).toBe('product');
    expect(q.reason).toBe('default');
  });
});

describe('selectQuote — determinism + safety', () => {
  it('same context returns the same quote (deterministic)', () => {
    const a = selectQuote(baseCtx);
    const b = selectQuote(baseCtx);
    expect(a.id).toBe(b.id);
    expect(a.text).toBe(b.text);
  });

  it('returns an in-pool quote (never undefined)', () => {
    const q = selectQuote(baseCtx);
    expect(q).toBeDefined();
    expect(q.text.length).toBeGreaterThan(0);
    const allIds = new Set(ALL_QUOTES.map(x => x.id));
    expect(allIds.has(q.id)).toBe(true);
  });

  it('never throws on garbage input', () => {
    // @ts-expect-error — simulate runtime garbage from a stale store
    expect(() => selectQuote({ level: 'NOPE', hourOfDay: NaN, streakDays: -5, minutesSinceLastIntake: 'x' })).not.toThrow();
    // Empty object is a valid Partial<QuoteContext> — must still return a quote.
    const q = selectQuote({});
    expect(q.text.length).toBeGreaterThan(0);
  });

  it('hourOfDay wraps modulo 24 (defensive)', () => {
    const a = selectQuote({ ...baseCtx, hourOfDay: 7 });
    const b = selectQuote({ ...baseCtx, hourOfDay: 31 });
    expect(a.reason).toBe(b.reason);
  });
});

describe('buildQuoteContext — store-shape adapter', () => {
  it('computes minutesSinceLastIntake from a Date', () => {
    const now = new Date('2026-04-24T14:00:00Z');
    const lastIntakeTime = new Date('2026-04-24T13:30:00Z');
    const ctx = buildQuoteContext({ level: 'BALANCED', socialModeActive: false, lastIntakeTime, streakDays: 2, now });
    expect(ctx.minutesSinceLastIntake).toBe(30);
    expect(ctx.streakDays).toBe(2);
  });

  it('null lastIntakeTime → null minutes', () => {
    const ctx = buildQuoteContext({ level: 'BALANCED', socialModeActive: false, lastIntakeTime: null, streakDays: 0 });
    expect(ctx.minutesSinceLastIntake).toBeNull();
  });

  it('invalid Date → null minutes (safe)', () => {
    const ctx = buildQuoteContext({ level: 'BALANCED', socialModeActive: false, lastIntakeTime: new Date('bad'), streakDays: 0 });
    expect(ctx.minutesSinceLastIntake).toBeNull();
  });
});
