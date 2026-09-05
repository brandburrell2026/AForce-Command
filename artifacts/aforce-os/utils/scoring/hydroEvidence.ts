/**
 * HYDRO EVIDENCE — the explicit epistemic state of a member's HydroState.
 *
 * WHY THIS TYPE EXISTS. Before it, "AForce has never observed this member" and
 * "AForce observed this member and they have consumed nothing" were the SAME
 * VALUE: `ozConsumedToday === 0`. `breakdown.ts` multiplies that zero into a
 * coverage of 0, the band resolves DEPLETED, and `generateCommand` issues
 * `cmd-depleted` — "Recovery needed: 20 oz water + 2 sticks", urgency critical,
 * "+18 to score". Executed on the real production path, a brand-new member and
 * a genuinely depleted member with three days of history and a urine reading of
 * 7 produced BYTE-IDENTICAL commands.
 *
 * That is a physiological verdict and a product prescription issued about a
 * body AForce has never measured, and it violates the constitution directly:
 * code calculates, AI explains, neither invents measurements.
 *
 * The Wave-5 evidence gate already knew the truth — it withholds the hero
 * number and band for exactly this member (`resolveHomeEvidence` → 'building').
 * But it lived in Home only, so the command lane never consulted it, and Home
 * rendered "Building your baseline / AForce is learning how your body responds"
 * directly above a critical two-stick prescription.
 *
 * ── WHY A TAGGED UNION AND NOT A SENTINEL ─────────────────────────────────
 *
 * Every cheaper option re-creates the defect it is meant to fix:
 *   - `score: 0`      — the exact collapse we are removing.
 *   - `score: null`   — a nullable that every consumer must remember to check,
 *                       and `?? 0` silently restores DEPLETED.
 *   - `score: -1`     — a sentinel inside the numeric domain; arithmetic and
 *                       comparisons still "work" and produce nonsense.
 *   - a boolean flag  — orthogonal to the score, so the two can disagree.
 *
 * A tagged union makes the illegal state UNREPRESENTABLE: there is no numeric
 * field to read on the `unknown` arm, so a consumer cannot accidentally recover
 * a band from it. Reading a score requires narrowing the tag first, which is a
 * compile-time obligation rather than a convention.
 *
 * MEASURED ZERO REMAINS A FIRST-CLASS OBSERVATION. `{ kind: 'observed' }` with
 * zero intake is a real reading and must keep producing the real DEPLETED
 * command. Only genuine absence of observation takes the `unknown` arm.
 */

/**
 * Has AForce observed this member well enough to interpret their physiology?
 *
 * `unknown` carries NO score and NO band — deliberately. There is nothing on
 * this arm for a consumer to misread as a reading.
 */
export type HydroEvidence =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'observed' };

/** The singleton no-evidence state. */
export const EVIDENCE_UNKNOWN: HydroEvidence = { kind: 'unknown' };

/**
 * The default for every existing caller. Passing this preserves today's
 * behaviour byte-for-byte — which is what keeps controls 2, 3 and 4 unchanged
 * while only the genuinely-unobserved member moves.
 */
export const EVIDENCE_OBSERVED: HydroEvidence = { kind: 'observed' };

export interface HydroEvidenceInputs {
  /** Intake events on the current state (today's observations). */
  readonly intakeEventCount: number;
  /**
   * REAL (non-synthetic) history entries. `null` means "not answered yet" —
   * never "none". A store that has not hydrated must not be read as an absence
   * of history, or a returning member would flash the baseline command.
   */
  readonly loggedDayCount: number | null;
}

/**
 * Resolve the epistemic state from the two signals the app already has.
 *
 * Deliberately mirrors `components/home/homeBaselineState.resolveHomeEvidence`
 * so the hero and the command can never disagree about whether the member has
 * been observed — the contradiction that made this defect visible. The law
 * `homeAndCommandAgree` pins the two together.
 *
 * FAILS SAFE TOWARD `observed`: an un-hydrated store (`loggedDayCount === null`)
 * with no local events resolves to `unknown` ONLY because that is the genuine
 * first-launch shape; any positive signal on either input is enough to be
 * observed. A wrong `unknown` costs a returning member one neutral card; a
 * wrong `observed` puts an invented verdict in front of someone. The asymmetry
 * is deliberate.
 */
export function resolveHydroEvidence(input: HydroEvidenceInputs): HydroEvidence {
  const { intakeEventCount, loggedDayCount } = input;
  if (Number.isFinite(intakeEventCount) && intakeEventCount > 0) return EVIDENCE_OBSERVED;
  if (loggedDayCount !== null && Number.isFinite(loggedDayCount) && loggedDayCount > 0) {
    return EVIDENCE_OBSERVED;
  }
  return EVIDENCE_UNKNOWN;
}

/** Narrowing helper so consumers read intent rather than compare strings. */
export function isEvidenceUnknown(evidence: HydroEvidence | undefined): boolean {
  return evidence?.kind === 'unknown';
}
