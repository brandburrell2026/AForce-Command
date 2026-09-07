/**
 * ENVIRONMENTAL INTERPRETATION — truthful evidence becomes useful meaning.
 *
 * The governing chain, and this module's exact place in it:
 *
 *     EnvironmentalEvidence → INTERPRETATION → Context Arbitration
 *                           → RecoveryCommand authority → presentation
 *
 * Environmental may INTERPRET. It may PRIORITIZE context. It may say that
 * nothing needs attention. It is not a second command authority and it does
 * not produce a second hero score.
 *
 * That boundary is enforced by shape, not by convention: `EnvironmentalRead`
 * carries no action, no dose, no timing, no score and no urgency. There is
 * nothing here for a consumer to render as a command, so a future surface
 * cannot accidentally promote this into one. `RecoveryCommand` remains the
 * sole authority for what the member should personally do.
 *
 * ── NO INVENTED RISK NUMBER ────────────────────────────────────────────────
 *
 * There is deliberately no environmental score. Each signal is placed on the
 * PUBLISHED band scale that already governs it — the NWS heat-index ladder,
 * the WHO UV index, the US EPA AQI — and the states below are read off those
 * bands. A 0–100 "environmental risk" would be a number we made up, and every
 * consumer would immediately start comparing it to the hydration score.
 *
 * ── ABSENCE IS NEVER GOOD NEWS ─────────────────────────────────────────────
 *
 * The defect this whole program exists to kill, in its final form: nothing
 * observed must never read as CLEAR. Conditions can only be called benign on
 * the strength of evidence that they ARE benign. With nothing current to look
 * at, the answer is INSUFFICIENT — and partial evidence lowers `certainty`
 * rather than quietly completing the picture.
 *
 * ── ONE READING, NOT THREE ─────────────────────────────────────────────────
 *
 * Signals are arbitrated into a SINGLE interpretation. Heat and humidity are
 * combined physiologically (they are one fact — the heat index — not two), and
 * the remaining signals are resolved against one another rather than each
 * emitting its own competing headline.
 */
import {
  reclassify,
  DEFAULT_VALIDITY_POLICY,
  type EnvironmentalEvidence,
  type UnobservedReason,
  type ValidityPolicy,
} from './environmentalEvidence';
import { computeHeatIndex } from '../../services/heatRiskEngine';

// ─── The states ─────────────────────────────────────────────────────────────

/**
 * What the environment warrants. Ordered by how much of the member's attention
 * it asks for — and the first two ask for none.
 */
export type EnvironmentalState =
  /** Nothing current to interpret. NOT a verdict about conditions. */
  | 'insufficient'
  /** Observed, and benign. Nothing needs attention. A real answer. */
  | 'clear'
  /** Meaningful context exists, but it does not warrant an intervention. */
  | 'aware'
  /** Conditions materially affect preparation and should be surfaced. */
  | 'prepare'
  /** Strong evidence warrants elevated attention. */
  | 'caution';

/** How much of the picture we could actually see. */
export type InterpretationCertainty = 'low' | 'moderate' | 'high';

/** Where one signal sits on its own published scale. */
export type SignalConcern = 'benign' | 'notable' | 'significant' | 'severe';

/**
 * What the read asks of the member. Deliberately three-valued: `no_action` and
 * `attention` are claims, and `unknown` is the honest absence of one.
 *
 * A pair of booleans (`noActionNeeded` / `warrantsAttention`) would be two
 * rules for one question, free to drift apart the way the live and ledger
 * freshness verdicts did in PR5. This is the single rule both accessors read.
 */
export type AttentionDisposition = 'no_action' | 'attention' | 'unknown';

function dispositionFor(state: EnvironmentalState): AttentionDisposition {
  switch (state) {
    // Conditions observed; nothing here justifies interrupting the member.
    // AWARE joins CLEAR because meaningful context is not an intervention.
    case 'clear':
    case 'aware':
      return 'no_action';
    case 'prepare':
    case 'caution':
      return 'attention';
    case 'insufficient':
      return 'unknown';
  }
}

/** The interpretable signals. Each maps to a published band scale. */
export type InterpretedSignal = 'heat' | 'uvIndex' | 'airQuality';

export interface EnvironmentalFactor {
  readonly signal: InterpretedSignal;
  readonly concern: SignalConcern;
  /** The value the band was read from, in `unit`. */
  readonly value: number;
  readonly unit: 'heatIndexF' | 'uvIndex' | 'aqiUs';
  /** The published band this fell in, named — never a made-up number. */
  readonly band: string;
}

export interface UnavailableSignal {
  readonly signal: InterpretedSignal;
  /**
   * Why it could not be interpreted. `stale` is called out separately from
   * absence because they are different facts about our knowledge.
   */
  readonly reason: UnobservedReason | 'stale' | 'incomplete';
}

