/**
 * RC-2 sleep-window ruling (founder-ruled 2026-08-08) — `clusterSleepIntervalsIntoSessions`
 * and `chooseSleepSession` in isolation, mirroring
 * `appleHealth.sleepAggregation.test.ts`'s convention of testing
 * HealthKit-adjacent pure logic without mocking the native module or going
 * through `fetchAppleHealthSnapshot`.
 *
 * Background: a founder reading at 18:45 with a real night spanning
 * ~23:30–06:15 (5.6h asleep, with gaps) measured 4.696h from the OLD fixed
 * 18h-lookback query — HealthKit's date filter is overlap-matching and
 * returns a matching sample WHOLE, never truncated, so a stage segment
 * ending before the `[now-18h, now]` boundary was dropped outright, not
 * clipped. Widening the lookback to 36h (§53's own `staleAfterMs`) fixes
 * that, but is not sufficient by itself once the window can span more than
 * one calendar night — hence session clustering, tested here. See
 * `appleHealth.sleepWindow.test.ts` for the full end-to-end acceptance
 * fixture reproducing the founder's own reading through
 * `fetchAppleHealthSnapshot`, and `config/hydroStateModel.ts`'s own doc
 * comments on `SLEEP_SESSION_SPLIT_GAP_MS` / `SLEEP_PRIMARY_SESSION_MIN_MS`
 * for the two threshold constants exercised below.
 */
import { describe, it, expect } from 'vitest';

import {
  clusterSleepIntervalsIntoSessions,
  chooseSleepSession,
  reduceSleepByIntervalUnionDetailed,
  type SleepInterval,
} from '../appleHealth';
import { SLEEP_SESSION_SPLIT_GAP_MS, SLEEP_PRIMARY_SESSION_MIN_MS } from '../../config/hydroStateModel';

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

/** A minimal already-selected stage interval — value/sourceName are irrelevant to clustering, only startMs/endMs matter. */
function iv(startMs: number, endMs: number, sourceName = "Test Watch"): SleepInterval {
  return { startMs, endMs, value: 4, sourceName };
}

const T0 = new Date('2026-08-06T00:00:00.000Z').getTime();

