/**
 * scoreLedgerProjection — the Phase-2 "state-projection" seam (P2b) that lets
 * the shared Command-Event Ledger become the authoritative INPUT SOURCE for
 * the EXISTING hydration score, WITHOUT changing a single byte of the score
 * formula in `utils/scoring/breakdown.ts`.
 *
 * THE SEAM
 * --------
 * `projectScoreStateFromLedgerHybrid(liveState, ledger, now)` returns a clone
 * of the live `UserState` with ONLY the ledger-modeled score families replaced
 * by ledger-derived values. The IDENTICAL `buildBreakdown` then runs on that
 * projected state. A feature flag (`scoreFromLedgerHybrid`, default OFF) is the
 * only thing that would ever select the projected state over the live one — so
 * the formula bytes, contribution ids, and clamping all stay exactly as they
 * are today.
 *
 * FAIL CLOSED (no fabrication)
 * ----------------------------
 * A family is overridden from the ledger ONLY when the ledger can reproduce it
 * LOSSLESSLY. Today that is true for NO score family:
 *  - INTAKE: the score runs each `IntakeEvent` through `materializedIntakePoints`,
 *    which consumes the event's full per-event impact decomposition
 *    (baseImpact / capAdjusted / immediate / delayed / delayedDurationMin). The
 *    ledger's `intake` events store only id/time/oz/units/fluidType — not that
 *    decomposition — so reconstructing `intakeEvents` would require inventing
 *    the missing impact fields. Forbidden ⇒ fail closed to live intake.
 *  - CONTEXT: the ledger's `context_snapshot` records weather/biometric
 *    PROVENANCE only (weatherTempC + a `hasFreshBiometrics` boolean + fetch
 *    timestamps). It does not carry the score's context inputs (heatLoad /
 *    sweatRate / activityLevel), so it cannot reproduce them ⇒ fail closed.
 * Every other family (recovery, confirmation, social, decay) has no ledger
 * representation at all and is inherently live.
 *
 * Because every family fails closed today, the projection is a VERIFIED NO-OP:
 * the projected state is score-equivalent to live, which the parity tests prove
 * across an adversarial state matrix. When the ledger is later enriched with
 * lossless, score-grade events, a family's override can be switched on and the
 * parity gate below will guard the cutover.
 *
 * PARITY GATE
 * -----------
 * `compareScoreParity` is intentionally STRICTER than final-score equality:
 * final-score clamping at 0/100 can hide real input drift, so the gate also
 * requires equality of `decayPerMinute`, `minutesSinceLast`, and every
 * contribution's id, order, and delta. Use `shadowCompareScoreFromLedger` to
 * run live-vs-projected in the background without ever changing the live score.
 *
 * HARD LOCK — Score-Protection: nothing here awards, mutates, or fabricates
 * score. The projection only re-sources INPUTS that describe already-completed
 * behaviour; the score itself is still computed solely by `buildBreakdown`.
 *
 * Pure + RN-free (type-only app imports) so it loads under the vitest pure
 * test runner.
 */

import type { IntakeEvent, ScoreContribution, UserState } from '../../types';
import { buildBreakdown } from './breakdown';
import {
  eventsInWindow,
  type CommandEvent,
  type IntakeCommandEvent,
} from '../intelligence/commandEvents';
import { BEHAVIOR_FRESHNESS_MS } from '../intelligence/commandEventAdapters';

// ─── Family resolution diagnostics ──────────────────────────────────────────────

/** Score input families the ledger could conceivably source. */
export type LedgerScoreFamily = 'intake' | 'context';

/**
 * How one family was resolved during projection. `source: 'ledger'` means the
 * family was losslessly overridden from the ledger; `source: 'live'` means it
 * failed closed to the live value (with a human-readable reason for dev /
 * shadow diagnostics).
 */
export type FamilyResolution =
  | { family: LedgerScoreFamily; source: 'ledger' }
  | { family: LedgerScoreFamily; source: 'live'; reason: string };

export interface ScoreProjection {
  /** The projected UserState to feed `buildBreakdown`. Score-equivalent to
   *  `liveState` whenever every family fails closed (the case today). */
  state: UserState;
  /** Per-family record of what was overridden vs. failed closed. */
  resolutions: FamilyResolution[];
}

// ─── Intake projection (currently always fails closed) ──────────────────────────

export type IntakeProjection =
  | { lossless: true; events: IntakeEvent[] }
  | { lossless: false; events: null; reason: string };

/**
 * Attempt to reproduce the live `intakeEvents` from the ledger. Returns
 * `lossless: false` whenever the ledger cannot do so without fabricating the
 * per-event impact decomposition that `materializedIntakePoints` consumes —
 * which is always the case with today's lossy `intake` event shape. The window
 * membership check is computed honestly for diagnostics, but even an exact
 * id-set match cannot supply the missing impact fields, so this fails closed.
 */
export function tryProjectIntakeEventsFromLedger(
  liveState: UserState,
  ledger: readonly CommandEvent[],
  now: number = Date.now(),
): IntakeProjection {
  const ledgerIntakeInWindow = eventsInWindow(ledger, now - BEHAVIOR_FRESHNESS_MS, now).filter(
    (e): e is IntakeCommandEvent => e.kind === 'intake',
  );
  const liveCount = liveState.intakeEvents?.length ?? 0;

  return {
    lossless: false,
    events: null,
    reason:
      `ledger intake lacks per-event impact decomposition ` +
      `(ledgerWindow=${ledgerIntakeInWindow.length}, live=${liveCount})`,
  };
}

