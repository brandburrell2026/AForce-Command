/**
 * One Breath confirmation window (Complete App Spec v1.8.2, Parts 6.1 and 8.1).
 *
 * Pure, deterministic rules for turning a member's words into a seal, send or
 * share. Nothing here talks to a model, a store or the network: the screen
 * feeds in what was heard and the time, and gets back one effect and the exact
 * copy to show. Voice and typed text go through the same path (CB12).
 *
 * The rules:
 * - A window opens only when a full read-back finishes, for
 *   ONE_BREATH_CONFIRM_WINDOW_MS. Speech never opens or extends one.
 * - Only "seal it" / "lock it in" (seal), "send it" (send) and "share it"
 *   (share) confirm, and only inside an open window.
 * - "Yes", "okay", "approve", "confirm", "sounds good" never confirm; they get
 *   the "Say 'seal it' to confirm." prompt.
 * - Any negation cancels and leaves the plan unsealed.
 * - A change ("make it 7", "no, Saturday") closes the window; the caller
 *   rebuilds the plan and reads it back, which opens the next numbered window.
 * - Holding to seal works whenever a plan is pending, window or not.
 * - Unclear or low-confidence speech never confirms.
 */
import {
  ONE_BREATH_CONFIRM_WINDOW_MS,
  ONE_BREATH_MIN_CONFIRM_CONFIDENCE,
  ONE_BREATH_SEAL_UNDO_MS,
} from '@/config/hydroStateModel';

export type ConfirmIntent = 'seal' | 'send' | 'share';

/** The one recorded way each window ends (Part 8.1.3). */
export type WindowEnd =
  | 'confirmed_by_voice'
  | 'timed_out'
  | 'corrected'
  | 'asked_else'
  | 'said_no'
  | 'sealed_by_hold';

export type Utterance =
  | { kind: 'confirm'; intent: ConfirmIntent; phrase: string }
  | { kind: 'not_a_phrase' }
  | { kind: 'negation' }
  | { kind: 'change' }
  | { kind: 'hear_again' }
  | { kind: 'undo' }
  | { kind: 'unclear' }
  | { kind: 'other' };

export type WindowPhase = 'reading' | 'open' | 'closed';

export interface WindowState {
  intent: ConfirmIntent;
  phase: WindowPhase;
  /** Number of the most recently opened window (0 before the first opens). */
  number: number;
  /** When the open window closes; null unless phase is 'open'. */
  closesAtMs: number | null;
  /** One entry per window that has ended, in order. */
  history: ReadonlyArray<{ number: number; end: WindowEnd }>;
}

/** What the screen must do with a heard or typed line. */
export type WindowEffect =
  | 'confirm' // seal / send / share now (deliberate approval)
  | 'cancel' // leave the plan unsealed; show "Nothing saved."
  | 'rebuild' // apply the change, then beginReadBack()
  | 'answer' // answer the question, then beginReadBack() (Part 8.1.7)
  | 'read_again' // beginReadBack(): "Hear it again"
  | 'undo' // reverse a seal still inside its undo window
  | 'none';

export interface HeardResult {
  state: WindowState;
  effect: WindowEffect;
  /** Copy to show (and speak) for this turn; empty when there is nothing to say. */
  message: string;
}

const PHRASES: Record<ConfirmIntent, readonly string[]> = {
  seal: ['seal it', 'lock it in'],
  send: ['send it'],
  share: ['share it'],
};

const DONE_WORD: Record<ConfirmIntent, string> = {
  seal: 'sealed',
  send: 'sending',
  share: 'sharing',
};

const DAY = '(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight)';
const TIME = '(\\d{1,2}(:\\d{2})?\\s*(am|pm|a\\.m\\.|p\\.m\\.)?|noon|midnight)';
const HAS_DAY = new RegExp(`\\b${DAY}\\b`);
const HAS_TIME = new RegExp(`\\b${TIME}\\b`);
const CHANGE_VERB =
  /\b(make it|move it|change it|push it|switch it|shift it|bump it)\b|\bcan i (go|do it|lift|train|start)\b|\binstead\b/;
