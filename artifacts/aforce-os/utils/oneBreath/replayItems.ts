/**
 * Replay on the One Breath conversation screen (pure).
 *
 * After "Made it back" the one Replay question is asked here, as the approved
 * prototype keeps it on the same screen. The steps, the choices and every
 * word are the existing Replay's (`utils/replayFollowUp`); this file only
 * lays them out as conversation items. It decides nothing and saves nothing.
 */
import type { Moment } from '@/types/moments';
import { lessonScopeLabel } from '@/utils/lessonPresentation';
import { REPLAY_ANSWERS, replayNoteLine, replayObstacleOptions, replayStep, type ReplayStep } from '@/utils/replayFollowUp';
import type { ConversationItem, PlanRow } from './conversation';

export type ReplayEditing = 'ask' | 'other' | 'rule' | null;

export const REPLAY_LINES = {
  ask: 'Did that plan work for you? Private. Only you see this.',
  miss: 'What got in the way? Pick one, or skip. It stays a private note. Your next plan stays the same.',
  other: 'In your words. Saved as a private note on this phone. It never becomes a rule.',
  otherHint: 'What got in the way?',
  yes: 'Same plan next time. AFORCE won’t change what’s working. Your answer is saved as a private note.',
  skipped: 'Skipped. No answer saved. This Replay is closed.',
  noted: 'Saved as a note. Your next plan stays the same. Your answer is a private note only.',
  ruleHint: 'In your own words',
  learningOff: 'Learning is off, so Replay saves notes only.',
  full: 'You have the most lessons this phone keeps. Delete one in What AFORCE remembers first.',
  failed: 'That did not save. Try again.',
} as const;

export const replayRuleLine = (scope: string) =>
  `Your rule for next time. Only for ${scope}. Kept on this phone, private to you. It is offered on a matching plan and joins only if you add it. It changes no target or score.`;

export interface ReplayView {
  moment: Moment;
  editing: ReplayEditing;
  /** "Good night." or "Enjoy the rest of your day.", from the existing Return screen. */
  returnLabel: string;
  /** The member's own rule for this Moment, if they wrote one. */
  lessonText?: string;
  /** Whether learning is on. Undefined until that is known: no rule is offered before then. */
  learningOn?: boolean;
  clock: (iso: string) => string;
  working?: boolean;
  error?: string;
}

/** What the typing bar is for right now, if Replay is waiting on the member's own words. */
export function replayTyping(view: Pick<ReplayView, 'moment' | 'editing'>): 'note' | 'rule' | null {
  const step = replayStep(view.moment.preparation, view.editing);
  return step === 'other' ? 'note' : step === 'rule' ? 'rule' : null;
}

export const replayIsClosed = (step: ReplayStep) => step === 'yes' || step === 'skipped' || step === 'noted';

export function replayItems(view: ReplayView): ConversationItem[] {
  const { moment } = view;
  const prep = moment.preparation;
  if (!prep?.returnedAtIso) return [];
  const step = replayStep(prep, view.editing);
  const items: ConversationItem[] = [{ kind: 'ai', key: 'rp-return', text: view.returnLabel }];
  const say = (key: string, text: string) => items.push({ kind: 'ai', key, text });
  const offer = (key: string, actions: { id: string; label: string; primary?: boolean }[]) =>
    items.push({ kind: 'actions', key, actions: actions.map((a) => ({ ...a, disabled: !!view.working })) });
  const said = replayNoteLine(prep, moment.type);

  if (step === 'ask') {
    const rows: PlanRow[] = prep.steps.map((s) => ({ at: view.clock(s.atIso), text: s.action }));
    if (rows.length > 0) items.push({ kind: 'plan', key: 'rp-plan', rows });
    say('rp-ask', REPLAY_LINES.ask);
    offer('rp-ask-actions', [...REPLAY_ANSWERS.map((a) => ({ id: `replay:${a.value}`, label: a.label })), { id: 'replay:skipped', label: 'Skip' }]);
  } else if (step === 'miss') {
    say('rp-miss', `${said ? `You said: ${said}. ` : ''}${REPLAY_LINES.miss}`);
    offer('rp-miss-actions', [
      ...replayObstacleOptions(moment.type).map((o) => ({ id: o.value === 'other' ? 'replay_other' : `obstacle:${o.value}`, label: o.label })),
      { id: 'obstacle:skipped', label: 'Skip' },
    ]);
  } else if (step === 'other') {
    say('rp-other', REPLAY_LINES.other);
    offer('rp-other-actions', [{ id: 'replay_cancel', label: 'Cancel' }]);
  } else if (step === 'rule') {
    say('rp-rule', replayRuleLine(lessonScopeLabel(moment.type)));
    offer('rp-rule-actions', [{ id: 'replay_cancel', label: 'Cancel' }]);
  } else {
    say('rp-closed', step === 'yes' ? REPLAY_LINES.yes : step === 'skipped' ? REPLAY_LINES.skipped : REPLAY_LINES.noted);
    if (step === 'noted' && said) say('rp-said', `You said: ${said}`);
    if (step === 'noted' && view.lessonText) say('rp-lesson', `Your rule for next time: ${view.lessonText}`);
    if (step === 'noted' && view.learningOn === false) say('rp-off', REPLAY_LINES.learningOff);
    offer('rp-closed-actions', [
      ...(step === 'noted' && view.learningOn ? [{ id: 'replay_rule', label: view.lessonText ? 'Edit your rule' : 'Write a rule for next time' }] : []),
      { id: 'replay_change', label: 'Change answer' },
      ...(step === 'noted' ? [{ id: 'remembers', label: 'What AFORCE remembers' }] : []),
      { id: 'open_moments', label: 'Open Moments' },
    ]);
  }
  if (view.error) say('rp-error', view.error);
  return items;
}
