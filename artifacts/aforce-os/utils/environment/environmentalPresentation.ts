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
 * Localized through the `environment.*` namespace in all eleven locales. The
 * approved English creative direction is unchanged — the translations carry
 * the same meaning, and none of them softens a truth guarantee:
 *
 *   - concern WORDS still derive from `concern`, never from `factor.band`, so
 *     no published ladder name can reach a member in any language;
 *   - heat still resolves to no number in any locale;
 *   - each unavailable reason keeps its own distinct sentence, so a refusal
 *     never reads as an outage;
 *   - INSUFFICIENT keeps a line that no other state shares.
 *
 * TYPOGRAPHIC NOTE, flagged rather than improvised: the approved direction is
 * set in uppercase. Japanese, Korean, Chinese, Hindi and Arabic have no letter
 * case, so the ALL-CAPS register simply does not exist there. The meaning is
 * carried faithfully; the visual emphasis is a Latin-script property and the
 * type scale does the work in the other five.
 */
import i18n from '../../services/i18nService';
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
/** i18n suffix per interpreted signal. `airQuality`/`uvIndex` shorten to the
 *  member-facing words the design uses. */
const SIGNAL_KEY: Record<InterpretedSignal, 'heat' | 'air' | 'uv'> = {
  heat: 'heat', airQuality: 'air', uvIndex: 'uv',
};

const concernWord = (signal: InterpretedSignal, concern: SignalConcern): string =>
  i18n.t(`environment.word.${SIGNAL_KEY[signal]}.${concern}`);

const signalLabel = (signal: InterpretedSignal): string =>
  i18n.t(`environment.signal.${SIGNAL_KEY[signal]}`);

/** The one line that names what the environment is doing. */
const dominantLine = (signal: InterpretedSignal): string =>
  i18n.t(`environment.line.${SIGNAL_KEY[signal]}`);

// ─── The view model ─────────────────────────────────────────────────────────

/** A quietly-listed secondary factor. */
export interface SecondaryRow {
  readonly signal: InterpretedSignal;
  readonly label: string;
  readonly word: string;
  /** UV index / AQI only — heat is deliberately numberless. */
  readonly value: number | null;
}

/**
 * What the member can DO about missing evidence — the resolution path, not a
 * command.
 *
 * Device smoke on build 75 found the gap this closes: the screen truthfully
 * refused to invent HEAT / UV / AIR and said "AForce has not asked for
 * location yet", but offered no way to change that. Correct, and useless.
 *
 * This is a MACHINE-READABLE hint, deliberately separate from the `gaps` copy:
 * a surface must never parse localized prose to decide which button to show.
 */
export type EnvironmentalResolution =
  /** Nobody has asked. One intentional CTA may request permission. */
  | 'enable_location'
  /** The member said no. Never re-ask — offer the OS settings path instead. */
  | 'open_settings'
  /** Permission is fine; the provider failed. An explicit retry is honest. */
  | 'retry'
  /** Nothing the member can usefully do. Offer nothing. */
  | 'none';

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
  /**
   * The one thing a member can do about missing evidence, if anything.
   *
   * Note what this is NOT: an action about their body. It resolves OUR ability
   * to see, never theirs to hydrate — `RecoveryCommand` remains the sole
   * author of anything the member should do for themselves.
   */
  readonly resolution: EnvironmentalResolution;
}

/**
 * Resolution precedence, and why this order.
 *
 * A REFUSAL OUTRANKS AN UNASKED SIGNAL: if the member has already said no to
 * location, offering "Enable Location" would either do nothing (iOS will not
 * re-prompt) or nag them about a decision they already made. Settings is the
 * only honest path once denied.
 *
 * A PROVIDER FAILURE NEVER OFFERS ENABLE LOCATION. Permission is fine in that
 * case, and implying the member did something wrong would be the same class of
 * lie as calling their refusal an outage.
 */
function resolutionFor(reasons: readonly string[]): EnvironmentalResolution {
  if (reasons.includes('permission_denied')) return 'open_settings';
  if (reasons.includes('never_requested')) return 'enable_location';
  if (reasons.includes('provider_unavailable')) return 'retry';
  return 'none';
}

const stateWordFor = (state: EnvironmentalState): string =>
  i18n.t(`environment.state.${state}`);

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
  label: signalLabel(f.signal),
  word: concernWord(f.signal, f.concern),
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
    ? i18n.t('environment.line.insufficient')
    : dominantF
      ? dominantLine(dominantF.signal)
      : i18n.t('environment.line.clear');

  const gaps = read.unavailable.map((u: UnavailableSignal) => ({
    label: signalLabel(u.signal),
    // Each cause keeps its own sentence in every locale: a refusal must never
    // read as an outage, and an outage must never read as a refusal.
    reason: i18n.t(`environment.unavailable.${u.reason}`),
  }));

  return {
    state: read.state,
    stateWord: stateWordFor(read.state),
    line,
    dominant: dominantF
      ? {
          signal: dominantF.signal,
          label: signalLabel(dominantF.signal),
          word: concernWord(dominantF.signal, dominantF.concern),
          value: displayValue(dominantF),
        }
      : null,
    secondary,
    signalQuality: i18n.t(`environment.quality.${read.certainty}`),
    gaps,
    // The AForce block appears only when the environment actually warrants
    // attention. No-action is first class: a calm environment must not be
    // padded with recommendations merely because a surface exists.
    showsCommand: read.attention === 'attention',
    resolution: resolutionFor(read.unavailable.map((u) => u.reason)),
  };
}
