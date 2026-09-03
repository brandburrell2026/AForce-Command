/**
 * THE EFFECTIVE HYDROSTATE WINDOW — three windows, never collapsed.
 *
 * `/journal/rollups` returns only the days it has data for: a calendar day with
 * neither a snapshot nor an intake produces NO ROW. The recap read
 * `rollups.length` as the reporting window, and the two questions —
 *
 *     how many days did the SERVER MATERIALISE a row for?
 *     how many days does the reporting window COVER?
 *
 * — are different. A day the member skipped entirely vanished from the array,
 * taking its own absence with it, so the streak walked across the hole and
 * published a BROKEN streak for a day HydroState never observed.
 *
 * Densifying the shared route was tried and REVERTED: six live consumers read
 * `rollups.length` as an observation count, so it painted unobserved days as
 * Signal-Red DEPLETED bars and counted them as compliance failures. Densifying
 * now happens at the Journal share/recap seam ONLY (founder ruling, Option B).
 */
import { describe, it, expect } from 'vitest';
import {
  effectiveRangeKeys, dayKey, densifyRollups, emptyDay,
} from '../scoring/journalDenseRange';
import {
  HYDROSTATE_HISTORY_EPOCH, canonicalHistoryStart,
  hydroStateHistoryEpochDate, parseHistoryStartAt,
} from '@/config/hydroStateHistoryEpoch';
import type { JournalRollup } from '@/types';

/** A fixed "now" — the arithmetic must not depend on when the suite runs. */
const NOW = new Date('2026-09-02T14:30:00.000Z');
const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('HYDROSTATE_HISTORY_EPOCH', () => {
  it('is the ruled date — the day the product could first persist an observation', () => {
    // Commit 5da34b41 (2026-04-29) shipped the snapshot table, the write route
    // and the client writer together. Before it, no HydroState observation
    // could exist in any form.
    expect(HYDROSTATE_HISTORY_EPOCH).toBe('2026-04-29');
    expect(dayKey(hydroStateHistoryEpochDate())).toBe('2026-04-29');
  });

  it('an UNSTAMPED member falls back to the epoch — never to now()', () => {
    // The trap: this repo has no migration files, so a NOT NULL DEFAULT now()
    // column would stamp the push date on every pre-existing row and fabricate
    // tenure for the entire existing member base.
    expect(canonicalHistoryStart(null)).toEqual(hydroStateHistoryEpochDate());
    expect(canonicalHistoryStart(undefined)).toEqual(hydroStateHistoryEpochDate());
  });

  it('a STAMPED member uses their own start; an impossible stamp cannot win', () => {
    expect(canonicalHistoryStart(at('2026-08-22'))).toEqual(at('2026-08-22'));
    // Clock skew or a hand-edited row. The epoch is a floor for everyone.
    expect(canonicalHistoryStart(at('2020-01-01'))).toEqual(hydroStateHistoryEpochDate());
  });

  it('the wire value parses, and malformed input degrades to "not recorded"', () => {
    expect(parseHistoryStartAt('2026-08-22T10:00:00.000Z')).toEqual(
      new Date('2026-08-22T10:00:00.000Z'));
    expect(parseHistoryStartAt(null)).toBeNull();
    expect(parseHistoryStartAt(undefined)).toBeNull();
    // NOT a throw and NOT an Invalid Date leaking into the arithmetic.
    expect(parseHistoryStartAt('garbage')).toBeNull();
  });
});

