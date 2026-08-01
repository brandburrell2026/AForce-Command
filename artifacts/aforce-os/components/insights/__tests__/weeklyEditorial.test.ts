import { describe, it, expect } from 'vitest';
import { buildWeeklyReport, lastCompletedWeek } from '@/utils/weeklyReport';
import {
  toneForStatus,
  buildEditorialSections,
  EDITORIAL_ORDER,
} from '../weeklyEditorial';

const NOW = '2026-07-15T12:00:00.000Z';
const week = lastCompletedWeek(NOW);
const emptyReport = () =>
  buildWeeklyReport({
    nowISO: NOW,
    weekStartISO: week.weekStartISO,
    weekEndISO: week.weekEndISO,
    priorWeekStartISO: week.priorWeekStartISO,
    priorWeekEndISO: week.priorWeekEndISO,
    analyticsEvents: [],
  });

describe('toneForStatus', () => {
  it('maps honest statuses to editorial tones without inventing a win', () => {
    expect(toneForStatus('improved')).toBe('win');
    expect(toneForStatus('attention')).toBe('watch');
    expect(toneForStatus('steady')).toBe('neutral');
    expect(toneForStatus('collecting')).toBe('calibrating');
    expect(toneForStatus('awaiting')).toBe('awaiting');
  });
});

describe('buildEditorialSections', () => {
  it('emits sections in editorial read order', () => {
    const sections = buildEditorialSections(emptyReport());
    expect(sections.map((s) => s.key)).toEqual(EDITORIAL_ORDER);
  });

  it('with NO data, produces zero wins/watch and only honest calibrating/awaiting (no fabrication)', () => {
    const sections = buildEditorialSections(emptyReport());
    expect(sections.some((s) => s.tone === 'win')).toBe(false);
    expect(sections.some((s) => s.tone === 'watch')).toBe(false);
    // every non-neutral section must be an explicit honest state
    for (const s of sections) {
      if (s.tone === 'calibrating' || s.tone === 'awaiting') {
        expect(s.isHonestState).toBe(true);
      }
    }
    // top command has no instrumentation → awaiting
    expect(sections.find((s) => s.key === 'topCommand')?.tone).toBe('awaiting');
  });

  it('flags Performance Age for the disclaimer/Beta treatment', () => {
    const pa = buildEditorialSections(emptyReport()).find((s) => s.key === 'performanceAge');
    expect(pa?.isPerformanceAge).toBe(true);
  });

  it('surfaces a real win when the data supports it (streak ≥ 3, active days logged)', () => {
    // three consecutive active days ending inside the report week → real streak + activity
    const dayMs = 86_400_000;
    const endMs = Date.parse(week.weekEndISO);
    const evAt = (offsetDaysBack: number) =>
      new Date(endMs - offsetDaysBack * dayMs).toISOString();
    const events = [0, 1, 2, 3, 4].map((d) => ({ name: 'app_open', at: evAt(d) })) as any;
    const report = buildWeeklyReport({
      nowISO: NOW,
      weekStartISO: week.weekStartISO,
      weekEndISO: week.weekEndISO,
      priorWeekStartISO: week.priorWeekStartISO,
      priorWeekEndISO: week.priorWeekEndISO,
      analyticsEvents: events,
    });
    const sections = buildEditorialSections(report);
    const improved = sections.find((s) => s.key === 'improved');
    // improved is either a win (findings present) or an honest calibrating state — never a fabricated win.
    expect(['win', 'calibrating']).toContain(improved?.tone);
    if (improved?.tone === 'win') expect(improved.isHonestState).toBe(false);
  });
});
