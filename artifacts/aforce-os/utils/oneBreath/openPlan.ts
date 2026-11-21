/**
 * The open One Breath plan, as the conversation screen shows it (pure).
 *
 * The approved prototype keeps One Breath on one screen in every state. A plan
 * that is sealed, or locked in and in Quiet, is shown there as a row with its
 * state and the few things the member can do next. This file turns the saved
 * Moment into those items. It decides nothing and writes nothing: every action
 * is carried out by the screen through the service that owns it, and a state
 * is shown only from what the Moments store holds.
 *
 * The words are the existing Lock In, Quiet, Plans changed and Heading back
 * screens' own, unchanged.
 */
import { preparationClosed } from '@/services/momentPreparationLifecycle';
import type { Moment } from '@/types/moments';
import type { ConversationItem } from './conversation';
import { LOCK_IN_NOT_YET, lockInOpensInMs } from './lockInWindow';
import { dayLabel, timeLabel } from './planTurn';
import type { PlanDraft } from './session';

/** Saved but not sealed · sealed and waiting for Lock In · locked in, in Quiet. */
export type OpenPlanPhase = 'draft' | 'sealed' | 'quiet';
/** Which part of Quiet is showing. Only the screen holds this; nothing is saved for it. */
export type OpenPlanMode = 'rest' | 'change' | 'return';

export type OpenPlanAction =
  | 'lock_in'
  | 'plans_changed'
  | 'heading_back'
  | 'cancel'
  | 'back_to_quiet'
  | 'emergency'
  | 'call_emergency'
  | 'get_ride'
  | 'contact'
  | 'stay'
  | 'made_it_back'
  | 'uber'
  | 'lyft';

export const OPEN_PLAN_LINES = {
  sealed: 'Your plan is yours.',
  quiet: 'Go perform. Phone down. We’ll be quiet.',
  change: 'What changed?',
  back: 'Made it back. Tap once when you’re in. Your check-in stays private.',
  ride: 'Choose your pickup and destination, confirm and pay in the provider’s app.',
  cancelled: 'Plan cancelled. Your plan has ended. This does not record a return or check-in.',
  lockInFailed: 'Could not enter Quiet. Please try Lock In again.',
  saveFailed: 'Could not save that change. Please try again.',
  openFailed: 'Could not open that app. Contact someone or stay here.',
  contact: 'Phone number. Opens your phone app. No message or status is shared.',
  contactHint: '+1…',
} as const;

/** The one open One Breath plan, if there is one. The latest sealed wins if the store ever holds more. */
export function openOneBreathPlan(moments: readonly Moment[]): Moment | undefined {
  return moments
    .filter((m) => m.preparation?.context === 'one_breath' && !preparationClosed(m.preparation))
    .sort((a, b) => Date.parse(b.preparation!.sealedAtIso || '') - Date.parse(a.preparation!.sealedAtIso || ''))[0];
}

export function openPlanPhase(moment: Moment): OpenPlanPhase {
  const p = moment.preparation;
  if (!p?.sealedAtIso) return 'draft';
  return p.lockedInAtIso ? 'quiet' : 'sealed';
}

const two = (n: number) => String(n).padStart(2, '0');

/**
 * A plan that was saved but never sealed, as the read-back it left off at.
 * The saved Moment's own name, local day and time, and goal; nothing is
 * guessed. Its steps come from the preparation service when it is reviewed.
 */
