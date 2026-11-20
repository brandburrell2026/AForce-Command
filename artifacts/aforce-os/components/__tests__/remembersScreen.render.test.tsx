// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Moment } from '@/types/moments';

const h = vi.hoisted(() => ({ moments: [] as Moment[], commit: vi.fn(), fail: false, back: vi.fn(), replace: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => ({ back: h.back, replace: h.replace, canGoBack: () => true }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => (k === 'moments.private_event' ? 'Private event' : k) }) }));
vi.mock('@/components/Icon', () => ({ Icon: () => null }));
vi.mock('@/components/ui', () => ({ AFScreen: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/services/userScope', () => ({ subscribeUserScope: () => () => {} }));
vi.mock('@/services/scopedStorage', () => ({ scopedStorage: { getItem: async () => null, setItem: async () => {} } }));
vi.mock('@/services/momentsStore', () => ({
  hydrateMoments: async () => {},
  useMomentsStore: () => ({ moments: h.moments, hydrated: true }),
  commitReviewedMoment: async (m: Moment, expected?: Moment) => {
    if (h.fail) throw Error('changed');
    h.commit(m, expected);
    h.moments = [...h.moments.filter((x) => x.id !== m.id), m];
    return m;
  },
}));

import { RemembersScreen, withoutReplay } from '../remembers/RemembersScreen';
import {
  approveLessonFromReplay,
  deleteAllLessons,
  getMomentLessonsState,
  hydrateMomentLessons,
  setLearningOn,
} from '@/services/momentLessons';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const moment = (id: string, prep: Partial<NonNullable<Moment['preparation']>>): Moment => ({
  id, source: 'manual', title: `Moment ${id}`, type: 'training', importance: 'high',
  startAtIso: '2026-11-05T11:30:00.000Z', createdAtIso: '2026-11-04T12:00:00.000Z',
  preparation: {
    version: 1, context: 'one_breath', transactionId: 'seal-1', reviewedAtIso: 'r', sealedAtIso: 's',
    returnedAtIso: '2026-11-05T12:40:00.000Z', returnMethod: 'none', destination: '', emergencyNumber: '911',
    steps: [{ atIso: '2026-11-05T11:00:00.000Z', action: 'Water first' }], policyVersion: 'social-v0.4-phase-a', ...prep,
  },
});

let host: HTMLDivElement;
let root: Root;
const el = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const tap = async (id: string) => { await act(async () => el(id)!.click()); };
const mount = async () => { await act(async () => root.render(<RemembersScreen />)); };

beforeEach(async () => {
  h.moments = []; h.fail = false; h.commit.mockReset();
  await hydrateMomentLessons(); deleteAllLessons(); setLearningOn(true);
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('What AFORCE remembers, wired to the phone', () => {
  it('removing a Replay answer leaves the plan, the seal and the Return exactly as they were', () => {
    const m = moment('a', { replay: 'not_really', replayObstacle: 'other', replayNote: 'traffic' });
    const out = withoutReplay(m).preparation!;
    expect(out.replay).toBeUndefined();
    expect(out.replayObstacle).toBeUndefined();
    expect(out.replayNote).toBeUndefined();
    expect(out.transactionId).not.toBe('seal-1');
    const { transactionId: _a, ...after } = out;
    const { transactionId: _b, replay: _r, replayObstacle: _o, replayNote: _n, ...before } = m.preparation!;
    expect(after).toEqual(before);
  });

  it('lists the member\'s lessons and answered Replays', async () => {
    h.moments = [moment('a', { replay: 'not_really', replayObstacle: 'water' }), moment('b', { replay: 'skipped' })];
    approveLessonFromReplay({ text: 'Fill a bottle before bed.', scope: 'training', momentId: 'a', momentAtIso: h.moments[0]!.startAtIso, nowIso: '2026-11-20T12:00:00.000Z' });
    await mount();
    expect(el('remembers-lessons')?.textContent).toContain('Fill a bottle before bed.');
    expect(el('remembers-replay-a')?.textContent).toContain('Not really · Forgot water');
    expect(el('remembers-replay-b')).toBeNull();
  });

  it('deleting a Replay and keeping its lesson turns the lesson into the member\'s own rule', async () => {
    h.moments = [moment('a', { replay: 'partly', replayObstacle: 'late' })];
    approveLessonFromReplay({ text: 'Leave earlier.', scope: 'training', momentId: 'a', momentAtIso: h.moments[0]!.startAtIso, nowIso: '2026-11-20T12:00:00.000Z' });
    await mount();
    await tap('remembers-replay-a-delete');
    await tap('remembers-replay-a-keep-lesson');
    expect(h.moments[0]!.preparation!.replay).toBeUndefined();
    expect(h.moments[0]!.preparation!.steps).toEqual([{ atIso: '2026-11-05T11:00:00.000Z', action: 'Water first' }]);
    expect(getMomentLessonsState().lessons[0]).toMatchObject({ text: 'Leave earlier.', source: null });
  });

  it('deleting both removes the lesson too', async () => {
    h.moments = [moment('a', { replay: 'partly', replayObstacle: 'late' })];
    approveLessonFromReplay({ text: 'Leave earlier.', scope: 'training', momentId: 'a', momentAtIso: h.moments[0]!.startAtIso, nowIso: '2026-11-20T12:00:00.000Z' });
    await mount();
    await tap('remembers-replay-a-delete');
    await tap('remembers-replay-a-delete-both');
    expect(getMomentLessonsState().lessons).toHaveLength(0);
  });

  it('if the Replay could not be deleted, the lesson is left alone and the member is told', async () => {
    h.moments = [moment('a', { replay: 'partly', replayObstacle: 'late' })];
    approveLessonFromReplay({ text: 'Leave earlier.', scope: 'training', momentId: 'a', momentAtIso: h.moments[0]!.startAtIso, nowIso: '2026-11-20T12:00:00.000Z' });
    h.fail = true;
    await mount();
    await tap('remembers-replay-a-delete');
    await tap('remembers-replay-a-delete-both');
    expect(getMomentLessonsState().lessons).toHaveLength(1);
    expect(el('remembers-error')?.textContent).toBe('That Replay could not be deleted. Try again.');
  });

  it('delete everything clears lessons and Replay answers, and nothing else', async () => {
    h.moments = [moment('a', { replay: 'yes' }), moment('b', { replay: 'not_really', replayObstacle: 'drain' })];
    approveLessonFromReplay({ text: 'Eat earlier.', scope: 'training', momentId: 'b', momentAtIso: h.moments[1]!.startAtIso, nowIso: '2026-11-20T12:00:00.000Z' });
    await mount();
    await tap('remembers-delete-all');
    await tap('remembers-delete-all-yes');
    expect(getMomentLessonsState().lessons).toHaveLength(0);
    expect(h.moments.map((m) => m.preparation!.replay)).toEqual([undefined, undefined]);
    expect(h.moments.every((m) => m.preparation!.returnedAtIso === '2026-11-05T12:40:00.000Z')).toBe(true);
  });
});
