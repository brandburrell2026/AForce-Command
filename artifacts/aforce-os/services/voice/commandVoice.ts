/**
 * AForce Command Voice Engine — pure script library.
 *
 * Single source of truth for every line the AForce Command Voice Engine
 * is allowed to say in three categories:
 *
 *   1. SCORE BAND alerts    — fire on score-band crossings (5 bands).
 *   2. RISK TIMER alerts    — fire as the recheck timer descends through
 *                             16, 8, 4, and 0 minutes.
 *   3. COMPLETION REWARDS   — fire when the user completes a hydration
 *                             cycle (3 rotated phrases).
 *
 * Every phrase is intensity-aware:
 *
 *   - 'calm'      → measured Performance-Command tone, full sentences.
 *   - 'standard'  → the spec phrases verbatim (calm + controlled).
 *   - 'pressure'  → Pressure Mode — short, sharp, direct.
 *
 * The library is pure, dependency-free, and React-free so it can be
 * unit-tested without the RN bundle and reused from any layer (hooks,
 * store side-effects, settings UI replay).
 *
 * Brand language is exported via BRAND_LANGUAGE so the UI never
 * hard-codes the canonical terms.
 */

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

/** The user-tunable voice intensity. */
export type VoiceIntensity = 'calm' | 'standard' | 'pressure';

/** When the engine is allowed to speak. */
export type VoiceScope = 'all' | 'risk' | 'commands' | 'muted';

/** Score-band identity used by both alerts and the status module. */
export type ScoreBand = 'PEAK' | 'STABLE' | 'CORRECT' | 'RISK' | 'CRITICAL';

/** Discrete risk-timer thresholds (minutes). */
export type RiskThreshold = 16 | 8 | 4 | 0;

/* ------------------------------------------------------------------ *
 * Brand language — canonical terms used everywhere in the UI + voice
 * ------------------------------------------------------------------ */

export const BRAND_LANGUAGE = Object.freeze({
  engineName:        'AForce Command Voice Engine',
  performanceCommand: 'Performance Command',
  hydrationCycle:    'Hydration Cycle',
  systemReset:       'System Reset',
  riskState:         'Risk State',
  pressureMode:      'Pressure Mode',
  recoveryProtocol:  'Recovery Protocol',
  performanceRestored: 'Performance Restored',
} as const);

/* ------------------------------------------------------------------ *
 * Score band classifier
 * ------------------------------------------------------------------ */

export const SCORE_BAND_THRESHOLDS = Object.freeze({
  PEAK:     85,
  STABLE:   70,
  CORRECT:  50,
  RISK:     30,
} as const);

/**
 * Map a numeric score (0–100, clamped) to its band label.
 *
 *   85–100 → PEAK
 *   70–84  → STABLE
 *   50–69  → CORRECT
 *   30–49  → RISK
 *    0–29  → CRITICAL
 */
export function scoreBand(score: number): ScoreBand {
  if (score >= SCORE_BAND_THRESHOLDS.PEAK)    return 'PEAK';
  if (score >= SCORE_BAND_THRESHOLDS.STABLE)  return 'STABLE';
  if (score >= SCORE_BAND_THRESHOLDS.CORRECT) return 'CORRECT';
  if (score >= SCORE_BAND_THRESHOLDS.RISK)    return 'RISK';
  return 'CRITICAL';
}

/* ------------------------------------------------------------------ *
 * Score band → spoken line
 * ------------------------------------------------------------------ */

