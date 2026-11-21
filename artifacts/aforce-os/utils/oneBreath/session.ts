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
import { ONE_BREATH_DRINK_UNDO_MS, ONE_BREATH_SEAL_UNDO_MS } from '@/config/hydroStateModel';
import { drinkNamed, ouncesSaid, type NamedDrink } from './drinkWords';
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
  | { kind: 'wait'; ms: number }
  /** The screen closed, the app went to the background, or the session was cut off. */
  | { kind: 'interrupt' };

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
  /** True while there is not yet enough logged to state a HydroState: say so, and state no number. */
  hydroStateCollecting?: boolean;
  /**
   * What the hydration rules say about credit for a category, in member words
   * ("Partial credit pending."). One Breath repeats it and never writes its own.
   */
  creditNote?: (categoryId: string) => string;
  /**
   * True when the hydration log can take this drink back after it is saved.
   * Then the drink is logged at once and Undo reverses it (founder decision,
   * 2026-11-20, second). Where the log cannot take a drink back, the drink is
   * still held for its Undo window before anything is written.
   */
  undoAfterLog?: (categoryId: string, name: string) => boolean;
  /**
   * The title of a One Breath plan that is sealed and still open. There is one
   * open plan at a time, so a new one is not started while this is set.
   */
  openPlanTitle?: string;
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
  /**
   * The last spoken or typed seal while its Undo is still open. A seal made by
   * holding the bar has no Undo here: the hold is the deliberate approval, as
   * on the existing Seal screen.
   */
  sealUndo?: { id: string; plan: PlanDraft; msLeft: number };
  /** Sends held before they leave the phone. */
  outbox: { id: string; to: string; text: string; msLeft: number; state: 'pending' | 'sent' | 'cancelled' | 'unknown' }[];
  /** A drink scanned and not yet confirmed as drunk. */
  scanned?: { barcode: string; name?: string; categoryId?: string; oz?: number };
  /** A drink named without an amount: the one question is "How much?". */
  askingDrink?: NamedDrink;
  /**
   * A drink the member asked to log, held for its Undo window. Nothing has been
   * written yet. It is committed once when the window ends, and dropped if the
   * member undoes it (founder decision, 2026-11-20).
   */
  pendingDrink?: { id: string; categoryId: string; name: string; oz: number; label: string; msLeft: number };
  /** A drink already logged whose Undo is still open. Undo asks the hydration log to take it back. */
  loggedUndo?: { id: string; label: string; msLeft: number };
  /** Drinks logged this session. Part of each log's id, so one action is one log. */
  logged: number;
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
  logged: 0,
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
/** Said when a new plan is asked for while one is still open. New wording, for Julius to review. */
export const planStillOpenLine = (title: string) => `${title} is still open. One plan at a time.`;

export const ONE_BREATH_LINES = {
  // The spec's line also offers "message your Circle". It is left out until messaging is built: the line must not promise it.
  limit:
    "I don\u2019t have a reviewed answer for that, so I won\u2019t guess. I can plan a Moment, log a drink, check your HydroState, or start Lock In.",
  unavailable: "I couldn\u2019t reach AFORCE. Your words are kept. Nothing was saved. Try again, or type it.",
  lockInNotActive: "No Moment is starting right now. Lock In opens when your next Moment begins. Want to plan one?",
  lockInStarted: "Locked in.",
  lockInAlready: "Already locked in. Nothing changed.",
  safety:
    "I\u2019ll keep this to timing only. For training around an injury, surgery or a medical issue, check with your clinician.",
  askTime: "What time?",
  askDay: "What day?",
  askChange: "What should change: the day or the time?",
  sealUndone: "Seal undone. Your plan is waiting.",
  noPlan: "No plan is waiting.",
  alreadySealed: "Already sealed. Nothing changed.",
  stillWaiting: "Nothing saved. Your plan is waiting.",
  statusCollecting: "Still collecting. Log a few drinks and I\u2019ll have your HydroState.",
  statusUnavailable: "I can\u2019t read your HydroState right now, so I won\u2019t guess it.",
  upcomingUnavailable: "I can\u2019t read your Moments right now.",
  upcomingNone: "Nothing is planned yet.",
  askScreen: "Which screen?",
  askAmount: "How much?",
  askDrink: "What did you drink, and how much?",
  logIt: "Log it?",
  unknownBarcode: "I don\u2019t know this product yet. I won\u2019t guess what it is. Pick what kind of drink it is, or type it.",
  nothingLogged: "Nothing is logged.",
  notLogged: "Not logged.",
  logUndone: "Removed from today.",
  alcoholNotCounted:
    "Alcohol isn\u2019t counted toward HydroState, so nothing was logged. If you\u2019re heading out, plan it as a Social Moment and I\u2019ll handle it there.",
} as const;

