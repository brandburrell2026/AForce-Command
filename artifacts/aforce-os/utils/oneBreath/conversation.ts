/**
 * One Breath conversation — what the conversation screen shows for a run of
 * turns (pure).
 *
 * The approved prototype runs One Breath as one screen: the member's words,
 * AFORCE's reply, what it heard, numbered steps, and the bar to answer. This
 * file turns the session's turns into those items. It decides nothing and
 * writes nothing.
 *
 * Truthfulness is built in. A "Sealed" or "Logged" step is shown only for an
 * effect the owning service has reported as done (`done`); until then the
 * same step reads as in progress, and if it failed it says so. Nothing here
 * can show a save, a log or a send that did not happen.
 */
import type { LogLine } from '@/components/oneBreath/kit';
import type { OneBreathEffect, OneBreathInput, OneBreathState, OneBreathTurn, PlanDraft } from './session';

export interface ConversationEntry {
  input: OneBreathInput;
  turn: OneBreathTurn;
}

export type ConversationItem =
  /** The member's own words. */
  | { kind: 'me'; key: string; text: string }
  /** AFORCE's reply. `choices` are buttons that answer it. */
  | { kind: 'ai'; key: string; text: string; choices?: string[] }
  /** "What I heard": the plan as understood, before anything is saved. */
  | { kind: 'heard'; key: string; rows: { label: string; value: string }[] }
  /** One real step. */
  | { kind: 'step'; key: string; line: LogLine }
  /** The plan's steps, shown for review before the seal bar. */
  | { kind: 'plan'; key: string; rows: PlanRow[]; note?: string }
  /** A fact repeated from its owner, with the card that shows it. */
  | { kind: 'result'; key: string; value: number; word: string; estimated: boolean }
  /** Undo, while it is still open. */
  | { kind: 'undo'; key: string; reverses: string; lasts: string };

export interface ConversationView {
  items: ConversationItem[];
  /** True while a complete plan is waiting for "seal it": the seal bar is shown. */
  awaitingSeal: boolean;
  /** The plan the seal bar would save. */
  plan?: PlanDraft;
}

/** One reviewed step of the plan: when, and what. */
export interface PlanRow {
  at: string;
  text: string;
}

/**
 * Effects whose owner has answered: carried out, or refused. Anything absent
 * is still in progress. Keyed by `effectKey`: one attempt, one answer, so a
 * plan sealed again after an Undo or a failure is its own step.
 */
export interface EffectResults {
  done: ReadonlySet<string>;
  failed: ReadonlySet<string>;
}

/** The key for one attempt at an effect: the turn it came from, and its id. */
export const effectKey = (turnIndex: number, effectId: string) => `${turnIndex}:${effectId}`;

/** What only the screen that owns the session can know right now. */
export interface ConversationLive {
  /** The session as it stands. Undo is offered only while its window is still open here. */
  state: OneBreathState;
  /** The waiting plan's steps from the preparation service, exactly as they would be saved. */
  planRows?: readonly PlanRow[];
  planNote?: string;
  /** Why the waiting plan cannot be sealed as it stands, in its owner's words. */
  planError?: string;
}

const WRITE_STEP: Partial<Record<OneBreathEffect['kind'], { label: string; saving: string; failed: string }>> = {
  save_moment: { label: 'Sealed', saving: 'Sealing', failed: 'Not sealed' },
  log_drink: { label: 'Logged', saving: 'Logging', failed: 'Not logged' },
  lock_in: { label: 'Locked in', saving: 'Locking in', failed: 'Not locked in' },
  undo_moment: { label: 'Seal undone', saving: 'Undoing', failed: 'Still sealed' },
};

/** What a step says once its owner has answered. */
function stepText(effect: OneBreathEffect, state: 'done' | 'failed' | 'saving'): string {
  const what = effectText(effect);
  if (effect.kind === 'undo_moment') return state === 'done' ? 'Your plan is waiting.' : state === 'failed' ? 'That didn’t go through. Your plan is still sealed.' : '';
  if (effect.kind === 'lock_in') return state === 'failed' ? 'That didn’t go through. Nothing changed.' : '';
  return state === 'failed' ? `That didn’t go through. ${what} Nothing was saved.` : state === 'done' ? `Saved once. ${what}` : what;
}

const heardRows = (plan: PlanDraft): { label: string; value: string }[] =>
  [
    { label: 'Moment', value: plan.title },
    { label: 'Day', value: plan.day ?? '' },
    { label: 'Time', value: plan.time ?? '' },
    { label: 'Goal', value: plan.goal ?? '' },
  ].filter((r) => r.value);

const secondsLabel = (ms: number) => `${Math.round(ms / 1000)} seconds`;

/** The owner's words about credit, taken from a "Logged …" reply for this drink. */
function creditNote(replyText: string, effect: Extract<OneBreathEffect, { kind: 'log_drink' }>): string {
  const lead = `Logged ${effect.oz} oz ${effect.name ?? 'drink'}.`;
  return replyText.startsWith(lead) ? replyText.slice(lead.length).trim() : '';
}

