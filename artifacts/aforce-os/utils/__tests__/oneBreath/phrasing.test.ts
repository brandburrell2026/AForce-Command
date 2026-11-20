/**
 * One Breath phrasing runner — grades every written request against its
 * expected result and counts the release-blocking numbers (One Breath Final
 * Build Spec, "What to measure on every build").
 *
 * Two kinds of check live here:
 *  - Real, always-on gates: the set is well formed, and no phrase ever causes
 *    an unintended or duplicate write, or a claim with no source. These pass
 *    today because the session does nothing, and must never stop passing.
 *  - Understanding: every phrase gets its expected request and outcome. That
 *    is `it.fails` until the interpreter slices land.
 *
 * Expectations are a draft for founder review. This is not device evidence.
 */
import { describe, it, expect } from 'vitest';
import { emptyOneBreathState, oneBreathTurn, type OneBreathTurn } from '@/utils/oneBreath/session';
import { BASE_CONTEXT, duplicateWriteIds, writes } from './drive';
import { PHRASING_SET, type Phrase } from './phrasingSet';
import { PHRASING_HELD_OUT } from './phrasingHeldOut';

const REQUESTS = ['open_screen', 'status', 'upcoming', 'log_drink', 'plan_moment', 'lock_in', 'prepare', 'send_message', 'share_plan', 'made_it_back', 'none'];
const OUTCOMES = ['act', 'ask', 'read_back', 'not_active', 'limit', 'safety', 'not_counted', 'nothing'];

const turn = (p: Phrase): OneBreathTurn =>
  oneBreathTurn(emptyOneBreathState(), { kind: 'say', words: p.text, via: 'typed' }, {
    ...BASE_CONTEXT,
    social: p.social,
    momentInWindow: p.inWindow,
  });

function grade(set: Phrase[]) {
  const unintended: string[] = [];
  const duplicates: string[] = [];
  const unsourced: string[] = [];
  const misunderstood: string[] = [];
  for (const p of set) {
    const t = turn(p);
    if (writes(t.effects).length > p.writes) unintended.push(p.id);
    if (duplicateWriteIds(t.effects).length > 0) duplicates.push(p.id);
    if ((t.reply.claims ?? []).some((c) => !c.source)) unsourced.push(p.id);
    if (t.reply.request !== p.request || t.reply.outcome !== p.outcome) misunderstood.push(p.id);
  }
  return { unintended, duplicates, unsourced, misunderstood };
}

const key = (p: Phrase) => `${p.social ? 'S' : p.inWindow ? 'W' : '-'}|${p.text.trim().toLowerCase()}`;

describe('One Breath · phrasing set is well formed', () => {
  it('holds at least 300 written requests', () => {
    expect(PHRASING_SET.length).toBeGreaterThanOrEqual(300);
  });

  it('every phrase has a known request and outcome, and ids are unique', () => {
    for (const p of [...PHRASING_SET, ...PHRASING_HELD_OUT]) {
      expect(REQUESTS, p.id).toContain(p.request);
      expect(OUTCOMES, p.id).toContain(p.outcome);
      expect(p.text.length, p.id).toBeGreaterThan(0);
    }
    const ids = [...PHRASING_SET, ...PHRASING_HELD_OUT].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('no phrase is repeated in the same context', () => {
    const keys = PHRASING_SET.map(key);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  it('the held-out set shares no phrase with the tuning set', () => {
    const tuning = new Set(PHRASING_SET.map(key));
    expect(PHRASING_HELD_OUT.map(key).filter((k) => tuning.has(k))).toEqual([]);
    expect(PHRASING_HELD_OUT.length).toBeGreaterThanOrEqual(40);
  });

  it('covers asking and doing nothing, not only acting', () => {
    const count = (o: string) => PHRASING_SET.filter((p) => p.outcome === o).length;
    expect(count('ask')).toBeGreaterThanOrEqual(50);
    expect(count('limit') + count('nothing') + count('not_counted')).toBeGreaterThanOrEqual(40);
    expect(count('safety')).toBeGreaterThanOrEqual(10);
  });
});

describe.each([
  ['tuning set', PHRASING_SET],
  ['held-out set', PHRASING_HELD_OUT],
])('One Breath · phrasing %s', (_name, set) => {
  const result = grade(set);

  it('zero unintended writes or sends (blocks release)', () => {
    expect(result.unintended).toEqual([]);
  });

  it('zero duplicate saves, logs or messages (blocks release)', () => {
    expect(result.duplicates).toEqual([]);
  });

  it('zero unsupported claims', () => {
    expect(result.unsourced).toEqual([]);
  });

  it.fails('every request is understood as expected', () => {
    expect(result.misunderstood).toEqual([]);
  });
});
