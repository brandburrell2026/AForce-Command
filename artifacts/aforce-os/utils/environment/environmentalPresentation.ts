/**
 * ENVIRONMENTAL PRESENTATION — the view model between `EnvironmentalRead` and
 * the Visual OS surface.
 *
 * THE PRINCIPLE THIS ENCODES: the environment carries the meaning; typography
 * explains it. So this layer's job is to decide WHAT IS DOMINANT, name it in
 * one short line, and keep everything else quiet — not to assemble a dashboard.
 *
 * ── WHAT IT REFUSES TO PRODUCE ─────────────────────────────────────────────
 *
 * There is no action, dose, timing or urgency field here, and none can be
 * added without changing the type. `RecoveryCommand` remains the sole author
 * of what the member should DO; this describes the world they are doing it in.
 * The separation is structural: a surface reading this object has nothing to
 * render as a command even if it wanted to.
 *
 * It also cannot express things the read does not prove:
 *   - no ambient temperature (the heat factor's value is a heat index in °F,
 *     and printing it as "it is 31°C" is the fabrication we keep repairing);
 *   - no observation age (the read carries no timestamp — presence in
 *     `factors` already means "current under the policy", so recency is
 *     implied rather than claimed);
 *   - no published band strings as consumer copy.
 *
 * ── COPY ───────────────────────────────────────────────────────────────────
 *
 * English constants, deliberately: this surface ships flag-off and internal,
 * and the repo carries ELEVEN locales. Wiring an i18n namespace for copy the
 * founder is still shaping would translate a moving target. i18n is a gate
 * before member-facing enablement, recorded here so it is not forgotten.
 */
import type {
  EnvironmentalRead,
  EnvironmentalFactor,
  InterpretedSignal,
  SignalConcern,
  EnvironmentalState,
  UnavailableSignal,
} from './environmentalInterpretation';

// ─── Dominance ──────────────────────────────────────────────────────────────

/**
 * Tie-break order when two signals share the strongest concern.
 *
 * DECLARED, not emergent. Before this, factor order fell out of array push
 * order plus a stable sort — an accident a surface would then depend on. The
 * order is by how directly each constrains a working body: heat limits the
 * engine, air limits the breathing that feeds it, UV is exposure the member
 * can dress for.
 */
const DOMINANCE_ORDER: readonly InterpretedSignal[] = ['heat', 'airQuality', 'uvIndex'];

const CONCERN_RANK: Record<SignalConcern, number> = {
  benign: 0, notable: 1, significant: 2, severe: 3,
};

/**
 * The one factor that earns visual hierarchy, or null when none does.
 *
 * Null is a real answer, not a fallback: when nothing is above benign the
 * honest composition is an open field, and promoting the "least benign"
 * signal would manufacture a concern out of a calm day.
 */
export function dominantFactor(
  factors: readonly EnvironmentalFactor[],
): EnvironmentalFactor | null {
  let best: EnvironmentalFactor | null = null;
  for (const f of factors) {
    if (CONCERN_RANK[f.concern] === 0) continue;
    if (best == null) { best = f; continue; }
    const byConcern = CONCERN_RANK[f.concern] - CONCERN_RANK[best.concern];
    if (byConcern > 0) { best = f; continue; }
    if (byConcern === 0 &&
      DOMINANCE_ORDER.indexOf(f.signal) < DOMINANCE_ORDER.indexOf(best.signal)) {
      best = f;
    }
  }
  return best;
}

// ─── Consumer vocabulary ────────────────────────────────────────────────────

/**
 * Per-signal words for a concern level.
 *
 * Derived from `concern`, NEVER from `factor.band`. The band strings are
 * internal identifiers naming published ladders ("EPA Unhealthy for Sensitive
 * Groups"), typed as a bare `string`, and truncated at their top rung — they
 * are not consumer language and must never be printed.
 */
const CONCERN_WORD: Record<InterpretedSignal, Record<SignalConcern, string>> = {
  heat: { benign: 'LOW', notable: 'RISING', significant: 'HIGH', severe: 'SEVERE' },
  airQuality: { benign: 'GOOD', notable: 'MODERATE', significant: 'POOR', severe: 'UNHEALTHY' },
  uvIndex: { benign: 'LOW', notable: 'MODERATE', significant: 'HIGH', severe: 'VERY HIGH' },
};

const SIGNAL_LABEL: Record<InterpretedSignal, string> = {
  heat: 'HEAT', airQuality: 'AIR', uvIndex: 'UV',
};

/** The one line that names what the environment is doing. */
const DOMINANT_LINE: Record<InterpretedSignal, string> = {
  heat: 'THE HEAT IS THE LIMITER.',
  airQuality: 'AIR IS WORKING AGAINST YOU.',
  uvIndex: 'UV IS THE FACTOR TO WATCH.',
};

