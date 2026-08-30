/**
 * DECISION GUARD — the directive-named final seam before delivery.
 *
 * Directive anchors (.claude/commands/aforce-world-class-release.md):
 *  - pipeline order "Context Arbitration → RecoveryCommand → Evidence
 *    Engine → Decision Guard" (:546) — the guard is the LAST deterministic
 *    check before surfaces;
 *  - invariant "Decision Guard can block every output" (:137);
 *  - the ledger records a "Decision Guard result" per command (:754);
 *  - "Decision Guard bypass" is a zero-tolerance release category (:1158);
 *  - enforcement lives OUTSIDE the model — deterministic code (§16).
 *
 * The guard judges the canonical engine command AS DELIVERED to surfaces.
 * It does not originate advice, never touches score, timers, or state
 * (Score Protection), and approves by returning the SAME references it was
 * given — identity-sensitive consumers depend on that (the voice effect
 * dedupes on command identity; adaptEngineOutputForRecheck's flag-off
 * contract is same-reference no-op; facade/slice memos key on reference).
 *
 * Checks, in order, each traceable to directive text:
 *  1. `malformed`        — a deliverable command needs an id and an action
 *                          (§5: one current action; a shapeless command
 *                          cannot be audited or confirmed).
 *  2. `unsafe_dose`      — "impossible or unsafe numerical recommendation"
 *                          is zero-tolerance (§21). Any "N oz|ounces" token
 *                          outside (0, DECISION_GUARD_MAX_DOSE_OZ] blocks;
 *                          the ceiling is shared with the parseDoseOz
 *                          contract via config/hydroStateModel.ts.
 *  3. `commercial_bias`  — §13 names the phrase class verbatim ("stick
 *                          preferred", "bring an AForce stick"); commerce
 *                          may never steer the command.
 *  4. `blocked_language` — the §42 block-severity concept scan
 *                          (consumerCopyBlocked). Closes a real gap: the
 *                          emit seams cover voice and notifications, but
 *                          on-screen command copy was never runtime-scanned.
 *
 * On block, the command's copy is replaced with the neutral water-first
 * fallback (dose-free, clock-free, product-free — passes the guard by
 * construction; fixed-point pinned in
 * utils/__tests__/decisionGuard.test.ts). Everything else on
 * the engine output — score, riskTimer, performance state, social —
 * passes through by reference, untouched.
 *
 * Wiring: store/useAppStore.tsx guards once per engine-output change and
 * feeds the guarded output to the facade, the slices, the voice effect,
 * and the journal snapshot; the result is appended to the command ledger
 * via decisionGuardResultToCommandEvent. The seam lock
 * (store/__tests__/decisionGuardSeam.lock.test.ts) pins that wiring.
 */

import type { Command, ScoreEngineOutput } from '../../types';
import type { MomentAction, MomentRecommendation, RitualStage } from '../../types/moments';
import { DECISION_GUARD_MAX_DOSE_OZ } from '../../config/hydroStateModel';
import { consumerCopyBlocked } from './languageGate/runtimeClaimScan';

export type DecisionGuardReason =
  | 'malformed'
  | 'unsafe_dose'
  | 'dose_modifier'
  | 'commercial_bias'
  | 'blocked_language';

export type DecisionGuardResult =
  | { verdict: 'approved' }
  | { verdict: 'blocked'; reason: DecisionGuardReason };

export interface GuardedEngineOutput {
  /** Same reference as the input when approved; a copy-replaced clone when blocked. */
  engineOutput: ScoreEngineOutput;
  result: DecisionGuardResult;
}

/**
 * Neutral fallback copy shown when a command is blocked. Follows the
 * recovery module's fallback precedent (RECOVERY_FALLBACK_TITLE — English
 * literals, member-plain). Deliberately carries no dose, no clock, no
 * product, and no blocked concept — the fixed-point test proves the
 * fallback itself passes the guard.
 */
export const DECISION_GUARD_FALLBACK_ACTION = 'Water first. Refresh your command.';
export const DECISION_GUARD_FALLBACK_EXPLANATION =
  'Baseline guidance is shown while your next command is prepared.';

/** Every "N oz|ounce(s)" token in delivered copy; global, case-insensitive. */
const DOSE_TOKEN = /(\d+(?:\.\d+)?)\s*(?:oz\b|ounces?\b)/gi;

