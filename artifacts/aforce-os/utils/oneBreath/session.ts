/**
 * One Breath session — the contract for one turn of the governed pipeline
 * (One Breath Final Build Spec, 2026-11-20, "The engine underneath").
 *
 * This file is the harness slice: the types the conversation tests are written
 * against, and a turn function that does nothing yet. No screen calls it. The
 * tests in `utils/__tests__/oneBreath/` are marked `it.fails` until the slices
 * that implement each request land.
 *
 * What the contract fixes, so later slices cannot drift:
 *  - Typed and spoken words enter the same way (`via` is recorded, never
 *    branched on for the result).
 *  - A turn returns `effects`: requests to the owning services. This function
 *    never writes HydroState, Moments, Quiet or a Circle itself, and it never
 *    decides drink credit.
 *  - Every effect carries a stable `id`, so a repeat, a double tap or a retry
 *    can only ever be carried out once.
 *  - The status word is derived from the turn, not a second state machine: the
 *    Moment screens keep their own.
 */
import type { MomentType } from '@/types/moments';
import type { Interpreter } from '@/services/oneBreath/interpreter';
import { interpretByRules } from '@/services/oneBreath/rulesInterpreter';
import { ONE_BREATH_SEAL_UNDO_MS } from '@/config/hydroStateModel';
import { classifyUtterance, sayPhrasePrompt } from './confirmationWindow';
import { answerPlanQuestion, changePlan, planComplete, planFromWords, planSealId, type PlanQuestion } from './planTurn';

export type OneBreathStatus = 'standby' | 'listening' | 'operating' | 'responding' | 'quiet';

export type OneBreathRequest =
  | 'open_screen'
  | 'status'
  | 'upcoming'
  | 'log_drink'
  | 'plan_moment'
  | 'lock_in'
  | 'prepare'
  | 'send_message'
  | 'share_plan'
  | 'made_it_back'
  | 'none';

/** What the member gets back for a turn. */
export type OneBreathOutcome =
  /** Done without approval: a read-only answer, an opened screen, or a clear drink logged with Undo. */
  | 'act'
  /** One question, nothing else. */
  | 'ask'
  /** A read-back waiting for the approval the request requires. Nothing is written. */
  | 'read_back'
  /** Sealed, sent or shared after approval. */
  | 'approved'
  /** Lock In asked for with no Moment in its window. */
  | 'not_active'
  /** No reviewed answer, or outside what One Breath does: says so, no guess. */
  | 'limit'
  /** Injury, surgery or a medical issue: plan timing only, suggests a clinician. */
  | 'safety'
  /** Alcohol outside Social: not counted, nothing logged. */
  | 'not_counted'
  /** The same approval repeated: "Already sealed. Nothing changed." */
  | 'already_done'
  /** Model or network unavailable: words kept, nothing saved, retry or type. */
  | 'unavailable'
  /** Undo carried out, or a pending send cancelled. */
  | 'undone'
  /** A cancel, filler or an empty turn: nothing to do and nothing said about the member. */
  | 'nothing'
  /** The harness placeholder. Never shown to a member. */
  | 'not_built';

export type OneBreathInput =
  | { kind: 'say'; words: string; via: 'typed' | 'spoken' }
  /** A control on screen: 'undo', 'log', 'close', 'seal', and so on. */
  | { kind: 'tap'; control: string; value?: string }
  /** A barcode read in HydroScan. `product` is absent when it is not recognized. */
  | { kind: 'scan'; barcode: string; product?: { name: string; categoryId: string; packageOz?: number } }
  /** Time passing, for Undo and outbox windows. */
  | { kind: 'wait'; ms: number };

export interface OneBreathContext {
  nowIso: string;
  /** Social One Breath (Proof Blue) when true. */
  social: boolean;
  /** A sealed Moment is inside its Lock In window right now. */
  momentInWindow: boolean;
  learningOn: boolean;
  /** False simulates the interpreter or the network being unreachable. */
  interpreterReachable: boolean;
  /** False simulates the connection dropping while a send is in the outbox. */
  networkUp: boolean;
  /** The sealed Moment that is in its window, when there is one. Keys the Lock In effect so it happens once. */
  currentMomentId?: string;
  /**
   * HydroState as its owner reports it right now. The session only repeats
   * it. Absent means it could not be read, and the session says so.
   */
  hydroState?: { value: number; word: string; estimated: boolean; source: string; asOf?: string };
  /** Upcoming Moments from the Moments store, soonest first. Absent means the list could not be read. */
  upcoming?: { title: string; day: string; time: string }[];
}