const LEADING_CORRECTION = /^(no|nope|nah)\b/;
const NEGATION = /\b(don'?t|do not|not yet|wait|no|nope|cancel|stop|hold on|never ?mind)\b/;
const NOT_A_PHRASE =
  /\b(approve|approved|confirm|confirmed|yes|yeah|yep|ok|okay|sounds good|do it|go ahead|sure)\b/;
const HEAR_AGAIN = /\b(hear it again|read it (back )?again|say (it|that) again|repeat (it|that))\b/;

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9:'.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Classify one heard or typed line. `confidence` is the recognizer's score for
 * spoken input (omit it for typed text); below the configured floor the line is
 * 'unclear' and can never confirm.
 */
export function classifyUtterance(text: string, confidence?: number): Utterance {
  const t = normalize(text);
  if (!t) return { kind: 'unclear' };
  if (confidence !== undefined && confidence < ONE_BREATH_MIN_CONFIRM_CONFIDENCE) {
    return { kind: 'unclear' };
  }
  if (/^undo\b/.test(t)) return { kind: 'undo' };
  if (HEAR_AGAIN.test(t)) return { kind: 'hear_again' };
  const names = HAS_DAY.test(t) || HAS_TIME.test(t);
  if (names && (CHANGE_VERB.test(t) || LEADING_CORRECTION.test(t))) return { kind: 'change' };
  // Negation wins over a phrase: "don't seal it" must never seal.
  if (NEGATION.test(t)) return { kind: 'negation' };
  for (const intent of Object.keys(PHRASES) as ConfirmIntent[]) {
    const phrase = PHRASES[intent].find((p) => new RegExp(`\\b${p}\\b`).test(t));
    if (phrase) return { kind: 'confirm', intent, phrase };
  }
  if (NOT_A_PHRASE.test(t)) return { kind: 'not_a_phrase' };
  return { kind: 'other' };
}

/** "Say 'seal it' to confirm." for the pending intent. */
export const sayPhrasePrompt = (intent: ConfirmIntent) => `Say '${PHRASES[intent][0]}' to confirm.`;

/** The member-visible line for each recorded end state (Part 8.1.3). */
export function windowEndLine(end: WindowEnd, intent: ConfirmIntent, phrase?: string): string {
  switch (end) {
    case 'confirmed_by_voice':
      return `Heard '${phrase ?? PHRASES[intent][0]}' inside the window · ${DONE_WORD[intent]}`;
    case 'timed_out':
      return `Closed after ${Math.round(ONE_BREATH_CONFIRM_WINDOW_MS / 1000)} seconds · nothing heard`;
    case 'corrected':
      return 'Closed · you corrected the plan';
    case 'asked_else':
      return 'Closed · you asked something else';
    case 'said_no':
      return 'Closed · you said no';
    case 'sealed_by_hold':
      return 'Closed · sealed by hold';
  }
}

export function initialWindow(intent: ConfirmIntent = 'seal'): WindowState {
  return { intent, phase: 'closed', number: 0, closesAtMs: null, history: [] };
}

const end = (s: WindowState, how: WindowEnd): WindowState =>
  s.phase === 'open'
    ? { ...s, phase: 'closed', closesAtMs: null, history: [...s.history, { number: s.number, end: how }] }
    : { ...s, phase: s.phase === 'reading' ? 'closed' : s.phase, closesAtMs: null };

/** A read-back is starting. Any open window closes without a new end state
 *  (callers end it first with the right reason via heard()). */
export function beginReadBack(s: WindowState): WindowState {
  return { ...s, phase: 'reading', closesAtMs: null };
}

/** The full read-back finished: open the next numbered window. */
export function readBackFinished(s: WindowState, nowMs: number): WindowState {
  if (s.phase !== 'reading') return s;
  return { ...s, phase: 'open', number: s.number + 1, closesAtMs: nowMs + ONE_BREATH_CONFIRM_WINDOW_MS };
}

/** Advance the clock: an open window past its end closes as 'timed_out'. */
export function tick(s: WindowState, nowMs: number): WindowState {
  if (s.phase === 'open' && s.closesAtMs !== null && nowMs >= s.closesAtMs) return end(s, 'timed_out');
  return s;
}

/** Whole seconds left in the open window (for the countdown), else 0. */
export function secondsLeft(s: WindowState, nowMs: number): number {
  if (s.phase !== 'open' || s.closesAtMs === null) return 0;
  return Math.max(0, Math.ceil((s.closesAtMs - nowMs) / 1000));
}

/** The strip under the plan (Part 8.1.1–2). */
export function windowStrip(s: WindowState, nowMs: number): string {
  if (s.phase === 'reading') return 'Listening opens after the read-back.';
  if (s.phase === 'open') {
    const p = PHRASES[s.intent][0];
    return `Listening for '${p.charAt(0).toUpperCase()}${p.slice(1)}' · ${secondsLeft(s, nowMs)}s`;
  }
  return '';
}

/** "Confirmation window 2 · open" */
export const windowOpenLine = (s: WindowState) => `Confirmation window ${s.number} · open`;

/** Holding to seal is deliberate and needs no window (Part 8.1.8). */
export function sealedByHold(s: WindowState): WindowState {
  if (s.phase === 'open') return end(s, 'sealed_by_hold');
  return {
    ...s,
    phase: 'closed',
    closesAtMs: null,
    history: [...s.history, { number: s.number, end: 'sealed_by_hold' }],
  };
}

/**
 * Apply one heard or typed line while a plan, message or share is pending.
 * The clock is applied first, so a phrase that lands after the window closed
 * is treated as outside it.
 */
export function heard(prev: WindowState, u: Utterance, nowMs: number): HeardResult {
  const s = tick(prev, nowMs);
  switch (u.kind) {
    case 'unclear':
      return { state: s, effect: 'none', message: "I didn't catch that." };
    case 'undo':
      return { state: s, effect: 'undo', message: '' };
    case 'confirm': {
      if (u.intent !== s.intent) return { state: s, effect: 'none', message: sayPhrasePrompt(s.intent) };
      if (s.phase !== 'open') {
        return {
          state: s,
          effect: 'none',
          message: `Heard '${u.phrase}' outside the window · nothing happened.`,
        };
      }
      return {
        state: end(s, 'confirmed_by_voice'),
        effect: 'confirm',
        message: windowEndLine('confirmed_by_voice', s.intent, u.phrase),
      };
    }
    case 'not_a_phrase':
      return { state: s, effect: 'none', message: sayPhrasePrompt(s.intent) };
    case 'negation':
      return { state: end(s, 'said_no'), effect: 'cancel', message: 'Nothing saved.' };
    case 'change':
      return { state: end(s, 'corrected'), effect: 'rebuild', message: '' };
    case 'hear_again':
      // Only a closed window can be reopened, and only by a fresh read-back.
      return s.phase === 'closed'
        ? { state: s, effect: 'read_again', message: '' }
        : { state: s, effect: 'none', message: '' };
    case 'other':
      return { state: end(s, 'asked_else'), effect: 'answer', message: '' };
  }
}

/** Whether a seal made at `sealedAtMs` can still be undone. */
export const sealUndoAvailable = (sealedAtMs: number, nowMs: number) =>
  nowMs >= sealedAtMs && nowMs - sealedAtMs < ONE_BREATH_SEAL_UNDO_MS;

/* ─── Read-backs (Part 6.1.1) ─────────────────────────────────────────────── */

const dayKey = (ms: number, timeZone?: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);

/** "today", "tomorrow", "Saturday" (within a week) or "Sat, Nov 21". */
export function dayPhrase(startMs: number, nowMs: number, timeZone?: string): string {
  const start = dayKey(startMs, timeZone);
  if (start === dayKey(nowMs, timeZone)) return 'today';
  if (start === dayKey(nowMs + 86_400_000, timeZone)) return 'tomorrow';
  if (startMs > nowMs && startMs - nowMs < 6 * 86_400_000) {
    return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(startMs);
  }
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(
    startMs,
  );
}

const clockText = (ms: number, timeZone?: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(ms);

/**
 * "Morning lift, tomorrow at 6:30 AM. Nothing changed from last time. Say
 * 'seal it' to lock it in." `delta` is the Decision Delta line when there is a
 * comparable earlier plan; omit it otherwise.
 */
export function planReadBack(args: {
  title: string;
  startAtIso: string;
  nowMs: number;
  timeZone?: string;
  delta?: string;
}): string {
  const start = Date.parse(args.startAtIso);
  const parts = [`${args.title.trim()}, ${dayPhrase(start, args.nowMs, args.timeZone)} at ${clockText(start, args.timeZone)}.`];
  if (args.delta?.trim()) parts.push(args.delta.trim().replace(/\.?$/, '.'));
  parts.push("Say 'seal it' to lock it in.");
  return parts.join(' ');
}

/** "Sending Annette: I'm heading home. Say 'send it.'" */
export const messageReadBack = (recipient: string, text: string) =>
  `Sending ${recipient.trim()}: ${text.trim().replace(/([^.!?])$/, '$1.')} Say 'send it.'`;

/** "Sharing your lift plan with Annette. Say 'share it.'" */
export const shareReadBack = (recipient: string, what: string) =>
  `Sharing ${what.trim()} with ${recipient.trim()}. Say 'share it.'`;
