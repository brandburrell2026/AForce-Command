/**
 * `fetchJournalRollups` — the client REQUESTS the dense capability.
 *
 * WHY THIS FILE EXISTS. The founder's rollout ruling makes dense rollups
 * opt-in: the server keeps returning the legacy sparse array unless the caller
 * asks for `dense=1`. That turns the request itself into load-bearing
 * behavior, and it fails in the worst possible way — SILENTLY. Drop the
 * parameter and nothing throws, nothing 400s, no test of the server changes;
 * the client simply receives sparse rows while every consumer on the screen
 * now assumes one row per calendar day. Consistency collapses, unobserved days
 * vanish from the timeline instead of being withheld, and the coverage
 * denominator quietly starts counting a different population.
 *
 * A source scan for the string `dense=1` would "prove" this, and would keep
 * passing if the URL were assembled somewhere else, or if a second overload
 * shadowed this one. So this executes the REAL exported function against a
 * stubbed `fetch` and reads the URL that actually went out — the same harness
 * `realApi.intake.test.ts` uses for the intake wire contract.
 *
 * The heavy `vi.mock` preamble is copied from that file and is load-bearing
 * for the same reason: `data/products` and the scoring engine pull React
 * Native asset `require()`s and `expo-localization` through the import graph,
 * which are unparseable under node/vitest. Only the RN-only edges are stubbed;
 * `fetchJournalRollups` itself is the real implementation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../data/products', () => ({
  PRODUCTS: {
    water: { fluidType: 'water', ozPerServing: 12 },
    aforce_stick: { fluidType: 'aforce_stick', ozPerServing: 12, flavor: 'watermelon' },
  },
}));

vi.mock('../../data/mockData', () => ({
  defaultUserState: {
    unitsConsumedToday: 0, ozConsumedToday: 0, aforceUnitsToday: 0,
    lastIntakeTime: new Date(), lastIntakeType: 'water',
    symptomState: 'none', symptoms: [], urineSignal: 3, energyState: 'steady',
    heatLoad: 4, sweatRate: 3, activityLevel: 5, complianceStreak: 0,
    dailyTarget: 8, ozTarget: 96, isSnoozed: false, snoozeUntil: null,
    bodyWeightLbs: 180, isAwake: true, wakeTime: null, overnightLossOz: 0,
    hasSeenMorningCommand: false, weatherTempC: null, weatherHumidity: null,
    weatherCity: null, weatherFetchedAt: null, language: 'en',
    intakeEvents: [],
  },
}));

vi.mock('../../utils/scoringEngine', () => ({
  calculateScore: vi.fn(() => ({
    score: 50,
    performanceState: { level: 'BALANCED', label: 'Balanced', score: 50 },
    riskTimer: { minutes: 30, seconds: 0, urgency: 'moderate' },
    contributions: [], reasons: [], command: null, decayPerMinute: 0.5,
    minutesSinceLastIntake: 0, prediction: null, recoverySignal: null,
    pulseConfig: {
      stateName: 'balanced', primary: '#fff', secondary: '#fff',
      waveBehavior: 'breathing', colorMode: 'static', durationMs: 4000,
    },
  })),
}));

vi.mock('../authToken', () => ({
  getAuthHeaders: async () => ({}),
  getAuthToken: async () => null,
}));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fetchJournalRollups } from '../realApi';

let captured: string[];
let realFetch: typeof globalThis.fetch;

/** The one row the stubbed server returns, shaped like the real wire. */
const WIRE_ROW = {
  date: '2026-09-02', avgScore: 80, minScore: 70, maxScore: 90, snapshotsCount: 4,
  endOzConsumed: 60, endAforceUnits: 2, endUnitsConsumed: 5,
  endSodiumDelivered: 900, endSodiumLost: 400, endDeficitPct: 12,
  pctTimePeak: 0, pctTimeBalanced: 100, pctTimeRecovering: 0, pctTimeDepleted: 0,
  intakeCount: 3, autopilotSessions: 0, socialSessions: 0,
  modelVersions: ['hydrostate-v1.0'],
};