/** §13-named commercial steering phrase class — verbatim from the directive. */
const COMMERCIAL_STEERING = [/stick\s+preferred/i, /bring\s+an\s+aforce\s+stick/i];

// ─── Dose-MODIFIER class (founder ruling R5, E7) ─────────────────────────
//
// "Add 20% to your intake" reached a delivered command explanation because the
// dose check above knows only absolute oz tokens. Relative dose-modifying
// language — percentages, multipliers, increase/decrease verbs — is command
// authority exactly as much as an absolute dose is, so it is modelled as a
// CLASS, not a blocklisted string.
//
// Deterministic, sentence-scoped, three sub-classes:
//   A  a percentage beside a delta verb, an intake noun, or a comparative
//   B  a multiplier lexeme beside an intake noun
//   C  a delta verb near an intake noun, carrying a number or a comparative
//
// Deliberate exclusions, proven by the live-copy sweep in decisionGuard.test:
// measurements ("Hydration 63% of target"), consequences ("score drops to
// 52"), and canonical absolute doses ("Sip 12 oz") are observations or the
// command's own job, and must keep passing.
//
// KNOWN LIMIT: the verb/multiplier lexicons are English. The one historical
// offender exists only as English text (it falls back to en in every locale),
// so coverage is complete today; per-locale lexicons are recorded follow-up
// debt, not silently claimed.
const INTAKE_NOUN = /\b(intake|dose|dosage|amount|water|oz|ounces?|ml|fluids?|electrolytes?|hydration|sticks?)\b/i;
// A spoken number counts for a PERCENTAGE ("twenty percent") but deliberately
// NOT as a bare count: "one more article about hydration" is prose, and
// widening NUMBER_TOKEN to words would block it.
const WORD_NUMBER =
  'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred';
const PERCENT_TOKEN = new RegExp(`(?:\\d+(?:\\.\\d+)?|\\b(?:${WORD_NUMBER})\\b)\\s*(?:%|％|percent\\b)`, 'i');
const MULTIPLIER =
  /\b(doubl(?:e[ds]?|ing)|tripl(?:e[ds]?|ing)|quadrupl(?:e[ds]?|ing)|twice|halv(?:e[sd]?|ing)|half)\b|\b\d+(?:\.\d+)?x\b|\bx\s?\d+\b/i;
const DELTA_VERB = /\b(add|increase|decrease|reduce|cut|boost|raise|lower|bump|take)\b/i;
// "Up your intake …" is a delta verb in disguise. The lookbehind keeps the
// phrasal verbs out ("set up your water reminder" is configuration, not dose).
const UP_DIRECTIVE = /(?<!\b(?:set|warm|follow|pick|back|open|make|wake|catch|light|sign|line|speed)\s)\bup\s+(?:your|the)\b/i;
const COMPARATIVE = /\b(more|less|extra|additional|further)\b/i;
const NUMBER_TOKEN = /\d/;
// "an extra stick" — the article IS the count when it rides a comparative.
const ARTICLE_COUNT = /\b(?:an?|another)\s+(?:extra|additional)\b/i;

function isDoseModifier(text: string): boolean {
  // Newlines are boundaries too: a rendered notification is often
  // "title\nbody", and without this split the two lines fused into one
  // "sentence" — a member title's noun could combine with the body's verb
  // into a false positive (and vice versa).
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const pct = PERCENT_TOKEN.test(sentence);
    const noun = INTAKE_NOUN.test(sentence);
    const mult = MULTIPLIER.test(sentence);
    const delta = DELTA_VERB.test(sentence) || UP_DIRECTIVE.test(sentence);
    const comp = COMPARATIVE.test(sentence);
    // A — a percentage beside DIRECTIVE vocabulary is a relative dose. A
    //     percentage beside a bare noun is a measurement ("Hydration 63% of
    //     target") and must keep passing — the negative table caught the
    //     wider form blocking exactly that.
    if (pct && (delta || comp)) return true;
    // B — "double / halve / twice the <intake noun>".
    if (mult && noun) return true;
    // C — "increase your water by 8 oz" / "boost your hydration with extra…".
    if (delta && noun && (NUMBER_TOKEN.test(sentence) || comp)) return true;
    // D — a comparative riding a QUANTIFIED intake noun is a modifier even on
    //     a canonical verb: "Drink an extra 12 oz", "Sip 8 oz more". Without
    //     the quantity it stays prose ("more article about hydration…").
    if (comp && noun && (NUMBER_TOKEN.test(sentence) || ARTICLE_COUNT.test(sentence))) return true;
  }
  return false;
}