/**
 * The whole output. Note what is NOT here: no action, no dose, no urgency, no
 * score, no timing. Interpretation, and the honesty about its own limits.
 */
export interface EnvironmentalRead {
  readonly state: EnvironmentalState;
  readonly certainty: InterpretationCertainty;
  /** Every observed signal that was interpreted, strongest concern first. */
  readonly factors: readonly EnvironmentalFactor[];
  /** Every signal we could NOT interpret, and why. */
  readonly unavailable: readonly UnavailableSignal[];
  /**
   * Whether the member's attention is warranted — as ONE rule with THREE
   * honest outcomes, never two booleans that can drift apart.
   *
   * `unknown` is not a hedge: with nothing current to look at we can neither
   * ask for attention nor promise none is needed.
   */
  readonly attention: AttentionDisposition;
  /** The validity policy this read was made under. */
  readonly policyVersion: string;
}

/** The evidence this module interprets. Any signal may be absent. */
export interface EnvironmentalInputs {
  readonly temperature?: EnvironmentalEvidence<number>;
  readonly humidity?: EnvironmentalEvidence<number>;
  readonly uvIndex?: EnvironmentalEvidence<number>;
  readonly airQuality?: EnvironmentalEvidence<number>;
}

// ─── Published band scales ──────────────────────────────────────────────────
//
// Every threshold below is someone else's published science, cited. None was
// chosen to make the states come out a particular way.

/** NWS heat index ladder (°F): Caution / Extreme Caution / Danger. */
function heatConcern(heatIndexF: number): { concern: SignalConcern; band: string } {
  if (heatIndexF >= 103) return { concern: 'severe', band: 'NWS Danger' };
  if (heatIndexF >= 90) return { concern: 'significant', band: 'NWS Extreme Caution' };
  if (heatIndexF >= 80) return { concern: 'notable', band: 'NWS Caution' };
  return { concern: 'benign', band: 'below NWS Caution' };
}

/** WHO Global Solar UV Index. */
function uvConcern(uv: number): { concern: SignalConcern; band: string } {
  if (uv >= 8) return { concern: 'severe', band: 'WHO Very High' };
  if (uv >= 6) return { concern: 'significant', band: 'WHO High' };
  if (uv >= 3) return { concern: 'notable', band: 'WHO Moderate' };
  return { concern: 'benign', band: 'WHO Low' };
}

/** US EPA Air Quality Index. */
function aqiConcern(aqi: number): { concern: SignalConcern; band: string } {
  if (aqi >= 151) return { concern: 'severe', band: 'EPA Unhealthy' };
  if (aqi >= 101) return { concern: 'significant', band: 'EPA Unhealthy for Sensitive Groups' };
  if (aqi >= 51) return { concern: 'notable', band: 'EPA Moderate' };
  return { concern: 'benign', band: 'EPA Good' };
}

const CONCERN_RANK: Record<SignalConcern, number> = {
  benign: 0, notable: 1, significant: 2, severe: 3,
};

const STATE_FOR_CONCERN: Record<SignalConcern, EnvironmentalState> = {
  benign: 'clear', notable: 'aware', significant: 'prepare', severe: 'caution',
};

// ─── Evidence handling ──────────────────────────────────────────────────────

type Resolved =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly reason: UnobservedReason | 'stale' };

/**
 * A signal's current value, or precisely why there isn't one.
 *
 * Re-classified against `now` first, so evidence that expired between capture
 * and interpretation is caught. Stale is reported as its own reason: it is a
 * different fact about our knowledge than never having asked.
 */
function resolveSignal(
  evidence: EnvironmentalEvidence<number> | undefined,
  now: number,
  policy: ValidityPolicy,
): Resolved {
  if (!evidence) return { ok: false, reason: 'never_requested' };
  const current = reclassify(evidence, now, { policy });
  if (current.kind === 'observed') return { ok: true, value: current.value };
  if (current.kind === 'stale') return { ok: false, reason: 'stale' };
  return { ok: false, reason: current.reason };
}

const cToF = (c: number) => c * (9 / 5) + 32;

// ─── The interpretation ─────────────────────────────────────────────────────

/**
 * Interpret the environment. Deterministic in `(inputs, now, policy)` — the
 * P0.5 contract; no wall clock is read anywhere in this module.
 */
