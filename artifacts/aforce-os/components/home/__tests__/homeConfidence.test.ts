/**
 * Home confidence — regression locks for Wave 5 residual A (founder
 * 2026-08-12: "make confidence proportional to actual evidence quality,
 * coverage, freshness and provenance. Missing evidence must reduce confidence,
 * not create certainty").
 *
 * The defect these lock: Home's evidence gate is binary, so ONE logged drink
 * bought the same visual authority as a week of logs plus a connected wearable.
 * The three properties asserted below are the founder's three sentences,
 * mechanically:
 *   1. thin evidence must rate strictly LOWER than rich evidence;
 *   2. removing/ageing a signal may only ever LOWER the rating, never raise it;
 *   3. the result is a rating + chip, never a score (Score-Protection).
 *
 * Pure module, so this needs no harness — the chip's actual RENDER on Home is
 * locked separately (`homeConfidenceChip.render.test.tsx` for the component,
 * `homeScreenV2Wiring.test.ts` for the screen wiring).
 */
import { describe, it, expect } from 'vitest';

import {
  countEvidenceDays,
  coverageCeiling,
  resolveHomeConfidence,
  type HomeConfidenceInput,
} from '../homeConfidence';
import { BASELINE_LOOKBACK_DAYS } from '../homeBaselineState';
import { SIGNAL_QUALITY_RATINGS, type SignalQualityRating } from '@/utils/confidence/signalQuality';
import { signalQualityChip, SIGNAL_OPACITY } from '@/utils/confidence/confidenceChip';
import type { ProviderBiometrics } from '@/types';

const NOW = Date.UTC(2026, 7, 12, 12, 0, 0);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Lower index = stronger, per §54's own display ordering. */
const strength = (rating: SignalQualityRating): number => SIGNAL_QUALITY_RATINGS.indexOf(rating);

function whoopAt(fetchedAt: number): ProviderBiometrics {
  return {
    whoop: {
      providerId: 'whoop',
      sleepHoursLastNight: 7.4,
      restingHeartRate: 52,
      stepsToday: 6400,
      fetchedAt,
    },
  } as ProviderBiometrics;
}

/** The founder's first member: one logged drink, no wearable. */
const ONE_DRINK: HomeConfidenceInput = {
  intakeEvents: [{ loggedAt: new Date(NOW - 20 * 60 * 1000) }],
  history: [],
  biometrics: null,
  now: NOW,
};

/** The founder's second member: a week of intake plus a connected provider. */
const WEEK_PLUS_WEARABLE: HomeConfidenceInput = {
  intakeEvents: [{ loggedAt: new Date(NOW - 30 * 60 * 1000) }],
  history: Array.from({ length: 7 }, (_, i) => ({ timestamp: new Date(NOW - i * DAY) })),
  biometrics: whoopAt(NOW - HOUR),
  now: NOW,
};