export interface PlanDraft {
  title: string;
  type: MomentType | 'social';
  /** Local day and time as read back, e.g. "Sat" / "7:00 AM". Absent while still missing. */
  day?: string;
  time?: string;
  /** The same day and time as entered, "YYYY-MM-DD" and "HH:mm" local, for the owning service. */
  date?: string;
  time24?: string;
  goal?: string;
  steps: { at: string; label: string }[];
  /** The member's own words, kept for the read-back. */
  heard: string[];
}

export type OneBreathEffect =
  | { kind: 'open_screen'; id: string; screen: string }
  | { kind: 'save_moment'; id: string; plan: PlanDraft }
  | { kind: 'undo_moment'; id: string; of: string }
  | { kind: 'log_drink'; id: string; categoryId: string; name?: string; oz: number }
  | { kind: 'undo_drink'; id: string; of: string }
  | { kind: 'lock_in'; id: string }
  | { kind: 'enter_quiet'; id: string; untilIso?: string }
  | { kind: 'send_message'; id: string; to: string; text: string }
  | { kind: 'share_plan'; id: string; to: string; fields: string[] }
  | { kind: 'made_it_back'; id: string }
  | { kind: 'save_lesson'; id: string; text: string };

export interface OneBreathReply {
  outcome: OneBreathOutcome;
  request: OneBreathRequest;
  /** What is said and shown. */
  text: string;
  /** The single question, when `outcome` is 'ask'. */
  question?: string;
  /** Buttons offered with the reply. */
  choices?: string[];
  /** Any stated fact about the member, each with where it came from. A claim with no source is a defect. */
  claims?: { text: string; source?: string; estimate?: boolean }[];
  /** Undo offered, with exactly what it reverses and for how long. */
  undo?: { reverses: string; ms: number };
}

export interface OneBreathState {
  /** A plan read back and not yet sealed. Survives a topic change. */
  pendingPlan?: PlanDraft;
  /** The one question waiting on the pending plan, when a day or time is missing. */
  asking?: PlanQuestion;
  /** Ids of Moments sealed in this session. */
  sealed: string[];
  /** Sends held before they leave the phone. */
  outbox: { id: string; to: string; text: string; msLeft: number; state: 'pending' | 'sent' | 'cancelled' | 'unknown' }[];
  /** A drink scanned and not yet confirmed as drunk. */
  scanned?: { barcode: string; name?: string; categoryId?: string; oz?: number };
  /** The words of every turn, kept when the interpreter is unreachable. */
  words: string[];
  lockedIn: boolean;
}

export interface OneBreathTurn {
  state: OneBreathState;
  status: OneBreathStatus;
  reply: OneBreathReply;
  /** Requests to the owning services, in order. Empty means nothing was changed. */
  effects: OneBreathEffect[];
}

export const emptyOneBreathState = (): OneBreathState => ({
  sealed: [],
  outbox: [],
  words: [],
  lockedIn: false,
});

/** Screens One Breath can open, by the words members use for them. Keys are for the router to map; no route is decided here. */
const SCREENS: readonly [RegExp, string][] = [
  [/hydroscan|scanner|\bscan\b/, 'scan'],
  [/hydrat/, 'hydration'],
  [/circle/, 'circle'],
  [/remembers/, 'remembers'],
  [/moments?/, 'moments'],
  [/profile/, 'profile'],
  [/settings/, 'settings'],
  [/store|shop/, 'store'],
  [/sleep/, 'sleep'],
  [/recovery/, 'recovery'],
  [/weekly report/, 'weekly_report'],
  [/travel/, 'travel'],
  [/performance signal/, 'performance_signal'],
  [/devices/, 'devices'],
  [/\bhome\b/, 'home'],
];

export function screenNamed(words: string): string | null {
  const t = words.toLowerCase();
  return SCREENS.find(([pattern]) => pattern.test(t))?.[1] ?? null;
}

