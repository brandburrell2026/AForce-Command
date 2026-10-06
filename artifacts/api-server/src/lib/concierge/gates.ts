/**
 * AForce Concierge — output gates (fail closed).
 *
 * Every string the model produces passes ALL of these before a member can see
 * it. A failure is never "fixed" by rewriting (deleting a negation can
 * strengthen a claim — §42 forbids it); the turn is regenerated once with the
 * violation named, then surfaced as an honest unavailable state.
 *
 *  1. §42 claims gate — the server's BLOCK vocabulary (lib/claimsGate.ts),
 *     parity-locked to the app's policy registry.
 *  2. §59 / §64 language rule — the four forbidden stems (risk, injur, diagnos,
 *     prevent) and population-comparison framing. Mirrors
 *     artifacts/aforce-os/utils/intelligence/conversationalLanguage.ts.
 *  3. Quantity grounding (DR-013 "mirror-exact, or nothing") — any unit-bearing
 *     quantity (oz, ml, L, cups, mg, %, minutes, hours) in the reply must
 *     already exist in the grounding set: the member's own message, the client
 *     context, or server facts. The concierge can repeat the engine's dose;
 *     it can never author one.
 *  4. Action grounding — a proposed hydration amount must itself be grounded,
 *     a screen must be one the client offered, a capability must be one the
 *     client declared.
 */
import { findBlockedConcept } from "../claimsGate";
import type { ClientContext, ConciergeAction, ModelReply, ServerFacts } from "./types";

export const CONCIERGE_GATE_POLICY = "concierge-gate-v1.0";

export type GateViolation =
  | { rule: "claims"; detail: string }
  | { rule: "language"; detail: string }
  | { rule: "quantity"; detail: string }
  | { rule: "action"; detail: string }
  | { rule: "sources"; detail: string }
  | { rule: "jargon"; detail: string }
  | { rule: "inference"; detail: string };

/**
 * Engineering vocabulary members must never read (design review 2026-10-05):
 * band tokens as uppercase identifiers, "engine", "command confidence",
 * "fresh/stale command". Lower-case "balanced"/"recovering" remain ordinary English.
 */
/** Uppercase band identifiers only — case-sensitive on purpose. */
const BAND_TOKENS = /\b(PEAK|BALANCED|RECOVERING|DEPLETED)\b/g;
/** Plumbing phrases, any casing. */
const JARGON_PHRASES =
  /\bengine\b|\bcommand confidence\b|\b(?:fresh|stale|canonical) (?:engine )?command\b|\bhydrostate (?:engine|signal)\b|\bsignal quality\b/gi;

export function findJargon(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(BAND_TOKENS)) out.push(m[0]);
  for (const m of text.matchAll(JARGON_PHRASES)) out.push(m[0]);
  return out;
}

/**
 * Missing intake logs are not a conclusion about the body. When nothing is
 * logged today, a reply may not tell the member they ARE low / behind /
 * depleted / dehydrated — it may only say nothing is logged yet.
 */
const ABSENCE_INFERENCE =
  /\b(you(?:'re| are)|your body is|you seem|you look|you must be|you(?:'ve| have) (?:fallen|gotten|become))\s+(?:\w+\s){0,2}(depleted|dehydrated|behind|low|under-?hydrated|running low|falling behind)\b/i;

export function findAbsenceInference(text: string, loggedToday: boolean | undefined): string[] {
  if (loggedToday !== false) return [];
  const m = text.match(ABSENCE_INFERENCE);
  return m ? [m[0]] : [];
}

/** §59 stems — word-boundary so "brisk" / "asterisk" are not caught. */
const FORBIDDEN_STEMS = /\b(risk|injur|diagnos|prevent)[a-z]*/gi;

/** §64 rule 6 — never a population comparison. */
const POPULATION_COMPARISON =
  /\b(compared to (other|others|the average|most)|average user|most (people|users)|than (other|others|the average)|vs\.? (other|others|the average))\b/i;

/**
 * Unit-bearing quantities. Plain integers ("3 things", "one step") are not
 * claims about the body and are left alone; a number attached to a hydration,
 * electrolyte, time or percentage unit is a dose/clock and must be grounded.
 */
const QUANTITY =
  /(\d+(?:\.\d+)?)\s*(oz\b|ounces?\b|fl\.?\s*oz\b|ml\b|milliliters?\b|l\b|liters?\b|litres?\b|cups?\b|mg\b|milligrams?\b|g\b|grams?\b|%|percent\b|min\b|mins\b|minutes?\b|hours?\b|hrs?\b|h\b)/gi;

export function findLanguageViolations(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(FORBIDDEN_STEMS)) out.push(m[0].toLowerCase());
  const pop = text.match(POPULATION_COMPARISON);
  if (pop) out.push(pop[0].toLowerCase());
  return out;
}