// ─── State projection ───────────────────────────────────────────────────────────

/**
 * Project a ledger-hybrid `UserState` for the score. Pure and fail-closed:
 * families are overridden from the ledger ONLY when lossless; otherwise the
 * live value is preserved verbatim. The clone is shallow — unmodified nested
 * fields are shared by reference and never mutated here.
 */
export function projectScoreStateFromLedgerHybrid(
  liveState: UserState,
  ledger: readonly CommandEvent[],
  now: number = Date.now(),
): ScoreProjection {
  const resolutions: FamilyResolution[] = [];
  const projected: UserState = { ...liveState };

  // INTAKE — override only if the ledger can reproduce intakeEvents losslessly.
  const intake = tryProjectIntakeEventsFromLedger(liveState, ledger, now);
  if (intake.lossless) {
    projected.intakeEvents = intake.events;
    resolutions.push({ family: 'intake', source: 'ledger' });
  } else {
    resolutions.push({ family: 'intake', source: 'live', reason: intake.reason });
  }

  // CONTEXT — the ledger carries weather/biometric provenance only, not the
  // score's heatLoad/sweatRate/activityLevel inputs. Fail closed to live.
  resolutions.push({
    family: 'context',
    source: 'live',
    reason:
      'ledger context_snapshot carries weather/biometric provenance only, ' +
      'not heatLoad/sweatRate/activityLevel',
  });

  return { state: projected, resolutions };
}

// ─── Parity gate (stricter than final-score equality) ───────────────────────────

export type ContributionDriftKind = 'count-mismatch' | 'id-mismatch' | 'delta-mismatch';

export interface ContributionDrift {
  index: number;
  idA: string | null;
  idB: string | null;
  deltaA: number | null;
  deltaB: number | null;
  kind: ContributionDriftKind;
}

export interface ScoreParityField {
  a: number;
  b: number;
  equal: boolean;
}

export interface ScoreParityResult {
  /** True only when score, decayPerMinute, minutesSinceLast, AND every
   *  contribution (id, order, delta) match. */
  inParity: boolean;
  score: ScoreParityField;
  decayPerMinute: ScoreParityField;
  minutesSinceLast: ScoreParityField;
  contributionDrift: ContributionDrift[];
}

function contributionDriftBetween(
  a: ScoreContribution[],
  b: ScoreContribution[],
): ContributionDrift[] {
  const drift: ContributionDrift[] = [];
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ca = a[i];
    const cb = b[i];
    if (!ca || !cb) {
      drift.push({
        index: i,
        idA: ca?.id ?? null,
        idB: cb?.id ?? null,
        deltaA: ca?.delta ?? null,
        deltaB: cb?.delta ?? null,
        kind: 'count-mismatch',
      });
      continue;
    }
    if (ca.id !== cb.id) {
      drift.push({ index: i, idA: ca.id, idB: cb.id, deltaA: ca.delta, deltaB: cb.delta, kind: 'id-mismatch' });
      continue;
    }
    if (ca.delta !== cb.delta) {
      drift.push({ index: i, idA: ca.id, idB: cb.id, deltaA: ca.delta, deltaB: cb.delta, kind: 'delta-mismatch' });
    }
  }
  return drift;
}

/**
 * Compare the score of two states under one fixed clock. Final-score equality
 * alone is unsafe (0/100 clamping masks input drift), so this also compares
 * the continuous decay rate, minutes-since-last, and the full contribution
 * vector by id, order, and delta.
 */
export function compareScoreParity(
  a: UserState,
  b: UserState,
  now: number = Date.now(),
): ScoreParityResult {
  const ba = buildBreakdown(a, now);
  const bb = buildBreakdown(b, now);

  const scoreEqual = ba.score === bb.score;
  const decayEqual = ba.decayPerMinute === bb.decayPerMinute;
  const minutesEqual = ba.minutesSinceLast === bb.minutesSinceLast;
  const contributionDrift = contributionDriftBetween(ba.contributions, bb.contributions);

  return {
    inParity: scoreEqual && decayEqual && minutesEqual && contributionDrift.length === 0,
    score: { a: ba.score, b: bb.score, equal: scoreEqual },
    decayPerMinute: { a: ba.decayPerMinute, b: bb.decayPerMinute, equal: decayEqual },
    minutesSinceLast: { a: ba.minutesSinceLast, b: bb.minutesSinceLast, equal: minutesEqual },
    contributionDrift,
  };
}

/**
 * Shadow-compare: project the ledger-hybrid state and compare its score to the
 * live score WITHOUT ever changing the live score. This is the only intended
 * runtime use while `scoreFromLedgerHybrid` is OFF — record `parity.inParity`
 * (and any drift) for dev diagnostics; never swap to `projection.state` until
 * contribution-level parity is proven across the live population.
 */
export function shadowCompareScoreFromLedger(
  liveState: UserState,
  ledger: readonly CommandEvent[],
  now: number = Date.now(),
): { projection: ScoreProjection; parity: ScoreParityResult } {
  const projection = projectScoreStateFromLedgerHybrid(liveState, ledger, now);
  const parity = compareScoreParity(liveState, projection.state, now);
  return { projection, parity };
}
