import { describe, it, expect } from 'vitest';

import {
  buildWeeklyReport,
  getWeeklyReportSection,
  lastCompletedWeek,
  type WeeklyReportInput,
} from '../weeklyReport';
import type { AnalyticsEvent } from '../analytics/metrics';
import type { PerformanceAgeResult } from '../performanceAge';

// Report week: Sun 2026-06-07 → Sat 2026-06-13 (UTC). Prior: 2026-05-31 → 2026-06-06.
const WEEK_START = '2026-06-07T00:00:00.000Z';
const WEEK_END = '2026-06-13T23:59:59.999Z';
const PRIOR_START = '2026-05-31T00:00:00.000Z';
const PRIOR_END = '2026-06-06T23:59:59.999Z';
const NOW = '2026-06-17T12:00:00.000Z'; // a Wednesday inside the next week

function baseInput(over: Partial<WeeklyReportInput> = {}): WeeklyReportInput {
  return {
    nowISO: NOW,
    weekStartISO: WEEK_START,
    weekEndISO: WEEK_END,
    analyticsEvents: [],
    ...over,
  };
}

function session(at: string): AnalyticsEvent {
  return { type: 'session_open', at };
}

function logAction(at: string): AnalyticsEvent {
  return { type: 'log_action', at, meta: { ttlMs: 1500 } };
}

describe('lastCompletedWeek — pure Sunday window', () => {
  it('returns the just-finished Sun–Sat week from a mid-week anchor', () => {
    const w = lastCompletedWeek('2026-06-17T12:00:00.000Z'); // Wednesday
    expect(w.weekStartISO).toBe('2026-06-07T00:00:00.000Z');
    expect(w.weekEndISO).toBe('2026-06-13T23:59:59.999Z');
    expect(w.priorWeekStartISO).toBe('2026-05-31T00:00:00.000Z');
    expect(w.priorWeekEndISO).toBe('2026-06-06T23:59:59.999Z');
  });

  it('on a Sunday reports the week that just ended (not week-to-date)', () => {
    const w = lastCompletedWeek('2026-06-14T08:00:00.000Z'); // Sunday
    expect(w.weekStartISO).toBe('2026-06-07T00:00:00.000Z');
    expect(w.weekEndISO).toBe('2026-06-13T23:59:59.999Z');
  });
});

describe('buildWeeklyReport — honest empty state (Score-Protection)', () => {
  const report = buildWeeklyReport(baseInput());

  it('echoes the week window and generated anchor', () => {
    expect(report.weekStartISO).toBe(WEEK_START);
    expect(report.weekEndISO).toBe(WEEK_END);
    expect(report.generatedAtISO).toBe(NOW);
  });

  it('emits exactly the 7 spec sections in order', () => {
    expect(report.sections.map((s) => s.key)).toEqual([
      'improved',
      'attention',
      'performanceAge',
      'habitVelocity',
      'recovery',
      'topCommand',
      'nextWeekFocus',
    ]);
  });

  it('never fabricates — every data section reads collecting/awaiting with no value', () => {
    expect(getWeeklyReportSection(report, 'habitVelocity').status).toBe('collecting');
    expect(getWeeklyReportSection(report, 'habitVelocity').value).toBeNull();
    expect(getWeeklyReportSection(report, 'performanceAge').status).toBe('collecting');
    expect(getWeeklyReportSection(report, 'performanceAge').value).toBeNull();
    expect(getWeeklyReportSection(report, 'recovery').status).toBe('collecting');
    expect(getWeeklyReportSection(report, 'recovery').value).toBeNull();
    expect(getWeeklyReportSection(report, 'topCommand').status).toBe('awaiting');
    expect(getWeeklyReportSection(report, 'topCommand').value).toBeNull();
  });

  it('narrative sections collect rather than invent on an empty week', () => {
    const improved = getWeeklyReportSection(report, 'improved');
    const attention = getWeeklyReportSection(report, 'attention');
    expect(improved.status).toBe('collecting');
    expect(improved.findings).toEqual([]);
    expect(attention.status).toBe('collecting');
    expect(attention.findings).toEqual([]);
  });

  it('next week focus always exists and points at consistency when idle', () => {
    const focus = getWeeklyReportSection(report, 'nextWeekFocus');
    expect(focus.status).toBe('steady');
    expect(focus.params.focus).toBe('consistency');
  });
});