const drinkLabel = (oz: number, name: string) => `${oz} oz ${name}`;

/**
 * Commits the pending drink: the one and only request to the hydration path
 * for it. Credit is the owner's to state; One Breath repeats its note.
 */
function commitDrink(state: OneBreathState, context: OneBreathContext): OneBreathTurn {
  const d = state.pendingDrink!;
  const note = context.creditNote?.(d.categoryId) ?? '';
  return {
    state: { ...state, pendingDrink: undefined },
    status: 'responding',
    reply: { outcome: 'act', request: 'log_drink', text: `Logged ${d.label}.${note ? ` ${note}` : ''}` },
    effects: [{ kind: 'log_drink', id: d.id, categoryId: d.categoryId, name: d.name, oz: d.oz }],
  };
}

/**
 * Holds a drink for its Undo window. Nothing is written here. If another drink
 * is already pending, that one is committed first so it is never lost.
 */
function holdDrink(state: OneBreathState, drink: NamedDrink, oz: number, context: OneBreathContext): OneBreathTurn {
  const flushed = state.pendingDrink ? commitDrink(state, context) : null;
  const base = flushed ? flushed.state : state;
  const id = `drink:${base.logged}:${drink.categoryId}:${oz}`;
  const label = drinkLabel(oz, drink.name);
  if (context.undoAfterLog?.(drink.categoryId, drink.name)) {
    // The member's instruction is complete: log it now. Undo takes it back.
    const note = context.creditNote?.(drink.categoryId) ?? '';
    return {
      state: { ...base, logged: base.logged + 1, scanned: undefined, askingDrink: undefined, loggedUndo: { id, label, msLeft: ONE_BREATH_DRINK_UNDO_MS } },
      status: 'responding',
      reply: { outcome: 'act', request: 'log_drink', text: `Logged ${label}.${note ? ` ${note}` : ''}`, undo: { reverses: label, ms: ONE_BREATH_DRINK_UNDO_MS } },
      effects: [...(flushed ? flushed.effects : []), { kind: 'log_drink', id, categoryId: drink.categoryId, name: drink.name, oz }],
    };
  }
  return {
    state: {
      ...base,
      logged: base.logged + 1,
      scanned: undefined,
      askingDrink: undefined,
      pendingDrink: { id, categoryId: drink.categoryId, name: drink.name, oz, label, msLeft: ONE_BREATH_DRINK_UNDO_MS },
    },
    status: 'responding',
    reply: {
      outcome: 'act',
      request: 'log_drink',
      text: `${label}. Logging in ${ONE_BREATH_DRINK_UNDO_MS / 1000} seconds.`,
      undo: { reverses: label, ms: ONE_BREATH_DRINK_UNDO_MS },
    },
    effects: flushed ? flushed.effects : [],
  };
}

const CATEGORY_CHOICES = ['Water', 'Electrolyte drink', 'Sports drink', 'Coffee', 'Energy drink', 'Type it'];