describe('resolveHomeConfidence — thin evidence never wears rich evidence\'s authority', () => {
  it('one logged drink and no wearable rates LIMITED', () => {
    const thin = resolveHomeConfidence(ONE_DRINK);
    expect(thin.rating).toBe('limited');
    expect(thin.chip.label).toBe('LIMITED');
    expect(thin.chip.opacity).toBe(SIGNAL_OPACITY.mid);
  });

  it('a week of intake plus a fresh connected provider rates GOOD', () => {
    const rich = resolveHomeConfidence(WEEK_PLUS_WEARABLE);
    expect(rich.rating).toBe('good');
    expect(rich.chip.label).toBe('GOOD');
  });

  it('THE lock: the two members do not share a rating, a label or an opacity', () => {
    const thin = resolveHomeConfidence(ONE_DRINK);
    const rich = resolveHomeConfidence(WEEK_PLUS_WEARABLE);
    expect(strength(thin.rating)).toBeGreaterThan(strength(rich.rating)); // strictly weaker
    expect(thin.chip.label).not.toBe(rich.chip.label);
    expect(thin.chip.opacity).toBeLessThan(rich.chip.opacity);
  });

  it('the ladder between them is monotone — more days of evidence never rates lower', () => {
    let previous = Number.NEGATIVE_INFINITY;
    for (let days = 1; days <= BASELINE_LOOKBACK_DAYS; days++) {
      const result = resolveHomeConfidence({
        ...WEEK_PLUS_WEARABLE,
        history: Array.from({ length: days }, (_, i) => ({ timestamp: new Date(NOW - i * DAY) })),
      });
      const current = -strength(result.rating);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});

describe('resolveHomeConfidence — missing evidence reduces confidence, never creates certainty', () => {
  const rich = resolveHomeConfidence(WEEK_PLUS_WEARABLE);

  /**
   * Each mutation removes or degrades exactly one real-world fact. None may
   * produce a rating STRONGER than the fully-evidenced baseline — that is the
   * founder's sentence expressed as a property, not a table of expectations.
   */
  const degradations: [string, HomeConfidenceInput][] = [
    ['no wearable at all', { ...WEEK_PLUS_WEARABLE, biometrics: null }],
    ['wearable connected but never synced', { ...WEEK_PLUS_WEARABLE, biometrics: {} as ProviderBiometrics }],
    ['wearable last synced 5 days ago (past the expiry window)', {
      ...WEEK_PLUS_WEARABLE,
      biometrics: whoopAt(NOW - 5 * DAY),
    }],
    ['wearable synced 30h ago (past the stale window)', {
      ...WEEK_PLUS_WEARABLE,
      biometrics: whoopAt(NOW - 30 * HOUR),
    }],
    ['no cycle history', { ...WEEK_PLUS_WEARABLE, history: [] }],
    ['history is only the synthetic baseline placeholder', {
      ...WEEK_PLUS_WEARABLE,
      history: [{ timestamp: new Date(NOW - DAY), isSynthetic: true }],
    }],
    ['history is all older than the lookback window', {
      ...WEEK_PLUS_WEARABLE,
      history: [{ timestamp: new Date(NOW - 40 * DAY) }],
    }],
    ['no logged intake today', { ...WEEK_PLUS_WEARABLE, intakeEvents: [] }],
    ['everything missing at once', { intakeEvents: [], history: [], biometrics: null, now: NOW }],
  ];

  for (const [name, input] of degradations) {
    it(`${name} — never rates stronger than the fully-evidenced member`, () => {
      const degraded = resolveHomeConfidence(input);
      expect(strength(degraded.rating)).toBeGreaterThanOrEqual(strength(rich.rating));
      expect(degraded.chip.opacity).toBeLessThanOrEqual(rich.chip.opacity);
    });
  }

  it('a stale wearable is capped by §53 freshness, not read as a live one', () => {
    const live = resolveHomeConfidence(WEEK_PLUS_WEARABLE);
    const stale = resolveHomeConfidence({ ...WEEK_PLUS_WEARABLE, biometrics: whoopAt(NOW - 5 * DAY) });
    // Each §53 window does its own work, and they differ by design: heart rate
    // and activity age under `wearable_sync` (expired past 72h → `unavailable`),
    // while `sleep` has no expiry at all and merely goes `stale` (ceiling
    // `limited`). Every biometric slot is capped, none is read as live, and the
    // headline falls from GOOD to the self-report floor.
    expect(live.rating).toBe('good');
    expect(stale.rating).toBe('limited');
    const staleByKind = new Map(stale.signals.map((s) => [s.kind, s.rating]));
    expect(staleByKind.get('heart_rate')).toBe('unavailable');
    expect(staleByKind.get('activity')).toBe('unavailable');
    expect(staleByKind.get('sleep')).toBe('limited');
    for (const [kind, rating] of staleByKind) {
      const liveRating = live.signals.find((s) => s.kind === kind)?.rating;
      expect(strength(rating)).toBeGreaterThanOrEqual(strength(liveRating!));
    }
  });

  it('a rich wearable cannot carry a member who has barely logged — coverage is a ceiling', () => {
    const wearableOnly = resolveHomeConfidence({ ...WEEK_PLUS_WEARABLE, history: [] });
    expect(wearableOnly.coverage).toBe('sparse');
    expect(wearableOnly.rating).toBe('limited');
  });

  it('absent signals occupy their slot as `unavailable` — absence must be counted to reduce anything', () => {
    const thin = resolveHomeConfidence(ONE_DRINK);
    expect(thin.signals.map((s) => s.kind)).toEqual([
      'water_intake',
      'sleep',
      'heart_rate',
      'activity',
    ]);
    expect(thin.signals.filter((s) => s.rating === 'unavailable')).toHaveLength(3);
  });

  it('a member who has logged something is never told the evidence is UNAVAILABLE', () => {
    // The chip only renders beside a real reading; claiming "unavailable" next
    // to a number the member's own log produced would be its own small lie.
    for (const input of [ONE_DRINK, ...degradations.slice(0, 8).map(([, i]) => i)]) {
      expect(resolveHomeConfidence(input).rating).not.toBe('unavailable');
    }
  });
});

describe('countEvidenceDays — days, not entries', () => {
  it('collapses several logs on one day into one day of evidence', () => {
    expect(
      countEvidenceDays({
        intakeEvents: [
          { loggedAt: new Date(NOW - HOUR) },
          { loggedAt: new Date(NOW - 2 * HOUR) },
          { loggedAt: new Date(NOW - 3 * HOUR) },
        ],
        history: [],
        now: NOW,
      }),
    ).toBe(1);
  });

  it('accepts ISO strings and epoch numbers, which persisted state can carry', () => {
    expect(
      countEvidenceDays({
        history: [
          { timestamp: new Date(NOW - DAY).toISOString() },
          { timestamp: NOW - 2 * DAY },
        ],
        now: NOW,
      }),
    ).toBe(2);
  });

  it('ignores unparseable and absent stamps rather than counting them as a day', () => {
    expect(
      countEvidenceDays({
        history: [{ timestamp: 'not a date' }, { timestamp: null }, { timestamp: undefined }],
        now: NOW,
      }),
    ).toBe(0);
  });

  it('never reports more days than the lookback window', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ timestamp: new Date(NOW - i * HOUR * 4) }));
    expect(countEvidenceDays({ history: many, now: NOW })).toBeLessThanOrEqual(BASELINE_LOOKBACK_DAYS);
  });
});

