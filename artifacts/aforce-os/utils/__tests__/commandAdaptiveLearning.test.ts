import { describe, it, expect } from 'vitest';

import {
  deriveCategoryLearning,
  categoryLearning,
  CATEGORY_LEARNING_MIN_SAMPLES,
  CATEGORY_LEARNING_WINDOW_MS,
} from '../intelligence/commandAdaptiveLearning';
import { confirmationToCommandEvent } from '../intelligence/commandEventAdapters';
import type { CommandEvent } from '../intelligence/commandEvents';

const NOW = 1_750_000_000_000; // fixed clock, comfortably > 0

function conf(opts: {
  followed: boolean;
  setAtMs: number;
  commandType?: string;
}): CommandEvent {
  const ev = confirmationToCommandEvent({
    followed: opts.followed,
    setAtMs: opts.setAtMs,
    delta: opts.followed ? 3 : -3,
    commandType: opts.commandType,
    commandId: `cmd-${opts.setAtMs}`,
  });
  if (!ev) throw new Error('fixture build failed');
  return ev;
}

/** Build `count` confirmations for a category, `followedCount` of them followed. */
function many(category: string, count: number, followedCount: number): CommandEvent[] {
  const out: CommandEvent[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(conf({ followed: i < followedCount, setAtMs: NOW - i * 1000, commandType: category }));
  }
  return out;
}

describe('deriveCategoryLearning', () => {
  it('empty ledger → empty profile', () => {
    expect(deriveCategoryLearning([], NOW)).toEqual({});
  });

  it('a category below the min sample count stays insufficient with a null rate', () => {
    const events = many('recovery_reset', CATEGORY_LEARNING_MIN_SAMPLES - 1, 9);
    const profile = deriveCategoryLearning(events, NOW);
    const learning = categoryLearning(profile, 'recovery_reset');
    expect(learning?.status).toBe('insufficient');
    expect(learning?.sampleSize).toBe(CATEGORY_LEARNING_MIN_SAMPLES - 1);
    expect(learning?.followedRate).toBeNull();
  });

  it('a category at the min sample count becomes ready with the followed rate', () => {
    // 10 total, 7 followed → ready, rate 0.7.
    const events = many('hydration_maintain', CATEGORY_LEARNING_MIN_SAMPLES, 7);
    const profile = deriveCategoryLearning(events, NOW);
    const learning = categoryLearning(profile, 'hydration_maintain');
    expect(learning?.status).toBe('ready');
    expect(learning?.sampleSize).toBe(CATEGORY_LEARNING_MIN_SAMPLES);
    expect(learning?.followed).toBe(7);
    expect(learning?.followedRate).toBeCloseTo(0.7, 10);
  });

  it('sampleSize counts NOT-followed confirmations too (total, not just followed)', () => {
    // 12 total, only 2 followed → ready (>=10), rate 2/12.
    const events = many('performance_activation', 12, 2);
    const learning = categoryLearning(deriveCategoryLearning(events, NOW), 'performance_activation');
    expect(learning?.status).toBe('ready');
    expect(learning?.sampleSize).toBe(12);
    expect(learning?.followedRate).toBeCloseTo(2 / 12, 10);
  });

  it('ignores confirmations with an unknown or missing commandType (no fabrication)', () => {
    const events = [
      ...many('bogus_category', 15, 15), // unknown → ignored
      ...many('hydration_urgent', 0, 0), // none
      conf({ followed: true, setAtMs: NOW - 5000 }), // missing commandType → ignored
    ];
    const profile = deriveCategoryLearning(events, NOW);
    expect(Object.keys(profile)).toHaveLength(0);
  });

  it('ignores non-confirmation events', () => {
    const intakeLike = {
      id: 'intake:x1',
      kind: 'intake',
      occurredAtMs: NOW - 1000,
      localDayIndex: Math.floor((NOW - 1000) / 86_400_000),
      source: 'test',
      intakeEventId: 'x1',
    } as unknown as CommandEvent;
    const profile = deriveCategoryLearning([intakeLike], NOW);
    expect(profile).toEqual({});
  });

  it('excludes confirmations outside the rolling window', () => {
    const inside = many('recovery_reset', 10, 10).map((e) => ({
      ...e,
      occurredAtMs: NOW - (CATEGORY_LEARNING_WINDOW_MS - 1000),
    }));
    const outside = many('recovery_reset', 10, 10).map((e, i) => ({
      ...e,
      id: `old-${i}`,
      occurredAtMs: NOW - (CATEGORY_LEARNING_WINDOW_MS + 1000),
    }));
    const profile = deriveCategoryLearning([...outside, ...inside] as CommandEvent[], NOW);
    const learning = categoryLearning(profile, 'recovery_reset');
    // Only the 10 in-window confirmations are counted.
    expect(learning?.sampleSize).toBe(10);
    expect(learning?.status).toBe('ready');
  });

  it('tracks multiple categories independently', () => {
    const events = [
      ...many('hydration_maintain', 10, 5), // ready, 0.5
      ...many('recovery_reset', 4, 4), // insufficient
    ];
    const profile = deriveCategoryLearning(events, NOW);
    expect(categoryLearning(profile, 'hydration_maintain')?.status).toBe('ready');
    expect(categoryLearning(profile, 'hydration_maintain')?.followedRate).toBeCloseTo(0.5, 10);
    expect(categoryLearning(profile, 'recovery_reset')?.status).toBe('insufficient');
  });

  it('returns an empty profile for a non-finite clock', () => {
    const events = many('hydration_maintain', 10, 10);
    expect(deriveCategoryLearning(events, Number.NaN)).toEqual({});
  });

  it('falls back to the default window when given a non-positive window', () => {
    const events = many('hydration_maintain', 10, 10);
    const profile = deriveCategoryLearning(events, NOW, 0);
    expect(categoryLearning(profile, 'hydration_maintain')?.status).toBe('ready');
  });

  it('categoryLearning returns null for an unseen category', () => {
    const profile = deriveCategoryLearning(many('hydration_maintain', 10, 10), NOW);
    expect(categoryLearning(profile, 'morning_reset')).toBeNull();
  });
});