function doseOutOfBounds(text: string): boolean {
  DOSE_TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DOSE_TOKEN.exec(text)) !== null) {
    const oz = Number(m[1]);
    if (!Number.isFinite(oz) || oz <= 0 || oz > DECISION_GUARD_MAX_DOSE_OZ) return true;
  }
  return false;
}

/**
 * Judge one string of member-facing copy as delivered (a rendered
 * notification title/body, a command line). Pure and deterministic:
 * dose bounds → commercial steering → §42 block-severity scan. This is
 * the guard's text primitive — the Moments sync seam runs it on rendered
 * OS-notification strings (member-authored moment titles are untrusted
 * free text) and evaluateEngineCommand composes it per surface.
 */
/**
 * Judge one member-authored LABEL (a calendar-derived moment title in a
 * notification). A label names an event; it is not an instruction — so the
 * dose-MODIFIER class does not apply, or "Double water polo practice" and
 * "Halve marathon split review" would silently kill their own reminders.
 * Every other protection (dose bounds, commercial steering, §42 language)
 * still applies to untrusted text.
 */
export function evaluateDeliverableLabel(text: string): DecisionGuardResult {
  if (doseOutOfBounds(text)) return { verdict: 'blocked', reason: 'unsafe_dose' };
  if (COMMERCIAL_STEERING.some((p) => p.test(text))) {
    return { verdict: 'blocked', reason: 'commercial_bias' };
  }
  if (text && consumerCopyBlocked(text)) return { verdict: 'blocked', reason: 'blocked_language' };
  return { verdict: 'approved' };
}

export function evaluateDeliverableCopy(text: string): DecisionGuardResult {
  if (doseOutOfBounds(text)) return { verdict: 'blocked', reason: 'unsafe_dose' };
  if (isDoseModifier(text)) return { verdict: 'blocked', reason: 'dose_modifier' };
  if (COMMERCIAL_STEERING.some((p) => p.test(text))) {
    return { verdict: 'blocked', reason: 'commercial_bias' };
  }
  if (text && consumerCopyBlocked(text)) return { verdict: 'blocked', reason: 'blocked_language' };
  return { verdict: 'approved' };
}

/**
 * Judge one structured Moments action before it may qualify for an OS
 * notification (directive §10: qualification ends "… notification fatigue
 * → safety → Decision Guard → RecoveryCommand eligibility"). The action's
 * copy is an i18n key; the deliverable numerics are its oz params — each
 * must sit inside the guard's dose contract. Defense-in-depth: the values
 * come from the MOMENT_HYDRATE_OZ config table today, so a block here
 * means the table (or a future producer) left contract.
 */
function ozParamsOutOfContract(params: Record<string, string | number> | undefined): boolean {
  if (!params) return false;
  for (const key of ['oz', 'ozMin', 'ozMax'] as const) {
    const value = params[key];
    if (value === undefined) continue;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > DECISION_GUARD_MAX_DOSE_OZ
    ) {
      return true;
    }
  }
  return false;
}

export function evaluateMomentAction(action: {
  labelKey: string;
  labelParams?: Record<string, string | number>;
}): DecisionGuardResult {
  if (!action || !action.labelKey) return { verdict: 'blocked', reason: 'malformed' };
  if (ozParamsOutOfContract(action.labelParams)) {
    return { verdict: 'blocked', reason: 'unsafe_dose' };
  }
  return { verdict: 'approved' };
}

/**
 * Neutral in-app fallbacks for a Moments surface whose deliverable copy
 * left contract. EN-only keys — the moments.* namespace is EN-with-
 * fallback across all locales by design. Dose-free, clock-free,
 * product-free (pinned in momentsDecisionGuard.test.ts).
 */
export const DECISION_GUARD_MOMENT_ACTION_FALLBACK_KEY = 'moments.action.hydrate_fallback';
export const DECISION_GUARD_MOMENT_RITUAL_FALLBACK_KEY = 'moments.ritual.hydrate_fallback';