/** Scans, the buttons under them, Undo, and time passing. A scan is never drinking: only "Log it" logs. */
function drinkControl(state: OneBreathState, input: Exclude<OneBreathInput, { kind: 'say' }>, context: OneBreathContext): OneBreathTurn | null {
  const reply = (outcome: OneBreathOutcome, text: string, next: OneBreathState, extra: Partial<OneBreathReply> = {}, effects: OneBreathEffect[] = []): OneBreathTurn => ({
    state: next,
    status: outcome === 'nothing' ? 'standby' : 'responding',
    reply: { outcome, request: 'log_drink', text, ...extra },
    effects,
  });

  if (input.kind === 'wait') {
    if (!state.pendingDrink) return null;
    const msLeft = state.pendingDrink.msLeft - input.ms;
    // The window ended with no Undo: commit, once.
    if (msLeft <= 0) return commitDrink(state, context);
    return reply('nothing', '', { ...state, pendingDrink: { ...state.pendingDrink, msLeft } });
  }

  if (input.kind === 'interrupt') {
    // Undo is out of reach once the screen is gone. The member's instruction
    // stands, so the pending drink is committed now rather than lost or left waiting.
    return state.pendingDrink ? commitDrink(state, context) : null;
  }

  if (input.kind === 'scan') {
    const p = input.product;
    if (!p) {
      return reply('ask', ONE_BREATH_LINES.unknownBarcode, { ...state, scanned: { barcode: input.barcode } }, { question: ONE_BREATH_LINES.unknownBarcode, choices: CATEGORY_CHOICES });
    }
    const scanned = { barcode: input.barcode, name: p.name, categoryId: p.categoryId, oz: p.packageOz };
    const text = `${p.name}${p.packageOz ? `, ${p.packageOz} oz` : ''}. ${ONE_BREATH_LINES.logIt}`;
    return reply('ask', text, { ...state, scanned }, { question: ONE_BREATH_LINES.logIt, choices: ['Log it', 'Not now'] });
  }

  if (input.kind !== 'tap') return null;

  if (input.control === 'close' && state.scanned) return reply('nothing', ONE_BREATH_LINES.nothingLogged, { ...state, scanned: undefined });

  if (input.control === 'log') {
    const sc = state.scanned;
    // No scan waiting (a second tap lands here): nothing more to log.
    if (!sc) return reply('nothing', '', state);
    if (!sc.categoryId || !sc.name || !sc.oz) return reply('ask', ONE_BREATH_LINES.askAmount, state, { question: ONE_BREATH_LINES.askAmount });
    return holdDrink(state, { categoryId: sc.categoryId as NamedDrink['categoryId'], name: sc.name }, sc.oz, context);
  }

  if (input.control === 'undo' && state.pendingDrink) {
    // Nothing was written, so there is nothing to reverse: the pending log is dropped.
    return reply('undone', ONE_BREATH_LINES.notLogged, { ...state, pendingDrink: undefined });
  }

  return null;
}

/**
 * Seals a complete read-back: the one request to save it. A spoken or typed
 * seal opens Undo; a held seal does not.
 */
function sealTurn(state: OneBreathState, plan: PlanDraft, withUndo: boolean): OneBreathTurn {
  const id = planSealId(plan);
  return {
    state: {
      ...state,
      pendingPlan: undefined,
      asking: undefined,
      sealed: [...state.sealed, id],
      sealUndo: withUndo ? { id, plan, msLeft: ONE_BREATH_SEAL_UNDO_MS } : undefined,
    },
    status: 'responding',
    reply: {
      outcome: 'approved',
      request: 'plan_moment',
      text: `Sealed. ${plan.title} \u00b7 ${plan.day} ${plan.time}.`,
      ...(withUndo ? { undo: { reverses: `Sealed ${plan.title}`, ms: ONE_BREATH_SEAL_UNDO_MS } } : {}),
    },
    // Seal approves and saves. Quiet begins at Lock In, through the existing
    // owner, and nowhere else (founder decision, 2026-11-20).
    effects: [{ kind: 'save_moment', id, plan }],
  };
}

/** Undo of the last seal, inside its window: the plan goes back to waiting and its owner is asked to unseal it. */
function undoSealTurn(state: OneBreathState): OneBreathTurn {
  const su = state.sealUndo!;
  return {
    state: { ...state, sealUndo: undefined, pendingPlan: su.plan, asking: undefined, sealed: state.sealed.filter((id) => id !== su.id) },
    status: 'responding',
    reply: { outcome: 'undone', request: 'plan_moment', text: ONE_BREATH_LINES.sealUndone },
    effects: [{ kind: 'undo_moment', id: `undo:${su.id}:${state.words.length}:${state.sealed.length}`, of: su.id }],
  };
}

/** Undo of a drink already logged, inside its window: the hydration log is asked to take it back. */
function undoLogTurn(state: OneBreathState): OneBreathTurn {
  const lu = state.loggedUndo!;
  return {
    state: { ...state, loggedUndo: undefined },
    status: 'responding',
    reply: { outcome: 'undone', request: 'log_drink', text: ONE_BREATH_LINES.logUndone },
    effects: [{ kind: 'undo_drink', id: `undo:${lu.id}`, of: lu.id }],
  };
}