const SCORE_BAND_LINES: Readonly<Record<ScoreBand, Readonly<Record<VoiceIntensity, string>>>> = Object.freeze({
  PEAK: Object.freeze({
    calm:     'Flow state active. Hydration is elite. Enjoy the rhythm.',
    standard: 'Flow state active. Hydration is elite.',
    pressure: 'Flow state. Hold it.',
  }),
  STABLE: Object.freeze({
    calm:     'Recovery stable. Hydration maintained. You are in a good rhythm.',
    standard: 'Recovery stable. Hydration maintained.',
    pressure: 'Stable. Hold the rhythm.',
  }),
  CORRECT: Object.freeze({
    calm:     'Recovery window opening. A water cycle now will keep you in flow.',
    standard: 'Recovery window opening. Time for a water cycle.',
    pressure: 'Water cycle. Now.',
  }),
  RISK: Object.freeze({
    calm:     'Recovery window open. Twelve ounces with AForce will restore balance.',
    standard: 'Recovery window open. Complete a water cycle with AForce.',
    pressure: 'Twelve ounces. AForce. Now.',
  }),
  CRITICAL: Object.freeze({
    calm:     'Recovery needed. Complete one water cycle now to reset.',
    standard: 'Recovery needed. Complete one water cycle now.',
    pressure: 'Recovery now. One water cycle.',
  }),
});

/**
 * Spoken line for a given score and intensity. Pure lookup.
 */
export function scoreBandLine(score: number, intensity: VoiceIntensity = 'standard'): string {
  return SCORE_BAND_LINES[scoreBand(score)][intensity];
}

/** Direct band → line accessor (for the status module replay flow). */
export function lineForBand(band: ScoreBand, intensity: VoiceIntensity = 'standard'): string {
  return SCORE_BAND_LINES[band][intensity];
}

/* ------------------------------------------------------------------ *
 * Risk-timer thresholds + lines
 * ------------------------------------------------------------------ */

/** Descending order so a state machine can iterate correctly. */
export const RISK_THRESHOLDS: ReadonlyArray<RiskThreshold> = Object.freeze([16, 8, 4, 0]);

const RISK_TIMER_LINES: Readonly<Record<RiskThreshold, Readonly<Record<VoiceIntensity, string>>>> = Object.freeze({
  16: Object.freeze({
    // {{minutes}} is filled with the LIVE riskTimer minutes by riskTimerLine
    // (RP-5 × ruling R2): the old static "15" was a second clock spoken over
    // the canonical timer, wrong by construction at the 16-minute crossing.
    calm:     'Recommended next step. Recheck in {{minutes}} minutes.',
    standard: 'Recommended next step. Recheck in {{minutes}} minutes.',
    pressure: 'Next step. Hydrate soon.',
  }),
  8: Object.freeze({
    calm:     'Recovery window opening. A water cycle now keeps you in flow.',
    standard: 'Recovery window opening. Time for a water cycle.',
    pressure: 'Recovery opening. Hydrate.',
  }),
  4: Object.freeze({
    calm:     'Recovery window open. Hydration will restore your rhythm.',
    standard: 'Recovery window open. Time for hydration.',
    pressure: 'Recovery open. Hydrate.',
  }),
  0: Object.freeze({
    calm:     'Recovery still pending. Open a water cycle to reset.',
    standard: 'Recovery still pending. Open a water cycle to reset.',
    pressure: 'Recovery pending. Water cycle now.',
  }),
});

/**
 * Find the most-recent threshold the timer has crossed (i.e. the
 * highest alert that *should already have fired* given the current
 * `minutes`). Returns null when the timer is still above the first
 * (16-minute) threshold and no alert has fired yet.
 *
 * Algorithm: smallest T in RISK_THRESHOLDS such that `minutes <= T`.
 * Walking ascending [0, 4, 8, 16] and returning the first match makes
 * this exactly the "last alert crossed" semantic the state machine
 * needs.
 *
 * Examples:
 *   thresholdFor(20) → null   (no alert has fired)
 *   thresholdFor(16) → 16     (first alert just fired)
 *   thresholdFor(12) → 16     (still in the "16 fired" window, 8 not yet)
 *   thresholdFor(8)  → 8      (8 just fired)
 *   thresholdFor(5)  → 8      (still in "8 fired" window)
 *   thresholdFor(4)  → 4
 *   thresholdFor(0)  → 0
 *   thresholdFor(-3) → 0      (clamp negatives to the failure line)
 */
