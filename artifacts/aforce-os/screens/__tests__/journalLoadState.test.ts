/**
 * A ROLLUPS FAILURE MUST NOT ERASE A SUCCESSFUL INDEPENDENT FETCH.
 *
 * WHY THIS FILE EXISTS. `JournalScreen.load` awaited
 * `Promise.all([fetchJournalTimeline, fetchJournalRollups])` inside one `try`.
 * `Promise.all` rejects on the first rejection, so a failed rollups read threw
 * away a timeline that had already arrived intact and the whole screen fell to
 * one error line.
 *
 * The dense hard-fail (founder rollout ruling, PR #912) turned that from an
 * edge case into the every-load case for anyone running against a server
 * without the dense capability: `fetchJournalRollups` throws, and the trend
 * chart — drawn from the TIMELINE, needing no rollup at all — went dark with
 * it. R1 authorises isolating the two.
 *
 * The rule these laws hold is narrow and has two halves that are easy to get
 * backwards: a surviving read must SURVIVE, and a failed read must NOT become
 * an empty array. `[]` is a claim — "we looked and there is nothing" — and
 * after a failed read that claim is false for any member with history.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { settleJournalLoad } from '../journalLoadState';
import type { JournalRollup, JournalTimelineEntry } from '@/types';

const ok = <T,>(value: T): PromiseSettledResult<T> => ({ status: 'fulfilled', value });
const fail = <T,>(reason: string): PromiseSettledResult<T> => ({ status: 'rejected', reason: new Error(reason) });

const ENTRY = { type: 'snapshot', at: '2026-09-04T09:00:00.000Z', score: 88 } as unknown as JournalTimelineEntry;
const ROW = { date: '2026-09-04', snapshotsCount: 4, avgScore: 88 } as unknown as JournalRollup;

/** Exactly what the dense hard-fail throws. */
const DENSE_REFUSAL = 'journal/rollups: dense contract requested but not served — server predates the capability';

describe('the two Journal reads settle independently', () => {
  it('THE LAW: a rollups failure leaves a successful timeline intact', () => {
    const s = settleJournalLoad(ok([ENTRY]), fail<JournalRollup[]>(DENSE_REFUSAL));
    expect(s.timeline, 'the timeline that arrived must survive').toEqual([ENTRY]);
    expect(s.rollups, 'and the failed read is UNAVAILABLE').toBeNull();
    expect(s.bothFailed, 'one failure is not a screen-wide failure').toBe(false);
  });

  it('the failed read is null, NEVER an empty array', () => {
    // The distinction the whole fix rests on. `[]` would render as "you have
    // no history" to a member who has months of it.
    const s = settleJournalLoad(ok([ENTRY]), fail<JournalRollup[]>('boom'));
    expect(s.rollups).not.toEqual([]);
    expect(s.rollups).toBeNull();
  });

  it('and symmetrically: a timeline failure leaves successful rollups intact', () => {
    const s = settleJournalLoad(fail<JournalTimelineEntry[]>('boom'), ok([ROW]));
    expect(s.rollups).toEqual([ROW]);
    expect(s.timeline).toBeNull();
    expect(s.bothFailed).toBe(false);
  });

  it('both failing IS a screen-wide failure', () => {
    const s = settleJournalLoad(fail<JournalTimelineEntry[]>('a'), fail<JournalRollup[]>('b'));
    expect(s.timeline).toBeNull();
    expect(s.rollups).toBeNull();
    expect(s.bothFailed).toBe(true);
  });

  it('both succeeding passes both through untouched', () => {
    // ANTI-VACUITY: the happy path must not be collateral damage.
    const s = settleJournalLoad(ok([ENTRY]), ok([ROW]));
    expect(s).toEqual({ timeline: [ENTRY], rollups: [ROW], bothFailed: false });
  });

  it('a genuinely EMPTY successful read stays an empty array, not null', () => {
    // The other direction of the same distinction: a member who really has no
    // history gets `[]`, which the screen renders as its welcome copy. Only a
    // FAILURE produces null.
    const s = settleJournalLoad(ok([]), ok([]));
    expect(s.timeline).toEqual([]);
    expect(s.rollups).toEqual([]);
    expect(s.bothFailed, 'empty is not failed').toBe(false);
  });
});