/** Member-facing lines. From the approved prototype and the spec; wording is for Julius to review before any screen shows it. */
export const ONE_BREATH_LINES = {
  limit:
    "I don\u2019t have a reviewed answer for that, so I won\u2019t guess. I can plan a Moment, log a drink, check your HydroState, message your Circle, or start Lock In.",
  unavailable: "I couldn\u2019t reach AFORCE. Your words are kept and nothing was saved. Try again, or type it.",
  lockInNotActive: "No Moment is starting right now. Lock In opens when your next Moment begins. Want to plan one?",
  lockInStarted: "Locked in.",
  lockInAlready: "Already locked in. Nothing changed.",
  safety:
    "I\u2019ll keep this to timing only. For training around an injury, surgery or a medical issue, check with your clinician.",
  askTime: "What time?",
  askDay: "What day?",
  askChange: "What should change: the day or the time?",
  noPlan: "There\u2019s no plan waiting to be sealed.",
  alreadySealed: "Already sealed. Nothing changed.",
  stillWaiting: "Nothing saved. Your plan is still waiting for you to seal it.",
  statusUnavailable: "I can\u2019t read your HydroState right now, so I won\u2019t guess it.",
  upcomingUnavailable: "I can\u2019t read your Moments right now.",
  upcomingNone: "Nothing is planned yet.",
  askScreen: "Which screen?",
  alcoholNotCounted:
    "Alcohol isn\u2019t counted toward HydroState, so nothing was logged. If you\u2019re heading out, plan it as a Social Moment and I\u2019ll handle it there.",
} as const;

const notBuilt = (state: OneBreathState, request: OneBreathRequest = 'none'): OneBreathTurn => ({
  state,
  status: 'standby',
  reply: { outcome: 'not_built', request, text: '' },
  effects: [],
});

/**
 * One turn.
 *
 * Built so far: unavailable, nothing to do, the honest limit, alcohol outside
 * Social, Lock In inside or outside its window, and planning a Moment (one
 * question at a time, read-back, a spoken or typed change, "seal it" once).
 * A plan is saved only by an explicit "seal it" on a complete read-back.
 * Read-only requests are answered from what the caller supplies: HydroState
 * and upcoming Moments are repeated with their source, never computed here,
 * and a screen is opened by key.
 * Every other request is understood by the interpreter but answered
 * 'not_built' with no effects. No screen calls this yet.
 */
