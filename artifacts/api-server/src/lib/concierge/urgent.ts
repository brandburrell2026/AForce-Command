/**
 * AForce Concierge — urgent-situation boundary.
 *
 * When a member describes what may be an urgent medical situation, ordinary
 * coaching stops. The reply is FIXED, governed copy — never model output — so
 * nothing can be invented at the one moment accuracy matters most. The copy:
 *   - points to local emergency services / a clinician,
 *   - says plainly that AForce OS does not monitor for or detect emergencies,
 *   - uses no banned term (§42 / §59): no "symptom", "risk", "diagnos…".
 *
 * Detection is lexical and deliberately broad; a false positive costs one
 * cautious reply, a false negative is the thing to avoid. Governance status:
 * the emergency boundary (Night Out spec NO-9) is design-only pending counsel
 * and clinical review — this copy is the engineering placeholder and is
 * flagged for that review in governance/proposals/PR-003-aforce-concierge.md.
 */

const URGENT_PATTERNS: readonly RegExp[] = [
  /\bchest (pain|pressure|tightness)\b/i,
  /\b(can'?t|cannot|hard to|trouble|difficulty) breath/i,
  /\bshort(ness)? of breath\b/i,
  /\b(passed out|pass out|passing out|blacked out|black out|fainted|fainting|faint)\b/i,
  /\b(unconscious|unresponsive|not responding)\b/i,
  /\bseizure\b/i,
  /\b(stroke|heart attack|cardiac)\b/i,
  /\b(severe|intense|crushing|worst) (pain|headache)\b/i,
  /\b(confus(ed|ion)|disoriented|slurr(ed|ing))\b/i,
  /\b(vomiting|throwing up) (blood|for hours|nonstop|non-stop|can'?t stop)\b/i,
  /\bblood in (my )?(urine|pee|stool|vomit)\b/i,
  /\b(no|not|stopped|haven'?t) (peed|urinat(ed|ing)) (in|for) (\d+|a|several|many) (hours|hrs|day)/i,
  /\b(heat ?stroke|heatstroke|overheat(ing|ed)|body temp(erature)? (is|of) (10[3-9]|11\d))\b/i,
  /\b(allergic reaction|anaphyla|throat (is )?(closing|swelling)|swollen tongue)\b/i,
  /\b(suicid|kill myself|end my life|want to die)\b/i,
  /\b(overdos|took too many|poison)/i,
  /\b(emergency|911|call an ambulance|ambulance)\b/i,
];

export function detectUrgent(message: string): boolean {
  if (!message) return false;
  return URGENT_PATTERNS.some((re) => re.test(message));
}

/** Governed copy. Must stay clean under every gate (locked by test). */
export const URGENT_ANSWER =
  "This sounds like it may need urgent attention, and that comes before anything about hydration or training. " +
  "If you or someone with you is in danger, contact local emergency services or a clinician right now. " +
  "AForce OS does not monitor for or detect emergencies, so please do not wait on the app.";

export const URGENT_NEXT_STEP = "Reach a clinician or local emergency services now.";