describe('clusterSleepIntervalsIntoSessions — pure clustering (RC-2 sleep-window ruling)', () => {
  it('empty input returns an empty array, never throws', () => {
    expect(clusterSleepIntervalsIntoSessions([], SLEEP_SESSION_SPLIT_GAP_MS)).toEqual([]);
  });

  it('a single interval becomes a single session whose fields match reduceSleepByIntervalUnionDetailed', () => {
    const one = iv(T0, T0 + 2 * HOUR);
    const sessions = clusterSleepIntervalsIntoSessions([one], SLEEP_SESSION_SPLIT_GAP_MS);
    expect(sessions).toHaveLength(1);
    const expected = reduceSleepByIntervalUnionDetailed([one]);
    expect(sessions[0].startMs).toBe(T0);
    expect(sessions[0].endMs).toBe(expected.lastEndMs);
    expect(sessions[0].durationMs).toBe(expected.totalMs);
    expect(sessions[0].intervals).toEqual([one]);
  });

  it('two intervals with a gap SHORTER than the split threshold merge into ONE session', () => {
    const a = iv(T0, T0 + 2 * HOUR);
    const b = iv(T0 + 2 * HOUR + (SLEEP_SESSION_SPLIT_GAP_MS - MIN), T0 + 4 * HOUR);
    const sessions = clusterSleepIntervalsIntoSessions([a, b], SLEEP_SESSION_SPLIT_GAP_MS);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].intervals).toEqual([a, b]);
  });

  it('two intervals with a gap LONGER than the split threshold split into TWO sessions', () => {
    const a = iv(T0, T0 + 2 * HOUR);
    const b = iv(T0 + 2 * HOUR + SLEEP_SESSION_SPLIT_GAP_MS + MIN, T0 + 4 * HOUR);
    const sessions = clusterSleepIntervalsIntoSessions([a, b], SLEEP_SESSION_SPLIT_GAP_MS);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].intervals).toEqual([a]);
    expect(sessions[1].intervals).toEqual([b]);
  });

  it('SPLIT BOUNDARY: a gap of EXACTLY the split threshold SPLITS (>= splits, per this ruling\'s design)', () => {
    const a = iv(T0, T0 + 2 * HOUR);
    const b = iv(T0 + 2 * HOUR + SLEEP_SESSION_SPLIT_GAP_MS, T0 + 4 * HOUR);
    const sessions = clusterSleepIntervalsIntoSessions([a, b], SLEEP_SESSION_SPLIT_GAP_MS);
    expect(sessions).toHaveLength(2);
  });

  it('SPLIT BOUNDARY: a gap of exactly (threshold - 1ms) MERGES (< merges, the other side of the same boundary)', () => {
    const a = iv(T0, T0 + 2 * HOUR);
    const b = iv(T0 + 2 * HOUR + SLEEP_SESSION_SPLIT_GAP_MS - 1, T0 + 4 * HOUR);
    const sessions = clusterSleepIntervalsIntoSessions([a, b], SLEEP_SESSION_SPLIT_GAP_MS);
    expect(sessions).toHaveLength(1);
  });

  it('sessions are returned in ascending start-time order regardless of input order', () => {
    const early = iv(T0, T0 + 1 * HOUR);
    const late = iv(T0 + 10 * HOUR, T0 + 12 * HOUR); // gap ≥ split threshold from `early`
    const sessions = clusterSleepIntervalsIntoSessions([late, early], SLEEP_SESSION_SPLIT_GAP_MS);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].startMs).toBe(early.startMs);
    expect(sessions[1].startMs).toBe(late.startMs);
  });

  it('a session spanning multiple overlapping/adjacent intervals reports the UNION duration, not a flat sum', () => {
    // Two overlapping intervals within one session — same guard
    // `reduceSleepByIntervalUnionDetailed` already provides; clustering must
    // not double-count them.
    const a = iv(T0, T0 + 2 * HOUR);
    const b = iv(T0 + 1 * HOUR, T0 + 3 * HOUR); // overlaps `a` by 1h
    const sessions = clusterSleepIntervalsIntoSessions([a, b], SLEEP_SESSION_SPLIT_GAP_MS);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].durationMs).toBe(3 * HOUR); // union, not 2h+2h=4h
  });

  it('three sessions separated by qualifying gaps all survive independently, oldest first', () => {
    const s1 = iv(T0, T0 + 1 * HOUR);
    const s2 = iv(T0 + 1 * HOUR + SLEEP_SESSION_SPLIT_GAP_MS + MIN, T0 + 3 * HOUR + SLEEP_SESSION_SPLIT_GAP_MS + MIN);
    const s3Start = s2.endMs + SLEEP_SESSION_SPLIT_GAP_MS + MIN;
    const s3 = iv(s3Start, s3Start + 5 * HOUR);
    const sessions = clusterSleepIntervalsIntoSessions([s2, s1, s3], SLEEP_SESSION_SPLIT_GAP_MS);
    expect(sessions).toHaveLength(3);
    expect(sessions.map((s) => s.startMs)).toEqual([s1.startMs, s2.startMs, s3.startMs]);
  });
});