/**
 * Guard one MomentRecommendation as DELIVERED to the in-app surfaces
 * (NextMomentCard, MomentsScreen, MomentDetailScreen, PrepareMyDayScreen
 * all consume useMomentsData.recFor). The moment itself is member data —
 * it stays visible; only out-of-contract DOSE surfaces degrade:
 *  - blocked primaryAction → neutral water-first action (kind 'hydrate'
 *    survives the Water-First pin; bestBeforeIso kept — timing is window
 *    math, not a dose);
 *  - blocked secondaryAction → dropped (optional everywhere);
 *  - a ritual stage whose instructionParams carry an out-of-contract oz →
 *    neutral instruction, params dropped (stage count and order preserved
 *    — the 4-stage ritual pin holds).
 * Approved → the SAME rec reference (production byte-identical; today's
 * values come from the MOMENT_HYDRATE_OZ config table, proven in
 * contract). This mirrors the notification lane's semantics with one
 * deliberate difference: a notification candidate is an interruption and
 * is DROPPED; an in-app rec annotates the member's own moment and
 * DEGRADES to neutral copy instead of hiding their data.
 */
export function guardMomentRecommendation(rec: MomentRecommendation): {
  rec: MomentRecommendation;
  result: DecisionGuardResult;
} {
  let reason: DecisionGuardReason | null = null;

  let primary: MomentAction = rec.primaryAction;
  const primaryVerdict = evaluateMomentAction(rec.primaryAction);
  if (primaryVerdict.verdict === 'blocked') {
    reason = primaryVerdict.reason;
    primary = {
      kind: 'hydrate',
      labelKey: DECISION_GUARD_MOMENT_ACTION_FALLBACK_KEY,
      ...(rec.primaryAction?.bestBeforeIso
        ? { bestBeforeIso: rec.primaryAction.bestBeforeIso }
        : {}),
    };
  }

  let secondary = rec.secondaryAction;
  if (secondary) {
    const secondaryVerdict = evaluateMomentAction(secondary);
    if (secondaryVerdict.verdict === 'blocked') {
      reason = reason ?? secondaryVerdict.reason;
      secondary = undefined;
    }
  }

  let ritual: RitualStage[] = rec.ritual;
  if (rec.ritual.some((s) => ozParamsOutOfContract(s.instructionParams))) {
    reason = reason ?? 'unsafe_dose';
    ritual = rec.ritual.map((s) =>
      ozParamsOutOfContract(s.instructionParams)
        ? { ...s, instructionKey: DECISION_GUARD_MOMENT_RITUAL_FALLBACK_KEY, instructionParams: undefined }
        : s,
    );
  }

  if (reason === null) return { rec, result: { verdict: 'approved' } };
  return {
    rec: { ...rec, primaryAction: primary, secondaryAction: secondary, ritual },
    result: { verdict: 'blocked', reason },
  };
}

/**
 * Judge one deliverable command. Pure and deterministic; the reason is
 * diagnostics/ledger material and is never surfaced to the member
 * (validateRecoveryCommand precedent).
 */
export function evaluateEngineCommand(cmd: Command | null | undefined): DecisionGuardResult {
  if (!cmd || !cmd.id || !cmd.action) return { verdict: 'blocked', reason: 'malformed' };
  for (const text of [cmd.action, cmd.explanation ?? '']) {
    const res = evaluateDeliverableCopy(text);
    if (res.verdict === 'blocked') return res;
  }
  return { verdict: 'approved' };
}

/**
 * Guard a full engine output for delivery. Approved → the SAME engineOutput
 * reference (production is byte-identical while the engine's copy is in
 * contract). Blocked → a clone whose command carries the neutral fallback
 * copy; id, urgencyLevel, estimatedImpact, and confidence pass through so
 * timers, ledger links, and confidence displays stay coherent.
 */
export function guardEngineOutput(engineOutput: ScoreEngineOutput): GuardedEngineOutput {
  const result = evaluateEngineCommand(engineOutput.command);
  if (result.verdict === 'approved') return { engineOutput, result };
  const fallbackCommand: Command = {
    id: engineOutput.command?.id || 'decision-guard-fallback',
    action: DECISION_GUARD_FALLBACK_ACTION,
    explanation: DECISION_GUARD_FALLBACK_EXPLANATION,
    urgencyLevel: engineOutput.command?.urgencyLevel ?? 'medium',
    estimatedImpact: engineOutput.command?.estimatedImpact ?? '',
    ...(engineOutput.command?.confidence !== undefined
      ? { confidence: engineOutput.command.confidence }
      : {}),
  };
  return { engineOutput: { ...engineOutput, command: fallbackCommand }, result };
}
