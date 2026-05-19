import { describe, it, expect } from 'vitest';
import {
  detectPreWorkoutInIntake,
  isPreWorkoutClassCategory,
  isPreWorkoutClassName,
  PRE_WORKOUT_NOTE_RECOVERY,
  PRE_WORKOUT_NOTE_STIMULANT,
  PRE_WORKOUT_NOTE_TRAINING,
  preWorkoutSupportFor,
  preWorkoutSupportLines,
} from '../preWorkoutSupport';
import type { LoadEvent } from '../loadSignals';

const NOW = new Date('2026-05-19T12:00:00Z').getTime();
const HOUR = 60 * 60 * 1000;

describe('isPreWorkoutClassCategory', () => {
  it('recognizes the two pre-workout-class drink categories', () => {
    expect(isPreWorkoutClassCategory('pre_workout')).toBe(true);
    expect(isPreWorkoutClassCategory('energy_drink')).toBe(true);
  });

  it('does NOT pull in adjacent stimulant categories like coffee or tea', () => {
    // Coffee is loud on stimulant load (loadSignals handles that)
    // but isn't a pre-workout/pump/energy-formula product.
    expect(isPreWorkoutClassCategory('coffee')).toBe(false);
    expect(isPreWorkoutClassCategory('tea')).toBe(false);
    expect(isPreWorkoutClassCategory('soda')).toBe(false);
    expect(isPreWorkoutClassCategory('water')).toBe(false);
  });

  it('handles missing / unknown ids without throwing', () => {
    expect(isPreWorkoutClassCategory(undefined)).toBe(false);
    expect(isPreWorkoutClassCategory(null)).toBe(false);
    expect(isPreWorkoutClassCategory('')).toBe(false);
    expect(isPreWorkoutClassCategory('not_a_category')).toBe(false);
  });
});

describe('isPreWorkoutClassName — keyword sniff', () => {
  it('detects common pre-workout phrasings', () => {
    expect(isPreWorkoutClassName('Bucked Up Pre-Workout')).toBe(true);
    expect(isPreWorkoutClassName('C4 PREWORKOUT Original')).toBe(true);
    expect(isPreWorkoutClassName('Total War Pre Workout')).toBe(true);
    expect(isPreWorkoutClassName('Wrecked Pre-Train Formula')).toBe(true);
  });

  it('detects pump / stim / energy-formula blends', () => {
    expect(isPreWorkoutClassName('Pump-N-Grow Pump Blend')).toBe(true);
    expect(isPreWorkoutClassName('Mesomorph Stim Matrix')).toBe(true);
    expect(isPreWorkoutClassName('Hydroxycut Energy Formula')).toBe(true);
    expect(isPreWorkoutClassName('Ergogenic Edge')).toBe(true);
  });

  it('does NOT mislabel sports drinks / electrolytes / water', () => {
    expect(isPreWorkoutClassName('Gatorade Lemon-Lime')).toBe(false);
    expect(isPreWorkoutClassName('LMNT Citrus Salt')).toBe(false);
    expect(isPreWorkoutClassName('Liquid IV Hydration Multiplier')).toBe(false);
    expect(isPreWorkoutClassName('Smartwater 16.9 oz')).toBe(false);
    expect(isPreWorkoutClassName('Pedialyte Electrolyte Solution')).toBe(false);
  });

  it('tolerates missing / empty input', () => {
    expect(isPreWorkoutClassName(undefined)).toBe(false);
    expect(isPreWorkoutClassName(null)).toBe(false);
    expect(isPreWorkoutClassName('')).toBe(false);
    expect(isPreWorkoutClassName('   ')).toBe(false);
  });
});

function ev(partial: Partial<LoadEvent> & { categoryId?: string }): LoadEvent {
  return { oz: 16, loggedAt: NOW - HOUR, ...partial };
}

