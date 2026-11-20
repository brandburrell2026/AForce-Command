import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ disk: null as string | null, scopeListeners: [] as (() => void)[], writes: 0 }));
vi.mock('../userScope', () => ({
  subscribeUserScope: (l: () => void) => {
    mock.scopeListeners.push(l);
    return () => {};
  },
}));
vi.mock('../scopedStorage', () => ({
  scopedStorage: {
    getItem: async () => mock.disk,
    setItem: async (_k: string, v: string) => {
      mock.writes += 1;
      mock.disk = v;
    },
  },
}));

const NOW = '2026-11-20T12:00:00.000Z';
const fromReplay = (text: string, momentId = 'm1') => ({
  text,
  scope: 'training' as const,
  momentId,
  momentAtIso: '2026-11-19T11:30:00.000Z',
  nowIso: NOW,
});
const load = async () => {
  const s = await import('../momentLessons');
  await s.hydrateMomentLessons();
  return s;
};
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.resetModules();
  mock.disk = null;
  mock.scopeListeners = [];
  mock.writes = 0;
});

describe('member-written lessons', () => {
  it('starts empty, with learning on, and saves nothing by itself', async () => {
    const s = await load();
    expect(s.getMomentLessonsState()).toEqual({ hydrated: true, learningOn: true, lessons: [] });
    expect(mock.writes).toBe(0);
  });

  it('keeps exactly the sentence the member approved, tidied, as their own', async () => {
    const s = await load();
    expect(s.approveLessonFromReplay(fromReplay('  Lay out   my gear the night before. '))).toBe('saved');
    const [l] = s.getMomentLessonsState().lessons;
    expect(l).toMatchObject({
      text: 'Lay out my gear the night before.',
      scope: 'training',
      on: true,
      author: 'member',
      approvedAtIso: NOW,
      source: { momentId: 'm1', momentAtIso: '2026-11-19T11:30:00.000Z' },
    });
    // No title, no words from the Moment, nothing but an id and a date.
    expect(Object.keys(l!.source!)).toEqual(['momentId', 'momentAtIso']);
  });

  it('refuses blank text, and anything while learning is off or before loading', async () => {
    const cold = await import('../momentLessons');
    expect(cold.approveLessonFromReplay(fromReplay('x'))).toBe('not_ready');
    const s = await load();
    expect(s.approveLessonFromReplay(fromReplay('   '))).toBe('empty');
    s.setLearningOn(false);
    expect(s.approveLessonFromReplay(fromReplay('Eat first.'))).toBe('off');
    expect(s.getMomentLessonsState().lessons).toHaveLength(0);
  });

  it('caps the sentence at 90 characters', async () => {
    const s = await load();
    s.approveLessonFromReplay(fromReplay('x'.repeat(200)));
    expect(s.getMomentLessonsState().lessons[0]!.text).toHaveLength(90);
  });

  it('one lesson per Replay: approving again replaces the wording, keeps pause and id', async () => {
    const s = await load();
    s.approveLessonFromReplay(fromReplay('First.'));
    const id = s.getMomentLessonsState().lessons[0]!.id;
    s.setLessonOn(id, false);
    s.approveLessonFromReplay(fromReplay('Second.'));
    expect(s.getMomentLessonsState().lessons).toHaveLength(1);
    expect(s.getMomentLessonsState().lessons[0]).toMatchObject({ id, text: 'Second.', on: false });
  });

  it('never drops an approved lesson to make room for a new one', async () => {
    const s = await load();
    for (let i = 0; i < 50; i += 1) expect(s.approveLessonFromReplay(fromReplay(`Rule ${i}`, `m${i}`))).toBe('saved');
    expect(s.approveLessonFromReplay(fromReplay('One more', 'extra'))).toBe('full');
    expect(s.getMomentLessonsState().lessons).toHaveLength(50);
    expect(s.getMomentLessonsState().lessons[0]!.text).toBe('Rule 0');
    // Rewording an existing one is still allowed at the cap.
    expect(s.approveLessonFromReplay(fromReplay('Rule 0, reworded', 'm0'))).toBe('saved');
  });

  it('edit, pause, resume and delete', async () => {
    const s = await load();
    s.approveLessonFromReplay(fromReplay('Eat first.'));
    const id = s.getMomentLessonsState().lessons[0]!.id;
    expect(s.editLesson(id, '   ', NOW)).toBe(false);
    expect(s.editLesson(id, 'Eat before I leave.', '2026-11-21T08:00:00.000Z')).toBe(true);
    expect(s.getMomentLessonsState().lessons[0]).toMatchObject({ text: 'Eat before I leave.', approvedAtIso: '2026-11-21T08:00:00.000Z' });
    s.setLessonOn(id, false);
    expect(s.getMomentLessonsState().lessons[0]!.on).toBe(false);
    s.setLessonOn(id, true);
    expect(s.getMomentLessonsState().lessons[0]!.on).toBe(true);
    s.deleteLesson(id);
    expect(s.getMomentLessonsState().lessons).toHaveLength(0);
  });

  it('a deleted Replay takes its lesson with it, or leaves it as the member\'s own rule', async () => {
    const s = await load();
    s.approveLessonFromReplay(fromReplay('Keep me.', 'a'));
    s.approveLessonFromReplay(fromReplay('Remove me.', 'b'));
    s.releaseLessonFromReplay('a', true);
    s.releaseLessonFromReplay('b', false);
    expect(s.getMomentLessonsState().lessons).toHaveLength(1);
    expect(s.getMomentLessonsState().lessons[0]).toMatchObject({ text: 'Keep me.', source: null });
  });

  it('survives a restart, including the Learning switch', async () => {
    const s = await load();
    s.approveLessonFromReplay(fromReplay('Eat first.'));
    s.setLearningOn(false);
    await flush();
    vi.resetModules();
    const again = await load();
    expect(again.getMomentLessonsState().learningOn).toBe(false);
    expect(again.getMomentLessonsState().lessons.map((l) => l.text)).toEqual(['Eat first.']);
  });

  it('drops anything on disk that the member did not write', async () => {
    const good = { id: 'a', text: 'Mine.', scope: 'work', on: true, author: 'member', approvedAtIso: NOW, createdAtIso: NOW, source: null };
    mock.disk = JSON.stringify({
      version: 1,
      learningOn: true,
      lessons: [good, { ...good, id: 'b', author: 'aforce' }, { ...good, id: 'c', scope: 'dinner' }, { ...good, id: 'd', text: '  ' }, 'junk'],
    });
    const s = await load();
    expect(s.getMomentLessonsState().lessons.map((l) => l.id)).toEqual(['a']);
  });

  it('unreadable storage is an empty list, not a crash', async () => {
    mock.disk = '{not json';
    const s = await load();
    expect(s.getMomentLessonsState()).toEqual({ hydrated: true, learningOn: true, lessons: [] });
  });

  it('an account change forgets everything in memory and does not write', async () => {
    const s = await load();
    s.approveLessonFromReplay(fromReplay('Eat first.'));
    await flush();
    const writes = mock.writes;
    for (const l of mock.scopeListeners) l();
    expect(s.getMomentLessonsState()).toEqual({ hydrated: false, learningOn: true, lessons: [] });
    expect(mock.writes).toBe(writes);
  });

  it('delete everything empties the lessons and keeps the switch', async () => {
    const s = await load();
    s.approveLessonFromReplay(fromReplay('Eat first.'));
    s.deleteAllLessons();
    expect(s.getMomentLessonsState()).toMatchObject({ learningOn: true, lessons: [] });
  });
});

describe('lessons stay inside their own file', () => {
  it('reads nothing from scoring, hydration or the network', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(__dirname, '..', 'momentLessons.ts'), 'utf8');
    const imports = src.split('\n').filter((l) => /^import /.test(l)).join('\n');
    expect(imports).not.toMatch(/scoring|statusColor|hydroState(?!Model)|realApi|analytics|fetch|engine/i);
    expect(src).not.toMatch(/fetch\(|XMLHttpRequest/);
  });
});
