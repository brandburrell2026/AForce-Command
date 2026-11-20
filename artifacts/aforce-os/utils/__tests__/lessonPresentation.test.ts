import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/momentLessons', () => ({}));

import type { MomentLesson } from '@/services/momentLessons';
import type { Moment } from '@/types/moments';
import { lessonRows, lessonScopeLabel, planLessonOffers, remembersSummary, replayRows, togglePlanLesson } from '../lessonPresentation';

const lesson = (over: Partial<MomentLesson> = {}): MomentLesson => ({
  id: 'l1',
  text: 'Lay out my gear the night before.',
  scope: 'training',
  on: true,
  author: 'member',
  approvedAtIso: '2026-11-20T12:00:00.000Z',
  createdAtIso: '2026-11-20T12:00:00.000Z',
  source: { momentId: 'm1', momentAtIso: '2026-11-05T11:30:00.000Z' },
  ...over,
});
const moment = (over: Partial<Moment> = {}, prep: Partial<NonNullable<Moment['preparation']>> = {}): Moment => ({
  id: 'm1',
  source: 'manual',
  title: 'Morning lift',
  type: 'training',
  importance: 'high',
  startAtIso: '2026-11-05T11:30:00.000Z',
  createdAtIso: '2026-11-04T12:00:00.000Z',
  preparation: {
    version: 1, context: 'one_breath', transactionId: 't', reviewedAtIso: 'x', sealedAtIso: 'x',
    returnMethod: 'none', destination: '', emergencyNumber: '911', steps: [], policyVersion: 'social-v0.4-phase-a',
    returnedAtIso: '2026-11-05T12:40:00.000Z', ...prep,
  },
  ...over,
});
const when = new Date('2026-11-05T11:30:00.000Z').toLocaleDateString([], { month: 'short', day: 'numeric' });

describe('What AFORCE remembers, in words', () => {
  it('names the kind of Moment a lesson is for', () => {
    expect(lessonScopeLabel('training')).toBe('Training Moments');
    expect(lessonScopeLabel('work')).toBe('Work Moments');
    expect(lessonScopeLabel(undefined)).toBe('Personal Moments');
  });

  it('a lesson row says state, scope, where it came from and who approved it', () => {
    expect(lessonRows([lesson()])[0]!.meta).toBe(`On · Training Moments only · from your Replay on ${when} · you approved`);
    expect(lessonRows([lesson({ on: false, source: null })])[0]!.meta).toBe('Paused · Training Moments only · your own rule · you approved');
  });

  it('newest lesson first', () => {
    expect(lessonRows([lesson({ id: 'a' }), lesson({ id: 'b' })]).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('lists answered Replays with what the member said, newest first', () => {
    const rows = replayRows(
      [
        moment({ id: 'old', startAtIso: '2026-11-01T11:30:00.000Z' }, { replay: 'yes' }),
        moment({}, { replay: 'not_really', replayObstacle: 'drain' }),
      ],
      [lesson()],
      'Private event',
    );
    expect(rows.map((r) => r.id)).toEqual(['m1', 'old']);
    expect(rows[0]).toMatchObject({ title: `Morning lift · ${when}`, said: 'Not really · Ran out of gas', hasLesson: true });
    expect(rows[1]).toMatchObject({ said: 'Yes, it worked', hasLesson: false });
  });

  it('leaves out skipped and unanswered Replays', () => {
    expect(replayRows([moment({}, { replay: 'skipped' }), moment({ id: 'b' }, {})], [], 'P')).toEqual([]);
  });

  it('never shows the title of a private Moment', () => {
    const rows = replayRows([moment({ masked: true, title: 'Secret meeting' }, { replay: 'yes' })], [], 'Private event');
    expect(rows[0]!.title).toBe(`Private event · ${when}`);
    expect(JSON.stringify(rows)).not.toContain('Secret');
  });

  it('the Profile row summary', () => {
    expect(remembersSummary(true, 1)).toBe('Learning on · 1 lesson · only what you approved');
    expect(remembersSummary(false, 0)).toBe('Learning off · 0 lessons · only what you approved');
  });
});

describe('lessons offered on a plan', () => {
  const offers = (over: Partial<Parameters<typeof planLessonOffers>[0]> = {}) =>
    planLessonOffers({ lessons: [lesson()], learningOn: true, type: 'training', added: undefined, ...over });

  it('offers a lesson for the same kind of Moment, with where it came from and why', () => {
    expect(offers()).toEqual([
      {
        id: 'l1',
        text: 'Lay out my gear the night before.',
        reason: `You wrote this after your Replay on ${when}. It is for Training Moments, and this is a Training Moment.`,
        added: false,
      },
    ]);
  });

  it('a kept rule with no Replay says it is the member\'s own', () => {
    expect(offers({ lessons: [lesson({ source: null })] })[0]!.reason).toBe(
      'Your own rule. It is for Training Moments, and this is a Training Moment.',
    );
  });

  it('offers nothing for another kind of Moment, a paused lesson, learning off, or an unknown kind', () => {
    expect(offers({ type: 'work' })).toEqual([]);
    expect(offers({ lessons: [lesson({ on: false })] })).toEqual([]);
    expect(offers({ learningOn: false })).toEqual([]);
    expect(offers({ type: undefined })).toEqual([]);
  });

  it('never marks a lesson as added unless the member added it', () => {
    expect(offers().every((o) => !o.added)).toBe(true);
    expect(offers({ added: [{ id: 'l1', text: 'x' }] })[0]!.added).toBe(true);
  });

  it('shows the newest three at most', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => lesson({ id }));
    expect(offers({ lessons: many }).map((o) => o.id)).toEqual(['e', 'd', 'c']);
  });

  it('adding copies the wording; removing leaves nothing behind', () => {
    const one = togglePlanLesson(undefined, { id: 'l1', text: 'Eat first.' });
    expect(one).toEqual([{ id: 'l1', text: 'Eat first.' }]);
    const two = togglePlanLesson(one, { id: 'l2', text: 'Leave early.' });
    expect(two).toHaveLength(2);
    expect(togglePlanLesson(two, { id: 'l1', text: 'Eat first.' })).toEqual([{ id: 'l2', text: 'Leave early.' }]);
    expect(togglePlanLesson(one, { id: 'l1', text: 'Eat first.' })).toBeUndefined();
  });
});
