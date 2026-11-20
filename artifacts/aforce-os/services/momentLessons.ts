/**
 * momentLessons — the member's own lessons from Replay (Phase 1).
 *
 * A lesson is one sentence the member wrote and approved after a Replay,
 * for one kind of Moment. It lives on this device, under the signed-in
 * account's scoped storage, and nowhere else: no server, no analytics, no
 * Circle.
 *
 * What this file never does:
 *  - write a lesson the member did not type and approve;
 *  - change a plan, a target, a score, an intake or a reminder;
 *  - read anything from the scoring or hydration layers.
 *
 * Room for later: `author` records who worded a lesson. Today the only value
 * is 'member'. A suggestion engine, if one is ever approved, would be a new
 * author value and its own review; nothing here generates or accepts one.
 */
import { useSyncExternalStore } from 'react';

import { MOMENT_LESSON_MAX, MOMENT_LESSON_TEXT_MAX } from '@/config/hydroStateModel';
import type { MomentType } from '@/types/moments';

import { scopedStorage } from './scopedStorage';
import { subscribeUserScope } from './userScope';

const STORAGE_KEY = '@aforce/momentLessons';

const TYPES: readonly MomentType[] = ['work', 'training', 'travel', 'recovery', 'personal', 'performance'];

export interface MomentLesson {
  id: string;
  /** The member's own sentence. */
  text: string;
  /** The one kind of Moment it is for. */
  scope: MomentType;
  /** False while the member has it paused. */
  on: boolean;
  /** Who worded it. Only the member, in this phase. */
  author: 'member';
  /** When the member approved this wording. */
  approvedAtIso: string;
  /** The Replay it came from: an id and a date, never a title. Null once the
   * member deleted that Replay and kept the lesson as their own rule. */
  source: { momentId: string; momentAtIso: string } | null;
  createdAtIso: string;
}

export interface MomentLessonsState {
  hydrated: boolean;
  /** Off: Replay saves notes only and no lesson is offered anywhere. */
  learningOn: boolean;
  lessons: readonly MomentLesson[];
}

let state: MomentLessonsState = { hydrated: false, learningOn: true, lessons: [] };
const listeners = new Set<() => void>();

function publish(next: MomentLessonsState): void {
  state = next;
  for (const l of listeners) l();
}

function persist(): Promise<void> {
  const body = JSON.stringify({ version: 1, learningOn: state.learningOn, lessons: state.lessons });
  return scopedStorage.setItem(STORAGE_KEY, body).catch(() => {});
}

/** The member's sentence, tidied: single spaces, capped. Empty is "nothing". */
export function cleanLessonText(text: string): string | undefined {
  const tidy = text.replace(/\s+/g, ' ').trim().slice(0, MOMENT_LESSON_TEXT_MAX).trim();
  return tidy.length > 0 ? tidy : undefined;
}

function sanitize(raw: unknown): MomentLesson | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const text = typeof r['text'] === 'string' ? cleanLessonText(r['text']) : undefined;
  if (
    typeof r['id'] !== 'string' ||
    !text ||
    !TYPES.includes(r['scope'] as MomentType) ||
    typeof r['on'] !== 'boolean' ||
    // Anything not written by the member is dropped, not shown.
    r['author'] !== 'member' ||
    typeof r['approvedAtIso'] !== 'string' ||
    typeof r['createdAtIso'] !== 'string'
  ) {
    return null;
  }
  const s = r['source'] as Record<string, unknown> | null | undefined;
  const source =
    s && typeof s['momentId'] === 'string' && typeof s['momentAtIso'] === 'string'
      ? { momentId: s['momentId'], momentAtIso: s['momentAtIso'] }
      : null;
  return {
    id: r['id'],
    text,
    scope: r['scope'] as MomentType,
    on: r['on'],
    author: 'member',
    approvedAtIso: r['approvedAtIso'],
    source,
    createdAtIso: r['createdAtIso'],
  };
}