export function planDraftFromMoment(moment: Moment): PlanDraft | undefined {
  const at = new Date(moment.startAtIso);
  if (!Number.isFinite(at.getTime()) || !moment.title.trim()) return undefined;
  const date = `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
  const time24 = `${two(at.getHours())}:${two(at.getMinutes())}`;
  return { title: moment.title, type: moment.type, date, time24, day: dayLabel(date), time: timeLabel(time24), ...(moment.prepGoal ? { goal: moment.prepGoal } : {}), steps: [], heard: [] };
}

/**
 * True for a saved, unsealed plan the conversation can pick up. A plan that
 * came from the calendar keeps the existing screen, which checks the event
 * has not changed or ended before it is sealed.
 */
export function resumableDraft(moment: Moment | undefined): moment is Moment {
  return !!moment && openPlanPhase(moment) === 'draft' && moment.source !== 'calendar' && !!planDraftFromMoment(moment);
}

/** "Fri, Nov 20 · 6:30 AM", in the phone's own format. */
export function openPlanWhen(startAtIso: string): string {
  const at = new Date(startAtIso);
  if (!Number.isFinite(at.getTime())) return '';
  const day = at.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const time = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/** What the Plans changed safety gate found in the member's words. Never an estimate of anyone's condition. */
export type PlanSafety = 'emergency' | 'driving' | 'water' | 'pause';

/** The existing Plans changed screen's own headline for each. */
export const PLAN_SAFETY_LINES: Record<PlanSafety, string> = {
  emergency: 'Get emergency help now.',
  water: 'Take a break from the water.',
  pause: 'Pause your plan. Contact someone.',
  driving: 'AFORCE can’t assess whether you’re able to drive.',
};

/** A phone number as typed, reduced to what a dialler takes. Null when it is not one. */
export function contactNumber(typed: string): string | null {
  const digits = typed.replace(/[ ()-]/g, '');
  return /^\+?[0-9]{3,15}$/.test(digits) ? typed.replace(/[^+0-9]/g, '') : null;
}

export interface OpenPlanView {
  moment: Moment;
  mode: OpenPlanMode;
  nowMs: number;
  /** Set when what the member typed under "What changed?" tripped the safety gate. */
  safety?: PlanSafety;
  /** "Contact someone" was tapped: the bar is waiting for a phone number. */
  contact?: boolean;
  /** The action being carried out right now: its buttons wait. */
  working?: OpenPlanAction;
  /** What the owner said when the last action did not go through. */
  error?: string;
}

type Action = { id: OpenPlanAction; label: string; primary?: boolean };

/** The items for an open plan: its row, the line for its state, and the actions. */
export function openPlanItems(view: OpenPlanView): ConversationItem[] {
  const { moment, nowMs } = view;
  const phase = openPlanPhase(moment);
  if (phase === 'draft') return [];
  const p = moment.preparation!;
  const items: ConversationItem[] = [
    { kind: 'moment', key: 'op-row', title: moment.title, when: openPlanWhen(moment.startAtIso), pill: phase === 'quiet' ? 'Locked in' : 'Sealed' },
  ];
  const say = (key: string, text: string) => items.push({ kind: 'ai', key, text });
  const offer = (key: string, actions: Action[], note?: string) =>
    items.push({ kind: 'actions', key, actions: actions.map((a) => ({ ...a, disabled: !!view.working })), ...(note ? { note } : {}) });

  if (phase === 'sealed') {
    const waiting = lockInOpensInMs(moment.startAtIso, nowMs) > 0;
    say('op-sealed', waiting ? `${OPEN_PLAN_LINES.sealed} ${LOCK_IN_NOT_YET}` : OPEN_PLAN_LINES.sealed);
    if (!waiting) offer('op-sealed-actions', [{ id: 'lock_in', label: 'Lock In', primary: true }]);
  } else if (view.mode === 'change' && view.safety) {
    // Safety first, in the existing screen's words and with its choices.
    say('op-safety', PLAN_SAFETY_LINES[view.safety]);
    offer('op-safety-actions', [
      view.safety === 'emergency'
        ? { id: 'call_emergency', label: `Call ${p.emergencyNumber}`, primary: true }
        : { id: 'get_ride', label: 'Get a ride', primary: true },
      { id: 'contact', label: 'Contact someone' },
      { id: 'stay', label: 'Stay here' },
      ...(view.safety === 'emergency' ? [] : [{ id: 'emergency' as const, label: `Emergency? ${p.emergencyNumber}` }]),
    ]);
    if (view.contact) say('op-contact', OPEN_PLAN_LINES.contact);
  } else if (view.mode === 'change') {
    say('op-change', OPEN_PLAN_LINES.change);
    offer('op-change-actions', [
      { id: 'cancel', label: 'My plan is cancelled' },
      { id: 'back_to_quiet', label: 'Back to Quiet' },
      { id: 'emergency', label: `Emergency? ${p.emergencyNumber}` },
    ]);
  } else if (view.mode === 'return') {
    const ride = p.destination ? ` ${p.returnMethod} · ${p.destination}` : '';
    say('op-return', `${OPEN_PLAN_LINES.back}${ride}`);
    offer(
      'op-return-actions',
      [
        { id: 'made_it_back', label: 'Made it back ✓', primary: true },
        { id: 'uber', label: 'Open Uber' },
        { id: 'lyft', label: 'Open Lyft' },
        { id: 'back_to_quiet', label: 'Back to Quiet' },
      ],
      OPEN_PLAN_LINES.ride,
    );
  } else {
    say('op-quiet', OPEN_PLAN_LINES.quiet);
    offer('op-quiet-actions', [
      { id: 'plans_changed', label: 'Plans changed?' },
      { id: 'heading_back', label: 'Heading back?' },
    ]);
  }
  if (view.error) say('op-error', view.error);
  return items;
}