/* The screen is store- and router-connected, so this repo's convention is a
 * source guard with mutation-verify rather than a fabricated render harness
 * (components/home/__tests__/homeScreenV2Wiring.test.ts). The BEHAVIOUR is
 * held above; what a source guard adds is that the screen actually routes
 * through it and cannot quietly return to `Promise.all`. */
describe('JournalScreen is wired to settle independently', () => {
  const CODE = readFileSync(join(__dirname, '..', 'JournalScreen.tsx'), 'utf8');

  function assertIndependentSettlement(code: string): void {
    expect(code).toContain("import { settleJournalLoad } from './journalLoadState';");
    expect(code).toMatch(/const \[tlResult, rlResult\] = await Promise\.allSettled\(\[/);
    expect(code).toMatch(/const settled = settleJournalLoad\(tlResult, rlResult\);/);
    // The one construct that reintroduces the defect.
    expect(code, 'Promise.all rejects on the first rejection').not.toMatch(
      /await Promise\.all\(\[\s*\n\s*fetchJournalTimeline/,
    );
    // Failure state is null, never a fabricated empty array.
    expect(code).toMatch(/useState<JournalTimelineEntry\[\] \| null>\(null\)/);
    expect(code).toMatch(/useState<JournalRollup\[\] \| null>\(null\)/);
    // Only BOTH failing is a screen-wide error.
    expect(code).toMatch(/if \(settled\.bothFailed\) setError\(t\('journal\.load_failed'\)\);/);
    // Each surface fails closed on its own read.
    expect(code).toMatch(/testID="journal-rollups-unavailable"/);
    expect(code).toMatch(/testID="journal-chart-unavailable"/);
    // Neither export nor share may run on an unavailable window.
    expect(code).toMatch(/if \(exporting \|\| rollups == null \|\| snapshots == null\) return;/);
    expect(code).toMatch(/if \(rollups == null\) return;\s*\n\s*const \{ window, context \} = prepareJournalShare/);
  }

  it('the screen settles the two reads independently and fails each closed', () => {
    assertIndependentSettlement(CODE);
  });

  it('mutation-verify: returning to Promise.all is detectable', () => {
    const regressed = CODE.replace(
      'const [tlResult, rlResult] = await Promise.allSettled([',
      'const [tlResult, rlResult] = await Promise.all([\n      fetchJournalTimeline(r),',
    );
    expect(regressed).not.toBe(CODE);
    expect(() => assertIndependentSettlement(regressed)).toThrow();
  });

  it('mutation-verify: fabricating [] on failure is detectable', () => {
    const regressed = CODE.replace(
      'useState<JournalRollup[] | null>(null)',
      'useState<JournalRollup[]>([])',
    );
    expect(regressed).not.toBe(CODE);
    expect(() => assertIndependentSettlement(regressed)).toThrow();
  });

  it('mutation-verify: erroring the whole screen on one failure is detectable', () => {
    const regressed = CODE.replace(
      "if (settled.bothFailed) setError(t('journal.load_failed'));",
      "if (settled.rollups == null) setError(t('journal.load_failed'));",
    );
    expect(regressed).not.toBe(CODE);
    expect(() => assertIndependentSettlement(regressed)).toThrow();
  });
});

describe('the failure copy does not claim the member has no history', () => {
  const EN = JSON.parse(
    readFileSync(join(__dirname, '..', '..', 'locales', 'en.json'), 'utf8'),
  ) as { journal: Record<string, string> };

  it('load_failed and empty_state are DIFFERENT statements', () => {
    // They were byte-identical: a failed network read told a member with
    // months of history "Your performance timeline begins after your first
    // check." That is a claim about them, produced by a claim about the
    // network.
    expect(EN.journal.load_failed).not.toBe(EN.journal.empty_state);
    expect(EN.journal.load_failed).toBeTruthy();
  });

  it('the unavailable copy says unavailable, not empty', () => {
    for (const key of ['load_failed', 'rollups_unavailable', 'timeline_unavailable']) {
      const copy = EN.journal[key]!;
      expect(copy, `${key} must exist`).toBeTruthy();
      expect(copy, `${key} must not imply the member has no history`)
        .not.toMatch(/begins after your first|no history|nothing yet/i);
    }
  });
});
