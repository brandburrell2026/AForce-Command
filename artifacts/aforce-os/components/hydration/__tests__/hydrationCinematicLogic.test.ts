/** Hydration tab wording — real values, honest above the target. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hydrationHero, recentHydrationEvents } from '../cinematic/hydrationCinematicLogic';

const at = (h: number, m: number) => new Date(2026, 10, 18, h, m);

describe('hydration hero', () => {
  it('shows intake, the starting target, the percentage and the last log', () => {
    expect(hydrationHero(42, 96, at(18, 12), false)).toEqual({
      amount: '42',
      line: 'of 96 oz starting target · logged',
      ring: { progress: 0.4375, value: '42 oz', label: 'of 96' },
      percentLine: '44% of starting target',
      sourceLine: 'Estimated from what you logged · 6:12 PM',
    });
  });

  it('calls it a target only once the target is personal', () => {
    expect(hydrationHero(42, 96, null, true).line).toBe('of 96 oz target · logged');
    expect(hydrationHero(42, 96, null, false).percentLine).toContain('starting target');
  });

  it('above the target: the ring stops at full, the numbers do not', () => {
    const h = hydrationHero(262, 96, at(19, 0), false);
    expect(h.ring.progress).toBe(1);
    expect(h.amount).toBe('262');
    expect(h.ring.value).toBe('262 oz');
    expect(h.percentLine).toBe('273% of starting target');
  });

  it('nothing logged: zero, no invented time', () => {
    const h = hydrationHero(0, 96, null, false);
    expect(h.amount).toBe('0');
    expect(h.sourceLine).toBe('Nothing logged yet today.');
    expect(h.ring.progress).toBe(0);
  });

  it('bad inputs never produce NaN on screen', () => {
    const h = hydrationHero(Number.NaN, 0, null, false);
    expect(h.amount).toBe('0');
    expect(h.percentLine).toBe('0% of starting target');
  });
});

describe('the hero is presentation only', () => {
  const view = readFileSync(join(__dirname, '..', 'cinematic', 'HydrationHero.tsx'), 'utf8');
  it('reads no store, logs nothing, uses no red and no sample copy', () => {
    expect(view).not.toMatch(/useAppStore|logIntake|calculateScore/);
    expect(view).not.toMatch(/af\.red(Text)?\b/);
    expect(view).not.toMatch(/Watermelon|Julius|Sample data/);
  });
  it('the primary action is warm white with black text', () => {
    expect(view).toContain('backgroundColor: af.primaryFill');
    expect(view).toContain('color: af.onPrimaryFill');
  });
});

describe('recent hydration entries', () => {
  it('keeps a newly appended offline entry visible ahead of older entries without mutating history', () => {
    const history = Object.freeze([
      { id: 'morning', loggedAt: at(8, 0) },
      { id: 'afternoon', loggedAt: at(16, 29) },
      { id: 'early', loggedAt: at(7, 0) },
      { id: 'evening', loggedAt: at(17, 12) },
      { id: 'midday', loggedAt: at(12, 0) },
      { id: 'queued-water', loggedAt: at(19, 18) },
    ]);
    const order = history.map(e => e.id);
    expect(recentHydrationEvents(history).map(e => e.id)).toEqual(['queued-water', 'evening', 'afternoon', 'midday']);
    expect(history.map(e => e.id)).toEqual(order);
    expect(recentHydrationEvents([])).toEqual([]);
  });
});
