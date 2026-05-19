import { describe, it, expect } from 'vitest';
import {
  acidicLoadHeadline,
  acidicLoadLabel,
  computeLoadSignals,
  isAcidicCategory,
  isStimulantCategory,
  LOAD_WINDOW_HOURS,
  stimulantLoadHeadline,
  stimulantLoadLabel,
  type LoadEvent,
} from '../loadSignals';

const NOW = new Date('2026-05-19T12:00:00Z').getTime();
const HOUR = 60 * 60 * 1000;

function ev(partial: Partial<LoadEvent> & { oz: number }): LoadEvent {
  return { loggedAt: NOW - HOUR, ...partial };
}

describe('computeLoadSignals — windowing', () => {
  it('returns all-low when no events are supplied', () => {
    const r = computeLoadSignals([], NOW);
    expect(r.acidic).toEqual({ band: 'low', score: 0 });
    expect(r.stimulant).toEqual({ band: 'low', score: 0 });
  });

  it('treats undefined / non-array input safely as zero load', () => {
    expect(computeLoadSignals(undefined, NOW).acidic.band).toBe('low');
    // @ts-expect-error — runtime robustness
    expect(computeLoadSignals(null, NOW).stimulant.band).toBe('low');
  });

  it('ignores events outside the 6h rolling window', () => {
    const stale = ev({
      categoryId: 'energy_drink',
      oz: 32,
      loggedAt: NOW - (LOAD_WINDOW_HOURS + 1) * HOUR,
    });
    const r = computeLoadSignals([stale], NOW);
    expect(r.stimulant.band).toBe('low');
    expect(r.acidic.band).toBe('low');
  });

  it('ignores future-dated events', () => {
    const future = ev({ categoryId: 'coffee', oz: 24, loggedAt: NOW + HOUR });
    expect(computeLoadSignals([future], NOW).stimulant.band).toBe('low');
  });
});

describe('computeLoadSignals — banding', () => {
  it('a single 12oz coffee lands the user in moderate stimulant load', () => {
    // 12 oz × 1.0 stimulantWeight = 12 → moderate (8 < 12 ≤ 18)
    const r = computeLoadSignals([ev({ categoryId: 'coffee', oz: 12 })], NOW);
    expect(r.stimulant.band).toBe('moderate');
    expect(r.stimulant.score).toBe(12);
  });

  it('two coffees push stimulant load to elevated', () => {
    const r = computeLoadSignals(
      [
        ev({ categoryId: 'coffee', oz: 12, loggedAt: NOW - HOUR }),
        ev({ categoryId: 'coffee', oz: 12, loggedAt: NOW - 2 * HOUR }),
      ],
      NOW,
    );
    expect(r.stimulant.band).toBe('elevated');
    expect(r.stimulant.score).toBe(24);
  });

  it('a 20oz soda alone produces elevated acidic load', () => {
    // 20 × 1.0 = 20 → elevated (> 18)
    const r = computeLoadSignals([ev({ categoryId: 'soda', oz: 20 })], NOW);
    expect(r.acidic.band).toBe('elevated');
  });

  it('water-only intake stays in the low band on both axes', () => {
    const water = [
      ev({ categoryId: 'water', oz: 24 }),
      ev({ categoryId: 'bottled_water', oz: 16 }),
      ev({ categoryId: 'electrolyte', oz: 32 }),
    ];
    const r = computeLoadSignals(water, NOW);
    expect(r.acidic.band).toBe('low');
    expect(r.stimulant.band).toBe('low');
  });

  it('events with unknown / missing categoryId contribute zero', () => {
    const r = computeLoadSignals(
      [
        { oz: 100, loggedAt: NOW - HOUR },
        { categoryId: 'NOT_A_CATEGORY', oz: 100, loggedAt: NOW - HOUR },
      ],
      NOW,
    );
    expect(r.acidic.band).toBe('low');
    expect(r.stimulant.band).toBe('low');
  });

  it('rejects malformed oz / loggedAt without throwing', () => {
    const r = computeLoadSignals(
      [
        { categoryId: 'coffee', oz: Number.NaN, loggedAt: NOW - HOUR },
        { categoryId: 'coffee', oz: -50, loggedAt: NOW - HOUR },
        { categoryId: 'coffee', oz: 12, loggedAt: 'not-a-date' },
      ],
      NOW,
    );
    expect(r.stimulant.score).toBe(0);
  });
});

describe('display copy — tone guarantee', () => {
  it('elevated headlines use the exact product-mandated phrasing', () => {
    expect(acidicLoadHeadline('elevated')).toBe(
      'Acidic Load Elevated. Hydration support recommended.',
    );
    expect(stimulantLoadHeadline('elevated')).toBe(
      'Stimulant Load Elevated. Hydration support recommended.',
    );
  });

  it('moderate headlines follow the same template', () => {
    expect(acidicLoadHeadline('moderate')).toBe(
      'Acidic Load Moderate. Hydration support recommended.',
    );
    expect(stimulantLoadHeadline('moderate')).toBe(
      'Stimulant Load Moderate. Hydration support recommended.',
    );
  });

  it('low band emits no headline (no UI noise)', () => {
    expect(acidicLoadHeadline('low')).toBeNull();
    expect(stimulantLoadHeadline('low')).toBeNull();
  });

  it('NEVER frames coffee negatively — copy must not name coffee', () => {
    // Hard guarantee — every headline + label string scanned for
    // banned words. Coffee is referred to ONLY via "Stimulant Load".
    const strings = [
      acidicLoadLabel('low'), acidicLoadLabel('moderate'), acidicLoadLabel('elevated'),
      stimulantLoadLabel('low'), stimulantLoadLabel('moderate'), stimulantLoadLabel('elevated'),
      acidicLoadHeadline('moderate') ?? '', acidicLoadHeadline('elevated') ?? '',
      stimulantLoadHeadline('moderate') ?? '', stimulantLoadHeadline('elevated') ?? '',
    ];
    for (const s of strings) {
      expect(s.toLowerCase()).not.toMatch(/coffee|caffeine|bad|avoid|stop|cut down/);
    }
  });
});

describe('category classifiers', () => {
  it('classifies known stimulant categories', () => {
    expect(isStimulantCategory('coffee')).toBe(true);
    expect(isStimulantCategory('energy_drink')).toBe(true);
    expect(isStimulantCategory('pre_workout')).toBe(true);
    expect(isStimulantCategory('tea')).toBe(true);
    expect(isStimulantCategory('water')).toBe(false);
    expect(isStimulantCategory('juice')).toBe(false);
  });

  it('classifies known acidic categories', () => {
    expect(isAcidicCategory('soda')).toBe(true);
    expect(isAcidicCategory('juice')).toBe(true);
    expect(isAcidicCategory('energy_drink')).toBe(true);
    expect(isAcidicCategory('water')).toBe(false);
    expect(isAcidicCategory('electrolyte')).toBe(false);
  });
});