describe('buildWeeklyReport — Score-Protection: streak is anchored to the report week', () => {
  // The report week (2026-06-07 → 2026-06-13) is empty, but a 3-day session
  // streak exists in the *following* partial week (the realistic internal-preview
  // case: opened mid-week). The current-day streak reads from the full log and
  // spans week boundaries, so it must NOT surface as a report-week "improvement"
  // or the report would fabricate a win for a week with zero activity.
  const laterWeekStreak: AnalyticsEvent[] = [
    session('2026-06-15T09:00:00.000Z'), // Mon (next week)
    session('2026-06-16T09:00:00.000Z'), // Tue
    session('2026-06-17T09:00:00.000Z'), // Wed
  ];

  it('does not fabricate a streak win when the report week had no activity', () => {
    const report = buildWeeklyReport(baseInput({ analyticsEvents: laterWeekStreak }));
    const improved = getWeeklyReportSection(report, 'improved');
    expect(improved.status).toBe('collecting');
    // findings empty ⇒ the streak win was not fabricated for an inactive week
    expect(improved.findings).toEqual([]);
    // the empty report week is still honestly collecting for habit velocity
    expect(getWeeklyReportSection(report, 'habitVelocity').status).toBe('collecting');
  });
});

describe('buildWeeklyReport — Habit Velocity is the one real weekly signal', () => {
  const activeWeek: AnalyticsEvent[] = [
    session('2026-06-08T09:00:00.000Z'),
    logAction('2026-06-08T09:01:00.000Z'),
    session('2026-06-10T09:00:00.000Z'),
    session('2026-06-12T09:00:00.000Z'),
  ];

  it('reports active-days as a real value with no prior week (steady, not a win)', () => {
    const hv = getWeeklyReportSection(
      buildWeeklyReport(baseInput({ analyticsEvents: activeWeek })),
      'habitVelocity',
    );
    expect(hv.value).toBe('3');
    expect(hv.status).toBe('steady');
    expect(hv.params.activeDays).toBe(3);
  });

  it('flags improvement when this week beats the prior week', () => {
    const report = buildWeeklyReport(
      baseInput({
        analyticsEvents: [...activeWeek, session('2026-06-01T09:00:00.000Z')],
        priorWeekStartISO: PRIOR_START,
        priorWeekEndISO: PRIOR_END,
      }),
    );
    const hv = getWeeklyReportSection(report, 'habitVelocity');
    expect(hv.status).toBe('improved');
    expect(hv.params.deltaActiveDays).toBe(2); // 3 this week vs 1 prior
    const improved = getWeeklyReportSection(report, 'improved');
    expect(improved.status).toBe('improved');
    expect(improved.findings?.some((f) => f.code === 'active_days_up')).toBe(true);
  });

  it('flags attention when this week falls below the prior week', () => {
    const report = buildWeeklyReport(
      baseInput({
        analyticsEvents: [
          session('2026-06-08T09:00:00.000Z'),
          // prior week was busier (3 days)
          session('2026-06-01T09:00:00.000Z'),
          session('2026-06-03T09:00:00.000Z'),
          session('2026-06-05T09:00:00.000Z'),
        ],
        priorWeekStartISO: PRIOR_START,
        priorWeekEndISO: PRIOR_END,
      }),
    );
    expect(getWeeklyReportSection(report, 'habitVelocity').status).toBe('attention');
    expect(getWeeklyReportSection(report, 'attention').status).toBe('attention');
  });

  it('ignores events with invalid timestamps', () => {
    const hv = getWeeklyReportSection(
      buildWeeklyReport(
        baseInput({
          analyticsEvents: [
            session('2026-06-08T09:00:00.000Z'),
            { type: 'session_open', at: 'not-a-date' },
            session('not-a-date-either'),
          ],
        }),
      ),
      'habitVelocity',
    );
    expect(hv.value).toBe('1');
  });

  it('windows out events that fall outside the report week', () => {
    const hv = getWeeklyReportSection(
      buildWeeklyReport(
        baseInput({
          analyticsEvents: [
            session('2026-06-08T09:00:00.000Z'), // in week
            session('2026-06-20T09:00:00.000Z'), // after week
            session('2026-05-30T09:00:00.000Z'), // before week
          ],
        }),
      ),
      'habitVelocity',
    );
    expect(hv.value).toBe('1');
  });
});