describe('detectPreWorkoutInIntake', () => {
  it('returns false for empty / missing intake', () => {
    expect(detectPreWorkoutInIntake([], NOW)).toBe(false);
    expect(detectPreWorkoutInIntake(undefined, NOW)).toBe(false);
    expect(detectPreWorkoutInIntake(null, NOW)).toBe(false);
  });

  it('fires when a pre-workout-class event is in the 6h window', () => {
    expect(detectPreWorkoutInIntake([ev({ categoryId: 'pre_workout' })], NOW)).toBe(true);
    expect(detectPreWorkoutInIntake([ev({ categoryId: 'energy_drink' })], NOW)).toBe(true);
  });

  it('ignores pre-workout events older than the rolling window', () => {
    const stale = ev({ categoryId: 'pre_workout', loggedAt: NOW - 7 * HOUR });
    expect(detectPreWorkoutInIntake([stale], NOW)).toBe(false);
  });

  it('ignores non-pre-workout categories even at high volume', () => {
    const events = [
      ev({ categoryId: 'coffee' }),
      ev({ categoryId: 'soda' }),
      ev({ categoryId: 'sports_drink' }),
      ev({ categoryId: 'tea' }),
    ];
    expect(detectPreWorkoutInIntake(events, NOW)).toBe(false);
  });

  it('survives malformed timestamps without throwing', () => {
    const bad = [
      ev({ categoryId: 'pre_workout', loggedAt: 'not-a-date' }),
      ev({ categoryId: 'pre_workout', loggedAt: Number.NaN as unknown as number }),
    ];
    expect(detectPreWorkoutInIntake(bad, NOW)).toBe(false);
  });
});

describe('display copy — supportive tone', () => {
  it('returns the three product-mandated lines in stable order', () => {
    const lines = preWorkoutSupportLines();
    expect(lines).toEqual([
      'Elevated stimulant load detected.',
      'Hydration demand may increase during training.',
      'Recovery support recommended after activity.',
    ]);
    expect(lines[0]).toBe(PRE_WORKOUT_NOTE_STIMULANT);
    expect(lines[1]).toBe(PRE_WORKOUT_NOTE_TRAINING);
    expect(lines[2]).toBe(PRE_WORKOUT_NOTE_RECOVERY);
  });

  it('NEVER attacks pre-workouts — copy is body-focused, not supplement-focused', () => {
    // Hard guarantee. Every supportive line scanned for banned words
    // that would frame the supplement as a problem.
    const banned = [
      'bad', 'dangerous', 'harmful', 'unhealthy', 'risky', 'risk',
      'avoid', 'stop', 'quit', 'cut down', 'cut back', 'too much',
      'warning', 'caution', 'overdose', 'addicted', 'addiction',
      'pre-workout', 'preworkout', 'energy drink', 'pump',
    ];
    for (const line of preWorkoutSupportLines()) {
      const lower = line.toLowerCase();
      for (const word of banned) {
        expect(lower, `"${line}" must not contain "${word}"`).not.toContain(word);
      }
    }
  });
});

describe('preWorkoutSupportFor — composite detector', () => {
  it('returns null when no signal is present', () => {
    expect(
      preWorkoutSupportFor({
        recentIntake: [ev({ categoryId: 'water' }), ev({ categoryId: 'tea' })],
        scannedText: 'Smartwater 16.9 oz',
        nowMs: NOW,
      }),
    ).toBeNull();
  });

  it('fires on a recent pre-workout intake event alone', () => {
    const lines = preWorkoutSupportFor({
      recentIntake: [ev({ categoryId: 'pre_workout' })],
      scannedText: 'Gatorade Cool Blue',
      nowMs: NOW,
    });
    expect(lines).toEqual(preWorkoutSupportLines());
  });

  it('fires on a scanned product name alone (no recent intake required)', () => {
    const lines = preWorkoutSupportFor({
      recentIntake: [],
      scannedText: 'Bucked Up Pre-Workout',
      nowMs: NOW,
    });
    expect(lines).toEqual(preWorkoutSupportLines());
  });

  it('is robust to missing fields', () => {
    expect(preWorkoutSupportFor({})).toBeNull();
    expect(preWorkoutSupportFor({ recentIntake: null, scannedText: null })).toBeNull();
  });
});