describe('effective window — requested vs eligible vs observed', () => {
  it('a 30+ day member gets the full requested denominator of 30', () => {
    const keys = effectiveRangeKeys({ now: NOW, days: 30, historyStartAt: at('2026-06-01') });
    expect(keys.length).toBe(30);
    expect(keys[0]).toBe('2026-08-04');
    expect(keys[keys.length - 1]).toBe('2026-09-02');
  });

  it('a STAMPED 12-day-old member in a 30-day window gets a denominator of 12', () => {
    // THE FOUNDER-REQUIRED CASE. Not 30 days with 18 fabricated gaps: a member
    // is never charged for days before AForce could have observed them.
    const keys = effectiveRangeKeys({ now: NOW, days: 30, historyStartAt: at('2026-08-22') });
    expect(keys.length).toBe(12);
    expect(keys[0]).toBe('2026-08-22');
  });

  it('an UNSTAMPED legacy member keeps the full requested range', () => {
    // Founder ruling: the epoch is a conservative floor, not a tenure claim. It
    // predates every shipped range, so it does not narrow the window — and the
    // UI must not read this denominator as a personal tenure.
    const keys = effectiveRangeKeys({ now: NOW, days: 30, historyStartAt: null });
    expect(keys.length).toBe(30);
    expect(keys[0]).toBe('2026-08-04');
  });

  it('the window is CONTIGUOUS, ascending, and exactly the requested length', () => {
    for (const days of [1, 7, 30, 90]) {
      const keys = effectiveRangeKeys({ now: NOW, days, historyStartAt: null });
      expect(keys.length, `${days}-day window`).toBe(days);
      for (let i = 1; i < keys.length; i++) {
        const prev = new Date(`${keys[i - 1]}T00:00:00.000Z`).getTime();
        const cur = new Date(`${keys[i]}T00:00:00.000Z`).getTime();
        expect(cur - prev, `${days}: consecutive`).toBe(86_400_000);
      }
      expect(new Set(keys).size, `${days}: no duplicates`).toBe(keys.length);
      expect(keys[keys.length - 1], `${days}: ends today`).toBe('2026-09-02');
    }
  });

  it('the eligible floor NARROWS and never widens', () => {
    for (const stamp of ['2026-04-01', '2026-04-29', '2026-08-04', '2026-08-25', '2026-09-02']) {
      const keys = effectiveRangeKeys({ now: NOW, days: 30, historyStartAt: at(stamp) });
      expect(keys.length, `stamp ${stamp}`).toBeLessThanOrEqual(30);
      expect(keys[0], `stamp ${stamp}`).toBe(stamp > '2026-08-04' ? stamp : '2026-08-04');
    }
  });

  it('a member seeded TODAY gets one day; a start in the FUTURE gets none', () => {
    expect(effectiveRangeKeys({ now: NOW, days: 30, historyStartAt: NOW })).toEqual(['2026-09-02']);
    // Clock skew on a just-seeded row. An empty window is honest; a day that
    // has not happened is not.
    expect(effectiveRangeKeys({ now: NOW, days: 30, historyStartAt: at('2026-09-20') })).toEqual([]);
  });

  it('the stamp is a DATE, not a day count — midnight and 23:59 are one day', () => {
    const midnight = effectiveRangeKeys({ now: NOW, days: 30, historyStartAt: at('2026-08-30') });
    const evening = effectiveRangeKeys({
      now: NOW, days: 30, historyStartAt: new Date('2026-08-30T23:59:59.999Z') });
    expect(evening).toEqual(midnight);
    expect(midnight.length).toBe(4);
  });

  it('UTC day boundaries throughout, and month/year rollover is exact', () => {
    expect(dayKey(new Date('2026-09-02T00:00:00.000Z'))).toBe('2026-09-02');
    expect(dayKey(new Date('2026-09-02T23:59:59.999Z'))).toBe('2026-09-02');
    const keys = effectiveRangeKeys({
      now: new Date('2027-01-03T10:00:00.000Z'), days: 10, historyStartAt: at('2026-06-01') });
    expect(keys).toEqual([
      '2026-12-25', '2026-12-26', '2026-12-27', '2026-12-28', '2026-12-29',
      '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
    ]);
  });
});

describe('densifyRollups — the array IS the window', () => {
  const measured = (date: string, score: number): JournalRollup => ({
    ...emptyDay(date), snapshotsCount: 4, avgScore: score, minScore: score,
    maxScore: score, intakeCount: 3, modelVersions: ['hydrostate-v1.0'],
  });

  it('a synthetic gap day fabricates NOTHING', () => {
    const d = emptyDay('2026-08-15');
    expect(d.snapshotsCount).toBe(0);
    expect(d.intakeCount).toBe(0);
    expect(d.modelVersions).toEqual([]);
    expect(d.endOzConsumed).toBe(0);
    expect(d.pctTimePeak + d.pctTimeBalanced + d.pctTimeRecovering + d.pctTimeDepleted).toBe(0);
    // `snapshotsCount: 0` is what makes the score fields readable as a
    // sentinel. A consumer reading avgScore WITHOUT it reads 0 as data — that
    // is the defect, and it is why this must never be non-zero.
    expect(d.avgScore).toBe(0);
  });

  it('the six wire states stay distinguishable after densification', () => {
    const states = {
      noRow: emptyDay('2026-08-01'),
      intakeNoSnapshot: { ...emptyDay('2026-08-02'), intakeCount: 3, endOzConsumed: 36 },
      measured: measured('2026-08-03', 90),
      measuredZero: measured('2026-08-04', 0),
      provenanceUnknown: { ...measured('2026-08-05', 90), modelVersions: [] },
      provenanceIncompatible: {
        ...measured('2026-08-06', 90),
        modelVersions: ['hydrostate-v0', 'hydrostate-v1.0'],
      },
    };
    const sig = (r: JournalRollup) =>
      `${r.snapshotsCount > 0}|${r.intakeCount > 0}|${r.avgScore}|${(r.modelVersions ?? []).join(',')}`;
    expect(new Set(Object.values(states).map(sig)).size, 'six states, six signatures').toBe(6);
    // Specifically: absence and a measured zero are NOT the same row.
    expect(sig(states.noRow)).not.toBe(sig(states.measuredZero));
  });

  it('fills every missing day and drops everything outside the window', () => {
    const keys = ['2026-08-02', '2026-08-03', '2026-08-04'];
    const out = densifyRollups(
      [measured('2026-08-01', 88), measured('2026-08-03', 90), measured('2026-08-09', 91)],
      keys,
    );
    expect(out.map((r) => r.date)).toEqual(keys);
    expect(out[0]!.snapshotsCount, 'filled').toBe(0);
    expect(out[1]!.avgScore, 'measured survives').toBe(90);
    expect(out[2]!.snapshotsCount, 'filled').toBe(0);
  });

  it('the output is exactly the window — never longer, never shorter', () => {
    for (const days of [1, 7, 30, 90]) {
      const keys = effectiveRangeKeys({ now: NOW, days, historyStartAt: null });
      expect(densifyRollups([], keys).length, `${days}-day window`).toBe(days);
    }
    expect(densifyRollups([], [])).toEqual([]);
  });
});