function effectText(effect: OneBreathEffect): string {
  if (effect.kind === 'save_moment') return `${effect.plan.title} · ${effect.plan.day} ${effect.plan.time}.`;
  if (effect.kind === 'log_drink') return `${effect.oz} oz ${effect.name ?? 'drink'}.`;
  return '';
}

export function conversationView(entries: readonly ConversationEntry[], results: EffectResults, live?: ConversationLive): ConversationView {
  const items: ConversationItem[] = [];
  let step = 0;

  entries.forEach(({ input, turn }, i) => {
    const key = `t${i}`;
    const last = i === entries.length - 1;
    if (input.kind === 'say') items.push({ kind: 'me', key: `${key}-me`, text: input.words });

    const { reply, effects } = turn;
    const writes = effects.filter((e) => WRITE_STEP[e.kind]);

    // A read-back shows what was heard before it asks for approval.
    if ((reply.outcome === 'read_back' || reply.outcome === 'safety') && turn.state.pendingPlan) {
      items.push({ kind: 'heard', key: `${key}-heard`, rows: heardRows(turn.state.pendingPlan) });
    }

    // The reply itself. A write is not announced in words here: its step below
    // says so, and only once it has really happened.
    const text = writes.length > 0 ? '' : reply.text;
    if (text) items.push({ kind: 'ai', key: `${key}-ai`, text, choices: last ? reply.choices : undefined });

    // HydroState repeated from its owner.
    const claim = reply.request === 'status' ? reply.claims?.[0] : undefined;
    const match = claim ? /^HydroState (\d+), (.+)\.$/.exec(claim.text) : null;
    if (match) items.push({ kind: 'result', key: `${key}-result`, value: Number(match[1]), word: match[2]!, estimated: !!claim!.estimate });

    for (const effect of writes) {
      const words = WRITE_STEP[effect.kind]!;
      const k = effectKey(i, effect.id);
      const state = results.done.has(k) ? 'done' : results.failed.has(k) ? 'failed' : 'saving';
      step += 1;
      const by = input.kind === 'say' ? `By you · ${input.via}` : 'By you';
      items.push({
        kind: 'step',
        key: `${key}-${effect.id}`,
        line: {
          n: step,
          label: state === 'done' ? words.label : state === 'failed' ? words.failed : words.saving,
          note: by,
          text: stepText(effect, state),
          // What the hydration rules say about credit, repeated only once the log is real.
          ...(state === 'done' && effect.kind === 'log_drink' && creditNote(reply.text, effect) ? { detail: creditNote(reply.text, effect) } : {}),
          tone: state === 'done' ? 'accent' : 'waiting',
        },
      });
    }

    // Undo is offered only on the latest turn, while its window is the live one.
    if (last && reply.undo) {
      const pending = effects.every((e) => !results.failed.has(effectKey(i, e.id)));
      // With the live session, Undo shows only while the session would still honour it.
      const open = live ? !!(live.state.pendingDrink || live.state.sealUndo) : true;
      if (pending && open) items.push({ kind: 'undo', key: `${key}-undo`, reverses: reply.undo.reverses, lasts: secondsLabel(reply.undo.ms) });
    }
  });

  const latest = entries[entries.length - 1]?.turn;
  // After a failed save or an Undo the live session holds the plan again.
  const plan = live ? live.state.pendingPlan : latest?.state.pendingPlan;
  const asking = live ? live.state.asking : latest?.state.asking;
  const complete = !!plan && !!plan.date && !!plan.time24 && !asking;
  // A plan its owner would refuse is not offered for sealing: the reason is shown instead.
  if (complete && live?.planError) items.push({ kind: 'ai', key: `plan-error-${entries.length}`, text: live.planError });
  const awaitingSeal = complete && !live?.planError;
  // The steps are reviewed before the seal: they are what the seal saves.
  if (awaitingSeal && live?.planRows) {
    items.push({ kind: 'plan', key: `plan-${entries.length}`, rows: [...live.planRows], ...(live.planNote ? { note: live.planNote } : {}) });
  }
  return { items, awaitingSeal, plan: awaitingSeal ? plan : undefined };
}

/** The status word for the top of the screen, from the latest turn and whether a write is still in progress. */
export function conversationStatus(entries: readonly ConversationEntry[], results: EffectResults, listening: boolean): string {
  if (listening) return 'Listening';
  const latest = entries[entries.length - 1]?.turn;
  if (!latest) return 'Standby';
  const at = entries.length - 1;
  const working = latest.effects.some((e) => WRITE_STEP[e.kind] && !results.done.has(effectKey(at, e.id)) && !results.failed.has(effectKey(at, e.id)));
  if (working) return 'Operating';
  if (latest.status === 'quiet') return 'Quiet';
  return 'Standby';
}