describe('the shipped vocabulary this module composes (assumption locks)', () => {
  it('§54\'s rating list is ordered strongest → weakest, which `rank` depends on', () => {
    expect([...SIGNAL_QUALITY_RATINGS]).toEqual(['excellent', 'good', 'limited', 'unavailable']);
  });

  it('the chip ramp is strictly decreasing along that order, so a weaker rating always LOOKS quieter', () => {
    const opacities = SIGNAL_QUALITY_RATINGS.map((r) => signalQualityChip(r).opacity);
    for (let i = 1; i < opacities.length; i++) {
      expect(opacities[i]).toBeLessThan(opacities[i - 1]);
    }
  });

  it('coverage is a CEILING in the §54 vocabulary — it can lower a rating, never promote one', () => {
    expect(coverageCeiling('rich')).toBe('excellent');
    expect(coverageCeiling('partial')).toBe('good');
    // Floored at `limited`: zero evidence is the `building` state, which shows
    // no reading and therefore no chip.
    expect(coverageCeiling('sparse')).toBe('limited');
  });
});

describe('Score-Protection', () => {
  it('returns a rating, a chip and a day count — never a score, band or colour', () => {
    const result = resolveHomeConfidence(WEEK_PLUS_WEARABLE);
    expect(Object.keys(result).sort()).toEqual(
      ['chip', 'coverage', 'daysOfEvidence', 'rating', 'signals'].sort(),
    );
    expect(JSON.stringify(result)).not.toMatch(/#[0-9a-fA-F]{6}|PEAK|BALANCED|RECOVERING|DEPLETED/);
  });

  it('is pure: the same input resolves identically, and the input is not mutated', () => {
    const input = { ...WEEK_PLUS_WEARABLE };
    const frozen = JSON.stringify(input);
    expect(resolveHomeConfidence(input)).toEqual(resolveHomeConfidence(input));
    expect(JSON.stringify(input)).toBe(frozen);
  });
});