describe('buildWeeklyReport — no fabricated trends without snapshots', () => {
  const currentPA: PerformanceAgeResult = {
    status: 'established',
    hasEnoughData: true,
    provisional: false,
    performanceAge: 29,
    actualAge: 32,
    yearsDelta: -3,
    composite: 82,
    band: 'BALANCED',
    availableSignals: 4,
  };

  it('shows current value as reference but stays collecting (no delta) without history', () => {
    const report = buildWeeklyReport(
      baseInput({ current: { performanceAge: currentPA, recoveryScore: 71 } }),
    );
    const pa = getWeeklyReportSection(report, 'performanceAge');
    expect(pa.status).toBe('collecting');
    expect(pa.value).toBe('29');
    expect(pa.params.deltaYears).toBeUndefined();

    const rec = getWeeklyReportSection(report, 'recovery');
    expect(rec.status).toBe('collecting');
    expect(rec.value).toBe('71');
    expect(rec.params.delta).toBeUndefined();
  });

  it('computes a younger Performance Age movement once a week of snapshots exists', () => {
    const report = buildWeeklyReport(
      baseInput({
        history: {
          performanceAgeSnapshots: [
            { dayIndex: 20_240, performanceAge: 31 },
            { dayIndex: 20_248, performanceAge: 29 },
          ],
        },
      }),
    );
    const pa = getWeeklyReportSection(report, 'performanceAge');
    expect(pa.status).toBe('improved');
    expect(pa.value).toBe('-2');
    expect(pa.params.direction).toBe('younger');
  });

  it('computes a rising Recovery trend once a week of snapshots exists', () => {
    const report = buildWeeklyReport(
      baseInput({
        history: {
          recoverySnapshots: [
            { dayIndex: 20_240, value: 50 },
            { dayIndex: 20_248, value: 60 },
          ],
        },
      }),
    );
    const rec = getWeeklyReportSection(report, 'recovery');
    expect(rec.status).toBe('improved');
    expect(rec.value).toBe('+10');
    expect(rec.params.direction).toBe('up');
  });
});

describe('buildWeeklyReport — top command + determinism', () => {
  it('surfaces the most-used command when usage is recorded', () => {
    const top = getWeeklyReportSection(
      buildWeeklyReport(
        baseInput({
          commandUsage: [
            { commandId: 'hydrate', label: 'Hydrate Now', count: 5 },
            { commandId: 'cool', label: 'Cool Down', count: 2 },
          ],
        }),
      ),
      'topCommand',
    );
    expect(top.status).toBe('steady');
    expect(top.value).toBe('Hydrate Now');
    expect(top.params.count).toBe(5);
  });

  it('is deterministic — identical input yields a deep-equal report', () => {
    const input = baseInput({
      analyticsEvents: [session('2026-06-08T09:00:00.000Z'), logAction('2026-06-08T09:01:00.000Z')],
      current: { recoveryScore: 64 },
    });
    expect(buildWeeklyReport(input)).toEqual(buildWeeklyReport(input));
  });
});

// ── Water-First lock — "Next week focus" copy must lead with water ──────
// The helper emits only a focus *code* (recovery|consistency|maintain); the
// human copy lives in the locale files. This guards the lock at the source:
// every launch-language focus string must begin with its "start with water"
// lead so a recommendation never puts anything before water.
describe('Water-First lock — nextWeekFocus locale copy', () => {
  const LEADS: Record<string, string> = {
    en: 'Start with water',
    es: 'Empieza con agua',
    fr: 'Commencez par de l’eau',
    de: 'Beginne mit Wasser',
    pt: 'Comece com água',
    it: 'Inizia con l’acqua',
  };

  for (const [lng, lead] of Object.entries(LEADS)) {
    it(`${lng}: every focus code leads with water`, async () => {
      const locale = (await import(`../../locales/${lng}.json`)).default as {
        reports: { sections: { nextWeekFocus: Record<string, string> } };
      };
      const focus = locale.reports.sections.nextWeekFocus;
      for (const code of ['consistency', 'recovery', 'maintain'] as const) {
        expect(focus[code].startsWith(lead)).toBe(true);
      }
    });
  }
});
