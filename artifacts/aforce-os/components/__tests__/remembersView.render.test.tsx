// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/Icon', () => ({ Icon: () => null }));
vi.mock('@/components/ui', () => ({ AFScreen: ({ children, testID }: { children: React.ReactNode; testID?: string }) => <div data-testid={testID}>{children}</div> }));

import { RemembersView, type RemembersViewProps } from '../remembers/RemembersView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let props: RemembersViewProps;
const el = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const tap = async (id: string) => {
  const target = el(id);
  if (!target) throw Error(`No element: ${id}`);
  await act(async () => target.click());
};
const render = async (over: Partial<RemembersViewProps> = {}) => {
  props = { ...props, ...over };
  await act(async () => root.render(<RemembersView {...props} />));
};
const type = (id: string, value: string) => {
  const input = el(id) as HTMLTextAreaElement;
  const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  props = {
    backLabel: 'Back',
    onBack: vi.fn(),
    learningOn: true,
    onLearning: vi.fn(),
    lessons: [
      { id: 'a', text: 'Lay out my gear the night before.', on: true, meta: 'On · Training Moments only · from your Replay on Nov 5 · you approved' },
      { id: 'b', text: 'Eat before I leave.', on: false, meta: 'Paused · Personal Moments only · your own rule · you approved' },
    ],
    onLessonOn: vi.fn(),
    onLessonEdit: vi.fn(() => true),
    onLessonDelete: vi.fn(),
    replays: [
      { id: 'm1', title: 'Morning lift · Nov 5', said: 'Not really · Ran out of gas', hasLesson: true },
      { id: 'm2', title: 'Team dinner · Nov 4', said: 'Yes, it worked', hasLesson: false },
    ],
    onReplayDelete: vi.fn(),
    onDeleteAll: vi.fn(),
  };
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('What AFORCE remembers', () => {
  it('says what it is, that it is private, and where it is kept', async () => {
    await render();
    expect(host.textContent).toContain('PRIVATE · ONLY YOU');
    expect(host.querySelector('[role="heading"]')?.textContent).toBe('What AFORCE remembers');
    expect(host.textContent).toContain('Only what you approved. Kept on this phone.');
    expect(host.textContent).toContain('They change no hydration target, score or reminder.');
  });

  it('shows each lesson with its state, scope, source and approval', async () => {
    await render();
    expect(el('remembers-lesson-a')?.textContent).toContain('Lay out my gear the night before.');
    expect(el('remembers-lesson-a')?.textContent).toContain('On · Training Moments only · from your Replay on Nov 5 · you approved');
    expect(el('remembers-lesson-a-toggle')?.textContent).toBe('Pause');
    expect(el('remembers-lesson-b-toggle')?.textContent).toBe('Resume');
  });

  it('the Learning switch reads as a switch and reports the new state', async () => {
    await render();
    const sw = el('remembers-learning')!;
    expect(sw.getAttribute('role')).toBe('switch');
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await tap('remembers-learning');
    expect(props.onLearning).toHaveBeenCalledWith(false);
    await render({ learningOn: false });
    expect(el('remembers-learning')!.getAttribute('aria-checked')).toBe('false');
    expect(host.textContent).toContain('Off · Replay saves notes only. Your lessons are kept and not used');
  });

  it('pause and resume', async () => {
    await render();
    await tap('remembers-lesson-a-toggle');
    expect(props.onLessonOn).toHaveBeenCalledWith('a', false);
    await tap('remembers-lesson-b-toggle');
    expect(props.onLessonOn).toHaveBeenCalledWith('b', true);
  });

  it('edit starts from the member\'s wording and saves only on Approve', async () => {
    await render();
    await tap('remembers-lesson-a-edit');
    expect((el('remembers-lesson-a-input') as HTMLTextAreaElement).value).toBe('Lay out my gear the night before.');
    type('remembers-lesson-a-input', 'Pack my bag the night before.');
    expect(props.onLessonEdit).not.toHaveBeenCalled();
    await tap('remembers-lesson-a-save');
    expect(props.onLessonEdit).toHaveBeenCalledWith('a', 'Pack my bag the night before.');
    expect(el('remembers-lesson-a-input')).toBeNull();
  });

  it('edit can be cancelled, and stays open when the wording is refused', async () => {
    await render({ onLessonEdit: vi.fn(() => false) });
    await tap('remembers-lesson-a-edit');
    await tap('remembers-lesson-a-save');
    expect(el('remembers-lesson-a-input')).toBeTruthy();
    await tap('remembers-lesson-a-edit-cancel');
    expect(el('remembers-lesson-a-input')).toBeNull();
  });

  it('delete asks first, in place, and can be cancelled', async () => {
    await render();
    await tap('remembers-lesson-a-delete');
    expect(props.onLessonDelete).not.toHaveBeenCalled();
    expect(el('remembers-lesson-a-confirm')?.getAttribute('role')).toBe('alert');
    await tap('remembers-lesson-a-delete-cancel');
    expect(el('remembers-lesson-a-confirm')).toBeNull();
    await tap('remembers-lesson-a-delete');
    await tap('remembers-lesson-a-delete-yes');
    expect(props.onLessonDelete).toHaveBeenCalledWith('a');
  });

  it('deleting a Replay that made a lesson lets the member keep the lesson', async () => {
    await render();
    await tap('remembers-replay-m1-delete');
    expect(el('remembers-replay-m1-confirm')?.textContent).toContain('Delete both, or keep the lesson as your own rule?');
    await tap('remembers-replay-m1-keep-lesson');
    expect(props.onReplayDelete).toHaveBeenCalledWith('m1', true);
    await tap('remembers-replay-m1-delete');
    await tap('remembers-replay-m1-delete-both');
    expect(props.onReplayDelete).toHaveBeenCalledWith('m1', false);
  });

  it('deleting a Replay without a lesson is one plain question', async () => {
    await render();
    await tap('remembers-replay-m2-delete');
    expect(el('remembers-replay-m2-keep-lesson')).toBeNull();
    await tap('remembers-replay-m2-delete-yes');
    expect(props.onReplayDelete).toHaveBeenCalledWith('m2', false);
  });

  it('delete everything asks first', async () => {
    await render();
    await tap('remembers-delete-all');
    expect(props.onDeleteAll).not.toHaveBeenCalled();
    await tap('remembers-delete-all-yes');
    expect(props.onDeleteAll).toHaveBeenCalledTimes(1);
  });

  it('empty: says how a lesson gets here, and offers nothing to delete', async () => {
    await render({ lessons: [], replays: [] });
    expect(el('remembers-lessons-empty')?.textContent).toBe('Nothing yet. Write a rule after a Replay and it shows up here.');
    expect(el('remembers-replays-empty')?.textContent).toBe('No Replays saved. Skipped Replays leave nothing behind.');
    expect(el('remembers-delete-all')).toBeNull();
  });

  it('every control has a name a screen reader can say', async () => {
    await render();
    await tap('remembers-lesson-b-edit');
    const controls = Array.from(host.querySelectorAll('[role="button"],[role="switch"],textarea,input'));
    expect(controls.length).toBeGreaterThan(8);
    for (const c of controls) expect(c.getAttribute('aria-label')).toBeTruthy();
    expect(el('remembers-lesson-a-delete')!.getAttribute('aria-label')).toBe('Delete lesson: Lay out my gear the night before.');
    expect(el('remembers-back')!.getAttribute('aria-label')).toBe('Go back');
  });

  it('a save problem is announced', async () => {
    await render({ error: 'That Replay could not be deleted. Try again.' });
    expect(el('remembers-error')?.getAttribute('role')).toBe('alert');
  });
});