const CLEAR_LINE = 'CONDITIONS ARE WORKING WITH YOU.';
const INSUFFICIENT_LINE = 'WE NEED MORE SIGNAL.';

/** Why a signal is missing, in language a member owns. */
const UNAVAILABLE_COPY: Record<string, string> = {
  permission_denied: 'Location is off for AForce.',
  never_requested: 'AForce has not asked for location yet.',
  provider_unavailable: 'Could not reach the environment service.',
  not_supported: 'Not available on this device.',
  demo_withheld: 'Demo data is never used here.',
  stale: 'The last reading is too old to trust.',
  incomplete: 'Not enough to read the heat.',
};

// ─── The view model ─────────────────────────────────────────────────────────

/** A quietly-listed secondary factor. */
export interface SecondaryRow {
  readonly signal: InterpretedSignal;
  readonly label: string;
  readonly word: string;
  /** UV index / AQI only — heat is deliberately numberless. */
  readonly value: number | null;
}

export interface EnvironmentalView {
  readonly state: EnvironmentalState;
  /** The state word the field is built around. */
  readonly stateWord: string;
  /** One short sentence. Never a paragraph. */
  readonly line: string;
  /** The factor that earns visual hierarchy, or null for an open field. */
  readonly dominant: {
    readonly signal: InterpretedSignal;
    readonly label: string;
    readonly word: string;
    readonly value: number | null;
  } | null;
  /** Everything else, available without competing. */
  readonly secondary: readonly SecondaryRow[];
  /** Coverage, in plain words. */
  readonly signalQuality: string;
  /** What we could not see, and why — one sentence each. */
  readonly gaps: readonly { readonly label: string; readonly reason: string }[];
  /** Whether the AForce action block may appear at all. */
  readonly showsCommand: boolean;
}

const STATE_WORD: Record<EnvironmentalState, string> = {
  clear: 'CLEAR', aware: 'AWARE', prepare: 'PREPARE',
  caution: 'CAUTION', insufficient: 'INSUFFICIENT',
};

const QUALITY: Record<string, string> = {
  high: 'Reading all three environmental signals.',
  moderate: 'Reading two of three environmental signals.',
  low: 'Limited environmental signal.',
};

/**
 * A number the member can legitimately read.
 *
 * UV index and AQI are published consumer scales, so their values are the
 * member's own vocabulary. HEAT IS DELIBERATELY NUMBERLESS: its value is a
 * heat index in °F, and any numeral beside the word "HEAT" reads as the
 * temperature — the exact confusion the founder ruled out.
 */
function displayValue(f: EnvironmentalFactor): number | null {
  return f.signal === 'heat' ? null : Math.round(f.value);
}

const rowFor = (f: EnvironmentalFactor): SecondaryRow => ({
  signal: f.signal,
  label: SIGNAL_LABEL[f.signal],
  word: CONCERN_WORD[f.signal][f.concern],
  value: displayValue(f),
});

export function buildEnvironmentalView(read: EnvironmentalRead): EnvironmentalView {
  // No `insufficient` special case: that state exists precisely BECAUSE there
  // are no factors, so `dominantFactor` already answers null. A second guard
  // here would be a second place deciding one thing — and it would be dead,
  // which is worse than redundant because nothing could ever test it. The
  // cross-module invariant it would have defended is pinned by a law instead.
  const dominantF = dominantFactor(read.factors);

  const secondary = read.factors
    .filter((f) => f !== dominantF)
    .sort((a, b) => DOMINANCE_ORDER.indexOf(a.signal) - DOMINANCE_ORDER.indexOf(b.signal))
    .map(rowFor);

  const line = read.state === 'insufficient'
    ? INSUFFICIENT_LINE
    : dominantF
      ? DOMINANT_LINE[dominantF.signal]
      : CLEAR_LINE;

  const gaps = read.unavailable.map((u: UnavailableSignal) => ({
    label: SIGNAL_LABEL[u.signal],
    reason: UNAVAILABLE_COPY[u.reason] ?? UNAVAILABLE_COPY['provider_unavailable']!,
  }));

  return {
    state: read.state,
    stateWord: STATE_WORD[read.state],
    line,
    dominant: dominantF
      ? {
          signal: dominantF.signal,
          label: SIGNAL_LABEL[dominantF.signal],
          word: CONCERN_WORD[dominantF.signal][dominantF.concern],
          value: displayValue(dominantF),
        }
      : null,
    secondary,
    signalQuality: QUALITY[read.certainty] ?? QUALITY['low']!,
    gaps,
    // The AForce block appears only when the environment actually warrants
    // attention. No-action is first class: a calm environment must not be
    // padded with recommendations merely because a surface exists.
    showsCommand: read.attention === 'attention',
  };
}