export function interpretEnvironment(
  inputs: EnvironmentalInputs,
  now: number,
  policy: ValidityPolicy = DEFAULT_VALIDITY_POLICY,
): EnvironmentalRead {
  const factors: EnvironmentalFactor[] = [];
  const unavailable: UnavailableSignal[] = [];

  // ── Heat: temperature and humidity are ONE fact, not two ─────────────────
  //
  // The heat index is what a body actually experiences, and 34 °C at 20 %
  // humidity is a different world from 34 °C at 85 %. Interpreting them
  // separately would produce exactly the competing signals this must not have.
  const temp = resolveSignal(inputs.temperature, now, policy);
  const humidity = resolveSignal(inputs.humidity, now, policy);
  if (!temp.ok) {
    unavailable.push({ signal: 'heat', reason: temp.reason });
  } else {
    const tempF = cToF(temp.value);
    if (tempF < 80) {
      // Below the NWS table's floor the index IS the temperature, so humidity
      // cannot change the verdict and its absence costs nothing.
      const { concern, band } = heatConcern(tempF);
      factors.push({ signal: 'heat', concern, value: tempF, unit: 'heatIndexF', band });
    } else if (!humidity.ok) {
      // At or above 80 °F humidity decides the answer. We will NOT substitute
      // a neutral humidity to complete the calculation — that is the PR1
      // defect exactly, and it would let an unknown become a comfortable
      // verdict on a genuinely hot day.
      unavailable.push({ signal: 'heat', reason: 'incomplete' });
    } else {
      const hi = computeHeatIndex(tempF, humidity.value);
      const { concern, band } = heatConcern(hi);
      factors.push({ signal: 'heat', concern, value: hi, unit: 'heatIndexF', band });
    }
  }

  // ── UV and air quality: independent exposures, published scales ──────────
  const uv = resolveSignal(inputs.uvIndex, now, policy);
  if (uv.ok) {
    const { concern, band } = uvConcern(uv.value);
    factors.push({ signal: 'uvIndex', concern, value: uv.value, unit: 'uvIndex', band });
  } else {
    unavailable.push({ signal: 'uvIndex', reason: uv.reason });
  }

  const aqi = resolveSignal(inputs.airQuality, now, policy);
  if (aqi.ok) {
    const { concern, band } = aqiConcern(aqi.value);
    factors.push({ signal: 'airQuality', concern, value: aqi.value, unit: 'aqiUs', band });
  } else {
    unavailable.push({ signal: 'airQuality', reason: aqi.reason });
  }

  factors.sort((a, b) => CONCERN_RANK[b.concern] - CONCERN_RANK[a.concern]);

  // ── ABSENCE IS NEVER GOOD NEWS ───────────────────────────────────────────
  if (factors.length === 0) {
    return {
      state: 'insufficient',
      certainty: 'low',
      factors: [],
      unavailable,
      // Not "no action needed" — we cannot say that. We simply cannot see.
      // Routed through the SAME mapping as every other state rather than
      // hardcoded here: a second place to decide disposition is a second rule.
      attention: dispositionFor('insufficient'),
      policyVersion: policy.version,
    };
  }

  // ── Arbitration: ONE reading from all observed signals ───────────────────
  const peak = factors.reduce<SignalConcern>(
    (worst, f) => (CONCERN_RANK[f.concern] > CONCERN_RANK[worst] ? f.concern : worst),
    'benign',
  );
  let state = STATE_FOR_CONCERN[peak];

  // COMPOUNDING, stated as a rule rather than summed into a score: two or more
  // signals independently at `significant` is a materially different day from
  // one, because the exposures stack on the same body. This escalates
  // PREPARE to CAUTION and nothing else — it can never manufacture concern
  // from benign signals, and it cannot escalate past the top of the ladder.
  const significantOrWorse = factors.filter(
    (f) => CONCERN_RANK[f.concern] >= CONCERN_RANK.significant,
  ).length;
  if (state === 'prepare' && significantOrWorse >= 2) state = 'caution';

  // ── Certainty: how much of the picture we actually saw ───────────────────
  //
  // Note this is about COVERAGE, not about confidence in the verdict. A single
  // observed signal can still support a `caution` — a 105 °F heat index needs
  // no corroboration — but the member is entitled to know we saw one thing.
  const certainty: InterpretationCertainty =
    factors.length >= 3 ? 'high' : factors.length === 2 ? 'moderate' : 'low';

  return {
    state,
    certainty,
    factors,
    unavailable,
    // FIRST-CLASS NO-ACTION: a positive finding that the observed environment
    // does not warrant interrupting the member — reachable only with evidence.
    attention: dispositionFor(state),
    policyVersion: policy.version,
  };
}

/**
 * Whether this read should interrupt the member at all.
 *
 * Exposed so the no-action path is executable rather than implied: a consumer
 * asks this ONE question instead of each surface inventing its own threshold
 * and drifting from the others — the defect PR5 spent itself on.
 */
export function warrantsAttention(read: EnvironmentalRead): boolean {
  return read.attention === 'attention';
}

/**
 * The no-action answer, first-class and executable.
 *
 * Note this is NOT `!warrantsAttention`. An insufficient read warrants no
 * attention AND cannot promise that none is needed — saying "nothing needs
 * attention" on the strength of no evidence is the defect this program has
 * spent itself removing.
 */
export function noActionNeeded(read: EnvironmentalRead): boolean {
  return read.attention === 'no_action';
}
