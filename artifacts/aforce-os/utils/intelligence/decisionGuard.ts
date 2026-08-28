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
import { DECISION_GUARD_MAX_DOSE_OZ } from '../../config/hydroStateModel';
import { consumerCopyBlocked } from './languageGate/runtimeClaimScan';

export type DecisionGuardReason =
  | 'malformed'
  | 'unsafe_dose'
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
 * Judge one deliverable command. Pure and deterministic; the reason is
 * diagnostics/ledger material and is never surfaced to the member
 * (validateRecoveryCommand precedent).
 */
export function evaluateEngineCommand(cmd: Command | null | undefined): DecisionGuardResult {
  if (!cmd || !cmd.id || !cmd.action) return { verdict: 'blocked', reason: 'malformed' };
  const surfaces = [cmd.action, cmd.explanation ?? ''];
  for (const text of surfaces) {
    if (doseOutOfBounds(text)) return { verdict: 'blocked', reason: 'unsafe_dose' };
  }
  for (const text of surfaces) {
    if (COMMERCIAL_STEERING.some((p) => p.test(text))) {
      return { verdict: 'blocked', reason: 'commercial_bias' };
    }
  }
  for (const text of surfaces) {
    if (text && consumerCopyBlocked(text)) return { verdict: 'blocked', reason: 'blocked_language' };
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