beforeEach(() => {
  captured = [];
  realFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    captured.push(url.toString());
    return new Response(
      JSON.stringify({ rollups: [WIRE_ROW], days: 7, historyStartAt: null, dense: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.clearAllMocks();
});

/** The query string of the one request that went out. */
function query(): URLSearchParams {
  expect(captured, 'exactly one request must have been made').toHaveLength(1);
  return new URL(captured[0]!, 'http://placeholder.invalid').searchParams;
}

/**
 * THE DETECTOR, extracted so it can be run against a string that is NOT the
 * real request. A law that only ever sees passing input cannot show that it
 * would notice failing input; the mutation-verify below feeds this the exact
 * URL `origin/main` emits and requires it to throw.
 */
function assertDenseRequested(url: string): void {
  const params = new URL(url, 'http://placeholder.invalid').searchParams;
  expect(params.get('dense')).toBe('1');
}

describe('fetchJournalRollups asks for the dense capability explicitly', () => {
  it('THE CAPABILITY IS ON THE WIRE: the request carries dense=1', async () => {
    await fetchJournalRollups(7);
    assertDenseRequested(captured[0]!);
    expect(query().get('dense')).toBe('1');
  });

  it('mutation-verify: the pre-ruling request is detected as NOT dense', () => {
    // Exactly what `origin/main`'s `fetchJournalRollups` emits. Run through
    // the SAME detector the law above uses, so the two cannot drift — the
    // failure mode this program has hit before is a mutation-verify that
    // asserts on a hand-built string with its own weaker copy of the check.
    expect(() => assertDenseRequested('/journal/rollups?days=7')).toThrow();
    // ...and the near-misses a careless edit would produce.
    expect(() => assertDenseRequested('/journal/rollups?days=7&dense=0')).toThrow();
    expect(() => assertDenseRequested('/journal/rollups?days=7&dense=true')).toThrow();
    expect(() => assertDenseRequested('/journal/rollups?days=7&densely=1')).toThrow();
  });

  it('and still carries the requested window', async () => {
    // ANTI-VACUITY: adding the capability must not have displaced `days`.
    await fetchJournalRollups(30);
    expect(query().get('days')).toBe('30');
    expect(query().get('dense')).toBe('1');
  });

  it('every window length asks for dense — it is not conditional on the range', async () => {
    for (const n of [1, 7, 14, 30, 90]) {
      captured = [];
      await fetchJournalRollups(n);
      expect(query().get('dense'), `days=${n}`).toBe('1');
      expect(query().get('days'), `days=${n}`).toBe(String(n));
    }
  });

  it('hits the rollups route, not a neighbouring one', async () => {
    await fetchJournalRollups(7);
    expect(new URL(captured[0]!, 'http://placeholder.invalid').pathname).toMatch(/\/journal\/rollups$/);
  });

  it('the capability is a REQUEST parameter, never a header or a body', async () => {
    // The ruling forbids inferring capability from user agent, version
    // strings, or deployment timing — and equally forbids smuggling it
    // somewhere a proxy or cache would not see it. A GET query param is the
    // explicit, cacheable, greppable contract.
    await fetchJournalRollups(7);
    const init = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit?][] } })
      .mock.calls[0]![1];
    expect(init?.body, 'a GET must not carry a body').toBeUndefined();
    expect(JSON.stringify(init?.headers ?? {})).not.toMatch(/dense/i);
  });

  it('returns the rows the server sent, unchanged', async () => {
    // The capability changes what is REQUESTED, not how the response is read.
    await expect(fetchJournalRollups(7)).resolves.toEqual([WIRE_ROW]);
  });

  it('a response with no rollups key yields an empty array rather than throwing', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ days: 7, dense: true }), { status: 200 }),
    ) as unknown as typeof fetch;
    await expect(fetchJournalRollups(7)).resolves.toEqual([]);
  });

  /* ── THE CONTRACT IS VERIFIED, NOT ASSUMED ──────────────────────────────
   *
   * Asking for dense does not mean getting it. An api-server predating the
   * capability ignores `?dense=1` and answers 200 with well-formed SPARSE
   * rows, and so does a rollback — the data is fine, only the assumption
   * about it is wrong. Every consumer reads this array as one row per
   * calendar day, so accepting it silently makes OBSERVED days masquerade as
   * the ELIGIBLE window and publishes a streak the dense wire withholds.
   */
  const serverReturning = (body: unknown) => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      captured.push(url.toString());
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
  };

  it('a server that IGNORES the capability is rejected, not silently believed', async () => {
    // Exactly what main@e1e7dbde answers: 200, sparse rows, no `dense` key.
    serverReturning({ rollups: [WIRE_ROW], days: 7, historyStartAt: null });
    await expect(fetchJournalRollups(7)).rejects.toThrow(/dense contract/i);
  });

  it('a server that explicitly served SPARSE is rejected too', async () => {
    serverReturning({ rollups: [WIRE_ROW], days: 7, historyStartAt: null, dense: false });
    await expect(fetchJournalRollups(7)).rejects.toThrow(/dense contract/i);
  });

  it('only a literal true is accepted — no truthy coercion', async () => {
    // `dense: 1` or `dense: "1"` from some future proxy or serialiser must not
    // pass for the contract; the check is the same fail-closed discipline the
    // server's query parsing uses.
    for (const v of [1, '1', 'true', {}, []]) {
      serverReturning({ rollups: [WIRE_ROW], days: 7, dense: v });
      await expect(fetchJournalRollups(7), `dense=${JSON.stringify(v)}`).rejects.toThrow();
    }
  });

  it('ANTI-VACUITY: a properly dense response still resolves', async () => {
    serverReturning({ rollups: [WIRE_ROW], days: 7, historyStartAt: null, dense: true });
    await expect(fetchJournalRollups(7)).resolves.toEqual([WIRE_ROW]);
  });

  it('ONE request builder for this endpoint — a second one could omit the capability', () => {
    // Six consumers (JournalScreen, WeeklyReportV3, PerformanceSignalV3,
    // EditorialWeeklyScreen, CircleScreenV3, useWeeklyCompliance) all read
    // through this single function, so proving the capability once proves it
    // for all of them. That only holds while there IS one builder: `main`
    // carried a second (`fetchJournalRollupsWithHistory`), and a future
    // re-addition that forgot `dense=1` would hand sparse rows to consumers
    // that assume one row per calendar day — silently, since the executable
    // laws above only exercise this function.
    // The scan counts EVERY mention of the path, not only ones with a literal
    // `?` glued to it. Requiring the `?` meant a builder written as
    // `/journal/rollups${qs}` or `'/journal/rollups' + qs` would not be
    // counted at all, and a second one omitting the capability would pass.
    const src = readFileSync(join(__dirname, '..', 'realApi.ts'), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
    const mentions = code.match(/\/journal\/rollups/g) ?? [];
    expect(mentions).toHaveLength(1);
    // ...and that one mention carries the capability.
    expect(code).toMatch(/\/journal\/rollups\?days=\$\{days\}&dense=1/);
  });
});