/** Every number in a JSON-ish value (numbers and digits inside strings). */
export function collectNumbers(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === "number" && Number.isFinite(value)) {
    into.add(normalizeNumber(value));
    into.add(normalizeNumber(Math.round(value)));
    return into;
  }
  if (typeof value === "string") {
    for (const m of value.matchAll(/\d+(?:\.\d+)?/g)) into.add(normalizeNumber(Number(m[0])));
    return into;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectNumbers(v, into);
    return into;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectNumbers(v, into);
  }
  return into;
}

function normalizeNumber(n: number): string {
  // 16, 16.0 and 16.00 are the same quantity.
  return String(Number(n.toFixed(2)));
}

export interface GroundingSet {
  numbers: Set<string>;
}

export function buildGroundingSet(
  memberMessage: string,
  context: ClientContext,
  facts: ServerFacts | null,
  priorMemberMessages: readonly string[] = [],
): GroundingSet {
  const numbers = new Set<string>();
  collectNumbers(memberMessage, numbers);
  for (const m of priorMemberMessages) collectNumbers(m, numbers);
  collectNumbers(context, numbers);
  if (facts) collectNumbers(facts, numbers);
  // Derived figures the engine already implies and a member reasonably hears:
  // remaining oz to target. Derived from grounded inputs only.
  const oz = facts?.intake ?? context.intake;
  if (oz) {
    const remaining = Math.max(0, oz.ozTarget - oz.ozToday);
    numbers.add(normalizeNumber(remaining));
    numbers.add(normalizeNumber(Math.round(remaining)));
    if (oz.ozTarget > 0) {
      const pct = Math.round((oz.ozToday / oz.ozTarget) * 100);
      numbers.add(normalizeNumber(pct));
    }
  }
  return { numbers };
}

export function findUngroundedQuantities(text: string, grounding: GroundingSet): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(QUANTITY)) {
    const n = normalizeNumber(Number(m[1]));
    if (!grounding.numbers.has(n)) out.push(m[0]);
  }
  return out;
}

/** Gate one free-text field. */
export function gateText(
  text: string | null | undefined,
  grounding: GroundingSet,
  opts: { loggedToday?: boolean } = {},
): GateViolation[] {
  if (!text) return [];
  const v: GateViolation[] = [];
  const claim = findBlockedConcept(text);
  if (claim) v.push({ rule: "claims", detail: claim });
  for (const l of findLanguageViolations(text)) v.push({ rule: "language", detail: l });
  for (const q of findUngroundedQuantities(text, grounding)) v.push({ rule: "quantity", detail: q });
  for (const j of findJargon(text)) v.push({ rule: "jargon", detail: j });
  for (const i of findAbsenceInference(text, opts.loggedToday)) v.push({ rule: "inference", detail: i });
  return v;
}

export function gateAction(
  action: ConciergeAction | null,
  context: ClientContext,
  grounding: GroundingSet,
): GateViolation[] {
  if (!action) return [];
  const v: GateViolation[] = [];
  if (!context.capabilities.includes(action.type)) {
    v.push({ rule: "action", detail: `capability_not_offered:${action.type}` });
    return v;
  }
  if (action.type === "log_hydration") {
    if (!grounding.numbers.has(normalizeNumber(action.oz))) {
      v.push({ rule: "action", detail: `ungrounded_oz:${action.oz}` });
    }
  }
  if (action.type === "open_screen" && !context.screens.includes(action.screen)) {
    v.push({ rule: "action", detail: `screen_not_offered:${action.screen}` });
  }
  if (action.type === "set_reminder") {
    const localDate = context.localTime.iso.slice(0, 10);
    if (action.dateLocal < localDate) {
      v.push({ rule: "action", detail: "reminder_in_past" });
    }
  }
  for (const field of ["label", "title"] as const) {
    const text = (action as Record<string, unknown>)[field];
    if (typeof text === "string") {
      for (const g of gateText(text, grounding)) v.push(g);
    }
  }
  return v;
}

/** Gate a whole model reply. Empty array = deliverable. */
export function gateReply(
  reply: ModelReply,
  context: ClientContext,
  grounding: GroundingSet,
  allowedSourceIds: ReadonlySet<string>,
): GateViolation[] {
  const textOpts = { loggedToday: context.intake.loggedToday };
  const v: GateViolation[] = [
    ...gateText(reply.answer, grounding, textOpts),
    ...gateText(reply.nextStep, grounding, textOpts),
    ...gateText(reply.why, grounding, textOpts),
    ...gateAction(reply.action, context, grounding),
  ];
  if (reply.remember) {
    for (const g of gateText(reply.remember.value, grounding)) v.push(g);
  }
  for (const s of reply.sources) {
    if (!allowedSourceIds.has(s)) v.push({ rule: "sources", detail: s });
  }
  return v;
}