describe('chooseSleepSession — the primary-sleep rule (RC-2 sleep-window ruling)', () => {
  it('no sessions → { rule: "none", session: null }, never throws', () => {
    expect(chooseSleepSession([], SLEEP_PRIMARY_SESSION_MIN_MS)).toEqual({ rule: 'none', session: null });
  });

  it('a single session at/above the primary minimum is chosen under "most-recent-primary"', () => {
    const night = clusterSleepIntervalsIntoSessions([iv(T0, T0 + 5 * HOUR)], SLEEP_SESSION_SPLIT_GAP_MS);
    const choice = chooseSleepSession(night, SLEEP_PRIMARY_SESSION_MIN_MS);
    expect(choice.rule).toBe('most-recent-primary');
    expect(choice.session).toBe(night[0]);
  });

  it('PRIMARY-MIN BOUNDARY: a session duration of EXACTLY the primary minimum qualifies (>= inclusive)', () => {
    const exact = clusterSleepIntervalsIntoSessions(
      [iv(T0, T0 + SLEEP_PRIMARY_SESSION_MIN_MS)],
      SLEEP_SESSION_SPLIT_GAP_MS,
    );
    const choice = chooseSleepSession(exact, SLEEP_PRIMARY_SESSION_MIN_MS);
    expect(choice.rule).toBe('most-recent-primary');
  });

  it('a single session BELOW the primary minimum falls back to "longest-fallback" — itself, being the only session', () => {
    const nap = clusterSleepIntervalsIntoSessions(
      [iv(T0, T0 + (SLEEP_PRIMARY_SESSION_MIN_MS - MIN))],
      SLEEP_SESSION_SPLIT_GAP_MS,
    );
    const choice = chooseSleepSession(nap, SLEEP_PRIMARY_SESSION_MIN_MS);
    expect(choice.rule).toBe('longest-fallback');
    expect(choice.session).toBe(nap[0]);
  });

  it('night + short nap (below primary min, its own session): the NIGHT is chosen via longest-fallback, not the more-recent nap', () => {
    const night = iv(T0, T0 + 6 * HOUR);
    const napStart = night.endMs + SLEEP_SESSION_SPLIT_GAP_MS + MIN; // gap ≥ split threshold — its own session
    const nap = iv(napStart, napStart + 30 * MIN);
    const sessions = clusterSleepIntervalsIntoSessions([night, nap], SLEEP_SESSION_SPLIT_GAP_MS);
    expect(sessions).toHaveLength(2);

    const choice = chooseSleepSession(sessions, SLEEP_PRIMARY_SESSION_MIN_MS);
    expect(choice.rule).toBe('longest-fallback'); // most-recent (the nap) failed the primary check
    expect(choice.session?.intervals).toEqual([night]);
  });

  it('night + LONG nap (at/above primary min, most recent): the NAP is chosen under "most-recent-primary" — deliberate consequence of this ruling', () => {
    const night = iv(T0, T0 + 8 * HOUR); // longer than the nap
    const napStart = night.endMs + SLEEP_SESSION_SPLIT_GAP_MS + MIN;
    const nap = iv(napStart, napStart + SLEEP_PRIMARY_SESSION_MIN_MS + 30 * MIN); // at/above the primary min
    const sessions = clusterSleepIntervalsIntoSessions([night, nap], SLEEP_SESSION_SPLIT_GAP_MS);
    expect(sessions).toHaveLength(2);

    const choice = chooseSleepSession(sessions, SLEEP_PRIMARY_SESSION_MIN_MS);
    expect(choice.rule).toBe('most-recent-primary');
    expect(choice.session?.intervals).toEqual([nap]); // the shorter, more recent nap wins outright
    expect((choice.session?.durationMs ?? 0)).toBeLessThan(night.endMs - night.startMs);
  });

  it('shift worker: two ~4h sessions ~8h apart, both at/above the primary min — the MOST RECENT is chosen', () => {
    const first = iv(T0, T0 + 4 * HOUR);
    const secondStart = first.endMs + 8 * HOUR;
    const second = iv(secondStart, secondStart + 4 * HOUR);
    const sessions = clusterSleepIntervalsIntoSessions([first, second], SLEEP_SESSION_SPLIT_GAP_MS);
    expect(sessions).toHaveLength(2);

    const choice = chooseSleepSession(sessions, SLEEP_PRIMARY_SESSION_MIN_MS);
    expect(choice.rule).toBe('most-recent-primary');
    expect(choice.session?.intervals).toEqual([second]);
  });

  it('fragmented night: no session anywhere in the window reaches the primary minimum — "longest-fallback" picks the longest, not the most recent', () => {
    const first = iv(T0, T0 + 40 * MIN); // 40min, below 3h min
    const secondStart = first.endMs + SLEEP_SESSION_SPLIT_GAP_MS + MIN;
    const second = iv(secondStart, secondStart + 90 * MIN); // 90min, below 3h min, but LONGER than `first`
    const thirdStart = second.endMs + SLEEP_SESSION_SPLIT_GAP_MS + MIN;
    const third = iv(thirdStart, thirdStart + 20 * MIN); // 20min, MOST RECENT but shortest
    const sessions = clusterSleepIntervalsIntoSessions([first, second, third], SLEEP_SESSION_SPLIT_GAP_MS);
    expect(sessions).toHaveLength(3);

    const choice = chooseSleepSession(sessions, SLEEP_PRIMARY_SESSION_MIN_MS);
    expect(choice.rule).toBe('longest-fallback');
    expect(choice.session?.intervals).toEqual([second]); // the 90-minute session, not the most-recent 20-minute one
  });
});