export async function hydrateMomentLessons(): Promise<void> {
  if (state.hydrated) return;
  let learningOn = true;
  let lessons: MomentLesson[] = [];
  try {
    const raw = await scopedStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      const p = parsed as Record<string, unknown>;
      if (typeof p['learningOn'] === 'boolean') learningOn = p['learningOn'];
      if (Array.isArray(p['lessons'])) {
        lessons = p['lessons']
          .map(sanitize)
          .filter((l): l is MomentLesson => l !== null)
          .slice(0, MOMENT_LESSON_MAX);
      }
    }
  } catch {
    lessons = [];
  }
  if (state.hydrated) return; // a write landed while reading; keep it
  publish({ hydrated: true, learningOn, lessons });
}

export function getMomentLessonsState(): MomentLessonsState {
  return state;
}

export function subscribeMomentLessons(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMomentLessons(): MomentLessonsState {
  return useSyncExternalStore(subscribeMomentLessons, getMomentLessonsState, getMomentLessonsState);
}

export function lessonForMoment(lessons: readonly MomentLesson[], momentId: string | undefined): MomentLesson | undefined {
  return momentId ? lessons.find((l) => l.source?.momentId === momentId) : undefined;
}

const newId = () => `lesson-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export type SaveLessonResult = 'saved' | 'empty' | 'off' | 'full' | 'not_ready';

/** The member approved this sentence after a Replay. One lesson per Replay:
 * approving again for the same Moment replaces the wording. */
export function approveLessonFromReplay(input: {
  text: string;
  scope: MomentType;
  momentId: string;
  momentAtIso: string;
  nowIso: string;
}): SaveLessonResult {
  if (!state.hydrated) return 'not_ready';
  if (!state.learningOn) return 'off';
  const text = cleanLessonText(input.text);
  if (!text) return 'empty';
  const existing = lessonForMoment(state.lessons, input.momentId);
  if (!existing && state.lessons.length >= MOMENT_LESSON_MAX) return 'full';
  const lesson: MomentLesson = {
    id: existing?.id ?? newId(),
    text,
    scope: input.scope,
    on: existing?.on ?? true,
    author: 'member',
    approvedAtIso: input.nowIso,
    source: { momentId: input.momentId, momentAtIso: input.momentAtIso },
    createdAtIso: existing?.createdAtIso ?? input.nowIso,
  };
  publish({
    ...state,
    lessons: existing ? state.lessons.map((l) => (l.id === existing.id ? lesson : l)) : [...state.lessons, lesson],
  });
  void persist();
  return 'saved';
}

/** New wording is a new approval. Blank text changes nothing. */
export function editLesson(id: string, text: string, nowIso: string): boolean {
  const tidy = cleanLessonText(text);
  if (!state.hydrated || !tidy || !state.lessons.some((l) => l.id === id)) return false;
  publish({ ...state, lessons: state.lessons.map((l) => (l.id === id ? { ...l, text: tidy, approvedAtIso: nowIso } : l)) });
  void persist();
  return true;
}

export function setLessonOn(id: string, on: boolean): void {
  if (!state.hydrated) return;
  publish({ ...state, lessons: state.lessons.map((l) => (l.id === id ? { ...l, on } : l)) });
  void persist();
}

export function deleteLesson(id: string): void {
  if (!state.hydrated) return;
  publish({ ...state, lessons: state.lessons.filter((l) => l.id !== id) });
  void persist();
}

/** The member deleted a Replay. Its lesson either goes with it, or stays as
 * their own rule with no link back. */
export function releaseLessonFromReplay(momentId: string, keep: boolean): void {
  if (!state.hydrated) return;
  publish({
    ...state,
    lessons: keep
      ? state.lessons.map((l) => (l.source?.momentId === momentId ? { ...l, source: null } : l))
      : state.lessons.filter((l) => l.source?.momentId !== momentId),
  });
  void persist();
}

export function setLearningOn(learningOn: boolean): void {
  if (!state.hydrated) return;
  publish({ ...state, learningOn });
  void persist();
}

export function deleteAllLessons(): void {
  if (!state.hydrated) return;
  publish({ ...state, lessons: [] });
  void persist();
}

// Account change: forget everything in memory. Disk is per account and untouched.
subscribeUserScope(() => {
  publish({ hydrated: false, learningOn: true, lessons: [] });
});