export function oneBreathTurn(
  state: OneBreathState,
  input: OneBreathInput,
  context: OneBreathContext,
  interpret: Interpreter = interpretByRules,
): OneBreathTurn {
  if (input.kind !== 'say') return notBuilt(state);

  const kept: OneBreathState = { ...state, words: [...state.words, input.words] };
  const answer = (
    outcome: OneBreathOutcome,
    request: OneBreathRequest,
    text: string,
    next: OneBreathState = kept,
    effects: OneBreathEffect[] = [],
  ): OneBreathTurn => ({ state: next, status: outcome === 'nothing' ? 'standby' : 'responding', reply: { outcome, request, text }, effects });

  // The member's words are kept before anything can fail.
  if (!context.interpreterReachable) return answer('unavailable', 'none', ONE_BREATH_LINES.unavailable);

  const now = new Date(context.nowIso);
  const readBack = (plan: PlanDraft, outcome: OneBreathOutcome = 'read_back', lead = ''): OneBreathTurn =>
    answer(
      outcome,
      'plan_moment',
      `${lead}${plan.title}, ${plan.day} at ${plan.time}.${plan.goal ? ` Goal: ${plan.goal}.` : ''} ${sayPhrasePrompt('seal')}`,
      { ...kept, pendingPlan: plan, asking: undefined },
    );
  const ask = (plan: PlanDraft, asking: PlanQuestion): OneBreathTurn => {
    const question = asking.question ?? (asking.need === 'time' ? ONE_BREATH_LINES.askTime : ONE_BREATH_LINES.askDay);
    const turn = answer('ask', 'plan_moment', question, { ...kept, pendingPlan: plan, asking });
    return { ...turn, reply: { ...turn.reply, question, choices: asking.options?.map((o) => o.label) } };
  };

  const said = classifyUtterance(input.words);
  const pending = kept.pendingPlan;

  // 1. An answer to the one open question.
  if (pending && kept.asking) {
    const next = answerPlanQuestion(pending, kept.asking, input.words, now);
    if (next) return next.asking ? ask(next.plan, next.asking) : readBack(next.plan);
  }

  // 2. A reply to a complete read-back: seal, change, or no.
  if (pending && planComplete(pending)) {
    if (said.kind === 'confirm' && said.intent === 'seal') {
      const id = planSealId(pending);
      const sealed = answer(
        'approved',
        'plan_moment',
        `Sealed. ${pending.title} \u00b7 ${pending.day} ${pending.time}.`,
        { ...kept, pendingPlan: undefined, asking: undefined, sealed: [...kept.sealed, id] },
        [
          { kind: 'save_moment', id, plan: pending },
          { kind: 'enter_quiet', id: `quiet:${id}` },
        ],
      );
      return { ...sealed, status: 'quiet', reply: { ...sealed.reply, undo: { reverses: `Sealed ${pending.title}`, ms: ONE_BREATH_SEAL_UNDO_MS } } };
    }
    if (said.kind === 'change') {
      const changed = changePlan(pending, input.words, now);
      return changed ? readBack(changed) : answer('ask', 'plan_moment', ONE_BREATH_LINES.askChange);
    }
    if (said.kind === 'negation') return answer('nothing', 'plan_moment', ONE_BREATH_LINES.stillWaiting);
  }

  // 3. "Seal it" with nothing waiting never saves anything.
  if (said.kind === 'confirm' && said.intent === 'seal') {
    return kept.sealed.length > 0
      ? answer('already_done', 'plan_moment', ONE_BREATH_LINES.alreadySealed)
      : answer('nothing', 'plan_moment', ONE_BREATH_LINES.noPlan);
  }

  const heard = interpret(input.words, { social: context.social, momentInWindow: context.momentInWindow });

  if (heard.outcome === 'nothing') return answer('nothing', 'none', '');
  if (heard.request === 'none') return answer('limit', 'none', ONE_BREATH_LINES.limit);
  if (heard.outcome === 'not_counted') return answer('not_counted', 'log_drink', ONE_BREATH_LINES.alcoholNotCounted);

  if (heard.request === 'lock_in') {
    // The window is checked here, from context, never taken from the interpreter's word for it.
    if (!context.momentInWindow) return answer('not_active', 'lock_in', ONE_BREATH_LINES.lockInNotActive);
    if (kept.lockedIn) return answer('already_done', 'lock_in', ONE_BREATH_LINES.lockInAlready);
    return answer('act', 'lock_in', ONE_BREATH_LINES.lockInStarted, { ...kept, lockedIn: true }, [
      { kind: 'lock_in', id: `lock-in:${context.currentMomentId ?? 'current'}` },
    ]);
  }

  if (heard.request === 'plan_moment') {
    const safety = heard.outcome === 'safety';
    const started = planFromWords(input.words, now, { social: context.social, timingOnly: safety });
    if (started.asking) return ask(started.plan, started.asking);
    return safety ? readBack(started.plan, 'safety', `${ONE_BREATH_LINES.safety} `) : readBack(started.plan);
  }

  // Read-only requests: no approval, and nothing is changed.
  if (heard.request === 'status') {
    const hs = context.hydroState;
    if (!hs) return answer('act', 'status', ONE_BREATH_LINES.statusUnavailable);
    const line = `HydroState ${hs.value}, ${hs.word}.`;
    const turn = answer(
      'act',
      'status',
      `${line}${hs.estimated ? ' That\u2019s an estimate.' : ''} From ${hs.source}${hs.asOf ? `, ${hs.asOf}` : ''}.`,
    );
    return { ...turn, reply: { ...turn.reply, claims: [{ text: line, source: hs.source, estimate: hs.estimated }] } };
  }

  if (heard.request === 'upcoming') {
    const list = context.upcoming;
    if (!list) return answer('act', 'upcoming', ONE_BREATH_LINES.upcomingUnavailable);
    if (list.length === 0) return answer('act', 'upcoming', ONE_BREATH_LINES.upcomingNone);
    const lines = list.map((m) => `${m.title} \u00b7 ${m.day} ${m.time}`);
    const turn = answer('act', 'upcoming', `${lines.join('. ')}.`);
    return { ...turn, reply: { ...turn.reply, claims: lines.map((text) => ({ text, source: 'Moments' })) } };
  }

  if (heard.request === 'open_screen') {
    const screen = heard.outcome === 'act' ? screenNamed(input.words) : null;
    if (!screen) {
      const turn = answer('ask', 'open_screen', ONE_BREATH_LINES.askScreen);
      return { ...turn, reply: { ...turn.reply, question: ONE_BREATH_LINES.askScreen } };
    }
    return answer('act', 'open_screen', '', kept, [{ kind: 'open_screen', id: `open:${screen}`, screen }]);
  }

  return notBuilt(kept, heard.request);
}