const ASCENDING_THRESHOLDS: ReadonlyArray<RiskThreshold> = Object.freeze([0, 4, 8, 16]);

export function thresholdFor(minutes: number): RiskThreshold | null {
  if (!Number.isFinite(minutes)) return null;
  if (minutes > RISK_THRESHOLDS[0]) return null;
  for (const t of ASCENDING_THRESHOLDS) {
    if (minutes <= t) return t;
  }
  // Unreachable given the > RISK_THRESHOLDS[0] guard above, but
  // satisfies the exhaustive-return type.
  return 16;
}

/**
 * Spoken line for a discrete risk threshold and intensity. Pure lookup,
 * except that a line may reference the LIVE canonical timer: pass
 * `liveMinutes` (the current riskTimer.minutes) and it is spoken as-is;
 * without it the line degrades to the threshold value itself — never a
 * third, invented number (RP-5 × ruling R2).
 */
export function riskTimerLine(
  threshold: RiskThreshold,
  intensity: VoiceIntensity = 'standard',
  liveMinutes?: number,
): string {
  const minutes = Number.isFinite(liveMinutes) ? Math.max(1, Math.round(liveMinutes!)) : threshold;
  return RISK_TIMER_LINES[threshold][intensity].split('{{minutes}}').join(String(minutes));
}

/* ------------------------------------------------------------------ *
 * Completion reward voice
 * ------------------------------------------------------------------ */

const COMPLETION_REWARD_LINES: ReadonlyArray<string> = Object.freeze([
  'Water cycle complete. Hydration reset.',
  'Recovery confirmed. You are back in flow.',
  'Reset complete. Balance restored.',
]);

/**
 * Pick a completion reward line. Deterministic when a numeric `seed`
 * is supplied (drives unit tests + UI replay); random otherwise.
 *
 * The three lines map 1:1 to the spec's "Completion Reward Voice"
 * section.
 */
export function completionRewardLine(seed?: number): string {
  const idx = typeof seed === 'number' && Number.isFinite(seed)
    ? Math.abs(Math.floor(seed)) % COMPLETION_REWARD_LINES.length
    : Math.floor(Math.random() * COMPLETION_REWARD_LINES.length);
  return COMPLETION_REWARD_LINES[idx];
}

/** Read-only accessor for tests + UI counts. */
export function getCompletionRewardLines(): ReadonlyArray<string> {
  return COMPLETION_REWARD_LINES;
}

/* ------------------------------------------------------------------ *
 * Pressure Mode — shorten any system command on the fly
 * ------------------------------------------------------------------ */

const PRESSURE_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = Object.freeze([
  // Filler / hedging — strip everything that softens a command.
  [/\bplease\b/gi,                ''],
  [/\bgo ahead and\b/gi,          ''],
  [/\byou should\b/gi,            ''],
  [/\byou need to\b/gi,           ''],
  [/\bmake sure to\b/gi,          ''],
  [/\bremember to\b/gi,           ''],
  [/\btry to\b/gi,                ''],
  [/\bjust\b/gi,                  ''],
  [/\bquickly\b/gi,               ''],
  [/\ba little\b/gi,              ''],
  [/\bsome\b/gi,                  ''],
  // Time-urgency — collapse every "ASAP" variant to a clean "now".
  [/\bright now\b/gi,             'now'],
  [/\bimmediately\b/gi,           'now'],
  [/\bas soon as possible\b/gi,   'now'],
  [/\bwithout delay\b/gi,         'now'],
  // Volume / units — strip the redundant "of water" qualifier but keep
  // "ounces" intact so the brand canonical unit reads through every channel.
  [/\bof water\b/gi,              ''],
  [/\bone\b/gi,                   '1'],
  [/\btwo\b/gi,                   '2'],
  [/\bthree\b/gi,                 '3'],
  [/\bfour\b/gi,                  '4'],
  [/\beight\b/gi,                 '8'],
  [/\btwelve\b/gi,                '12'],
  [/\bsixteen\b/gi,               '16'],
  [/\btwenty\b/gi,                '20'],
  [/\btwenty-?four\b/gi,          '24'],
  // Cadence — replace conjunctions with a sharp comma cut.
  [/\s+and\s+then\s+/gi,          ', '],
  [/\s+and\s+/gi,                 ', '],
] as const);