/** Controls and time for a sealed plan: the seal bar, Undo, and the Undo window running out. */
function sealControl(state: OneBreathState, input: Exclude<OneBreathInput, { kind: 'say' }>, context: OneBreathContext): OneBreathTurn | null {
  if (input.kind === 'wait' || input.kind === 'interrupt') {
    const drink = drinkControl(state, input, context);
    const after = drink?.state ?? state;
    if (!after.sealUndo && !after.loggedUndo) return drink;
    const left = (ms: number) => (input.kind === 'interrupt' ? 0 : ms - input.ms);
    const sealLeft = after.sealUndo ? left(after.sealUndo.msLeft) : 0;
    // A logged drink keeps its Undo when the screen goes away: the caller carries it to the next screen.
    const logLeft = after.loggedUndo ? (input.kind === 'interrupt' ? after.loggedUndo.msLeft : after.loggedUndo.msLeft - input.ms) : 0;
    const next: OneBreathState = {
      ...after,
      sealUndo: after.sealUndo && sealLeft > 0 ? { ...after.sealUndo, msLeft: sealLeft } : undefined,
      loggedUndo: after.loggedUndo && logLeft > 0 ? { ...after.loggedUndo, msLeft: logLeft } : undefined,
    };
    return drink ? { ...drink, state: next } : { state: next, status: 'standby', reply: { outcome: 'nothing', request: 'plan_moment', text: '' }, effects: [] };
  }
  if (input.kind !== 'tap') return null;
  // The newest thing is undone first: a pending drink before a seal.
  if (input.control === 'undo' && !state.pendingDrink && state.loggedUndo) return undoLogTurn(state);
  if (input.control === 'undo' && !state.pendingDrink && state.sealUndo) return undoSealTurn(state);
  if (input.control === 'seal') {
    const plan = state.pendingPlan;
    // The bar is only shown for a complete read-back. Anything else seals nothing.
    if (!plan || state.asking || !planComplete(plan)) {
      return { state, status: 'standby', reply: { outcome: 'nothing', request: 'plan_moment', text: '' }, effects: [] };
    }
    return sealTurn(state, plan, false);
  }
  return null;
}

/** Undo for a logged drink is no longer on offer: it failed to log, or its log cannot be taken back. */
export function undoClosed(state: OneBreathState, drinkId: string): OneBreathState {
  return state.loggedUndo?.id === drinkId ? { ...state, loggedUndo: undefined } : state;
}

/**
 * The owner refused or could not carry out an effect. The session goes back
 * to what is true: an unsaved plan is waiting again, a Lock In did not start,
 * and a seal whose undo failed still stands.
 */
export function effectFailed(state: OneBreathState, effect: OneBreathEffect): OneBreathState {
  if (effect.kind === 'save_moment') {
    return {
      ...state,
      pendingPlan: state.pendingPlan ?? effect.plan,
      sealed: state.sealed.filter((id) => id !== effect.id),
      sealUndo: state.sealUndo?.id === effect.id ? undefined : state.sealUndo,
    };
  }
  if (effect.kind === 'lock_in') return { ...state, lockedIn: false };
  if (effect.kind === 'log_drink') return undoClosed(state, effect.id);
  if (effect.kind === 'undo_moment') {
    const waiting = state.pendingPlan && planSealId(state.pendingPlan) === effect.of;
    return { ...state, pendingPlan: waiting ? undefined : state.pendingPlan, sealed: state.sealed.includes(effect.of) ? state.sealed : [...state.sealed, effect.of] };
  }
  return state;
}

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
 * and a screen is opened by key. A drink the member names with a clear amount,
 * or confirms with "Log it" after a scan, is held for six seconds and then
 * committed once; Undo, spoken or tapped, drops it before anything is written; the category comes from
 * the app's drink catalog and the words about credit from the hydration
 * rules, never from here.
 * Every other request is understood by the interpreter but answered
 * 'not_built' with no effects. No screen calls this yet.
 */