/**
 * Convert any system command to its Pressure Mode form: shorter,
 * sharper, more direct. Strips filler, preserves "ounces" as the brand
 * canonical unit, collapses whitespace, and clips to ~10 words. Always
 * ends with a period.
 *
 * Example:
 *   "Drink twelve ounces of water with one AForce stick now."
 *     → "Drink 12 ounces with 1 AForce stick now."
 */
export function pressureCommandLine(command: string): string {
  if (!command || !command.trim()) return '';
  let out = command;
  for (const [re, sub] of PRESSURE_REPLACEMENTS) {
    out = out.replace(re, sub);
  }
  // Collapse whitespace + leading/trailing punctuation noise.
  out = out
    .replace(/\s+([.!?,;:])/g, '$1')
    .replace(/,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;:.!?]+/, '')
    .trim();

  // Capitalize the leading character so the sharpened line still reads
  // like a command rather than a fragment ("drink 12 ounces." → "Drink 12 ounces.").
  if (out.length > 0) out = out[0].toUpperCase() + out.slice(1);

  // CLAUSE-SAFE cadence clip (RP-5, ruling R6): the old hard 10-word cut
  // amputated mid-clause ("… 2 sticks. Recheck in." / Spanish lost "ahora").
  // Pressure Mode may drop WHOLE trailing clauses past the 10-word cadence,
  // but it never severs inside one — a single long sentence stays whole.
  const sentences = out.split(/(?<=[.!?])\s+/);
  let kept = sentences[0];
  let wordCount = kept.split(/\s+/).length;
  for (let i = 1; i < sentences.length; i++) {
    const w = sentences[i].split(/\s+/).length;
    if (wordCount + w > 10) break;
    kept = `${kept} ${sentences[i]}`;
    wordCount += w;
  }
  out = kept;
  // Always terminate so TTS pauses naturally.
  if (!/[.!?]$/.test(out)) out += '.';
  return out;
}

/**
 * Resolve the *effective* command line given the user's intensity and
 * the current performance level. Pressure Mode kicks in when:
 *   - the user has explicitly chosen `'pressure'` intensity, OR
 *   - intensity is `'standard'` AND the user is currently DEPLETED
 *     (so the engine sharpens itself when risk is real).
 * `'calm'` always speaks the original line in full.
 */
export function effectiveCommandLine(
  command: string,
  intensity: VoiceIntensity,
  level: 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED',
): string {
  // RP-5 (ruling R6): DEPLETED is the highest-risk guidance in the app —
  // it is spoken VERBATIM under every intensity. No replacement table, no
  // clip. Safety-critical truth does not adapt to presentation. (The old
  // behavior auto-engaged Pressure Mode at standard+DEPLETED, clipping the
  // canonical instruction mid-clause.)
  if (level === 'DEPLETED') return command;
  if (intensity === 'pressure') return pressureCommandLine(command);
  return command;
}

/* ------------------------------------------------------------------ *
 * Scope filter — single source of truth for "is this category allowed
 * to speak under the current scope?"
 * ------------------------------------------------------------------ */

export type VoiceCategory = 'score_band' | 'risk_timer' | 'system_command' | 'completion';

export function categoryAllowedForScope(category: VoiceCategory, scope: VoiceScope): boolean {
  if (scope === 'muted') return false;
  if (scope === 'all') return true;
  if (scope === 'risk') return category === 'score_band' || category === 'risk_timer';
  // 'commands' — only deliberate user-or-system actions, not passive risk monitoring.
  return category === 'system_command' || category === 'completion';
}