export function oneBreathTurn(
  state: OneBreathState,
  input: OneBreathInput,
  context: OneBreathContext,
  interpret: Interpreter = interpretByRules,
): OneBreathTurn {
  if (input.kind !== 'say') return sealControl(state, input, context) ?? drinkControl(state, input, context) ?? notBuilt(state);

  if (state.pendingDrink) {
    if (classifyUtterance(input.words).kind === 'undo') {
      return { state: { ...state, pendingDrink: undefined, words: [...state.words, input.words] }, status: 'responding', reply: { outcome: 'undone', request: 'log_drink', text: ONE_BREATH_LINES.notLogged }, effects: [] };
    }
    // The member moved on without undoing: commit the pending drink, then answer.
    const committed = commitDrink(state, context);
    const turn = oneBreathTurn(committed.state, input, context, interpret);
    return { ...turn, effects: [...committed.effects, ...turn.effects] };
  }

  if (state.loggedUndo && classifyUtterance(input.words).kind === 'undo') {
    return undoLogTurn({ ...state, words: [...state.words, input.words] });
  }

  if (state.sealUndo && classifyUtterance(input.words).kind === 'undo') {
    return undoSealTurn({ ...state, words: [...state.words, input.words] });
  }

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
      return sealTurn(kept, pending, true);
    }
    if (said.kind === 'change') {
      const changed = changePlan(pending, input.words, now);
      return changed ? readBack(changed) : answer('ask', 'plan_moment', ONE_BREATH_LINES.askChange);
    }
    if (said.kind === 'negation') return answer('nothing', 'plan_moment', ONE_BREATH_LINES.stillWaiting);
  }

  // A plan still missing its day or time cannot be sealed: the open question is asked again.
  if (pending && kept.asking && said.kind === 'confirm' && said.intent === 'seal') return ask(pending, kept.asking);

  // 3. "Seal it" with nothing waiting never saves anything.
  if (said.kind === 'confirm' && said.intent === 'seal') {
    return kept.sealed.length > 0
      ? answer('already_done', 'plan_moment', ONE_BREATH_LINES.alreadySealed)
      : answer('nothing', 'plan_moment', ONE_BREATH_LINES.noPlan);
  }

  // 4. An answer to "How much?" for a drink already named.
  if (kept.askingDrink) {
    const oz = ouncesSaid(input.words);
    if (oz !== null) return holdDrink({ ...kept, askingDrink: undefined }, kept.askingDrink, oz, context);
  }

  const heard = interpret(input.words, { social: context.social, momentInWindow: context.momentInWindow });

  if (heard.outcome === 'nothing') return answer('nothing', 'none', '');
  if (heard.request === 'none') return answer('limit', 'none', ONE_BREATH_LINES.limit);
  if (heard.outcome === 'not_counted') return answer('not_counted', 'log_drink', ONE_BREATH_LINES.alcoholNotCounted);

  if (heard.request === 'lock_in') {
    // The window is checked here, from context, never taken from the interpreter's word for it.
    if (!context.momentInWindow) return answer('not_active', 'lock_in', ONE_BREATH_LINES.lockInNotActive);
    if (kept.lockedIn) return answer('already_done', 'lock_in', ONE_BREATH_LINES.lockInAlready);
    // Lock In is where Quiet begins: the owner of this effect is the existing
    // Lock In, which already cancels ordinary reminders.
    return {
      ...answer('act', 'lock_in', ONE_BREATH_LINES.lockInStarted, { ...kept, lockedIn: true }, [
        { kind: 'lock_in', id: `lock-in:${context.currentMomentId ?? 'current'}` },
      ]),
      status: 'quiet',
    };
  }

  if (heard.request === 'plan_moment') {
    // One open plan at a time: the open one is finished or cancelled first.
    if (context.openPlanTitle && !kept.pendingPlan) return answer('limit', 'plan_moment', planStillOpenLine(context.openPlanTitle));
    const safety = heard.outcome === 'safety';
    const started = planFromWords(input.words, now, { social: context.social, timingOnly: safety });
    if (started.asking) return ask(started.plan, started.asking);
    return safety ? readBack(started.plan, 'safety', `${ONE_BREATH_LINES.safety} `) : readBack(started.plan);
  }

  if (heard.request === 'log_drink') {
    const drink = drinkNamed(input.words);
    const oz = ouncesSaid(input.words);
    // A clear drink and amount is the member's instruction. Anything less is one question.
    if (drink && oz !== null && heard.outcome === 'act') return holdDrink(kept, drink, oz, context);
    const question = drink ? ONE_BREATH_LINES.askAmount : ONE_BREATH_LINES.askDrink;
    const turn = answer('ask', 'log_drink', question, { ...kept, askingDrink: drink ?? undefined });
    return { ...turn, reply: { ...turn.reply, question } };
  }

  // Read-only requests: no approval, and nothing is changed.
  if (heard.request === 'status') {
    const hs = context.hydroState;
    if (!hs) return answer('act', 'status', context.hydroStateCollecting ? ONE_BREATH_LINES.statusCollecting : ONE_BREATH_LINES.statusUnavailable);
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
