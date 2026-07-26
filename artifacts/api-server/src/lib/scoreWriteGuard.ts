/**
 * Score Protection write gate — RC-L8b / N-5 / R-29.
 *
 * WHY THIS EXISTS (PASS-2 audit finding):
 * The HydroState principle is that the score changes ONLY from verified,
 * completed behavior — never from raw intent, taps, or unverified client input.
 * The audit found this was DOCUMENTED-ONLY: the snapshot write path
 * (`routes/aforce/journal.ts`) persisted any client-supplied score 0–100 with
 * no gate. This module is the enforcement point.
 *
 * THIS IS NOT SCORING MATH. It never computes, awards, or mutates a score, and
 * it never touches `scoringEngine.ts` / `statusColor.ts`. It only decides
 * whether an already-computed score value is ALLOWED TO BE WRITTEN, by checking
 * the movement against the append-only behavior record.
 *
 * PURE + FRAMEWORK-FREE by design (mirrors `routes/aforce/journalSchema.ts`):
 * no Express, no `@workspace/db`, no IO. The caller gathers the prior snapshot
 * and evidence counts and passes them in; this module only judges. That keeps
 * it unit-testable with zero DATABASE_URL.
 *
 * ROLLOUT (see governance/LOCK-BUILD-PLAN.md BUILD-3):
 *   - Phase 3A (this commit): mode `shadow` — observe + log only, never blocks.
 *   - Phase 3B (gated): mode `enforce` — reject unexplained movement. Depends on
 *     schema/provenance work (R-21) and is turned on deliberately per-env.
 */

export type ScoreProtectionMode = "off" | "shadow" | "enforce";

/**
 * Resolve the active mode from the environment.
 *   - Explicit `SCORE_PROTECTION_MODE` (off|shadow|enforce) always wins.
 *   - Otherwise default to `shadow` everywhere EXCEPT production, which stays
 *     `off` until Phase 3B is deliberately enabled. This makes the guard
 *     observe-only by default and impossible to accidentally enforce in prod.
 */
export function resolveScoreProtectionMode(
  env: { SCORE_PROTECTION_MODE?: string; NODE_ENV?: string } = process.env,
): ScoreProtectionMode {
  const raw = (env.SCORE_PROTECTION_MODE ?? "").trim().toLowerCase();
  if (raw === "off" || raw === "shadow" || raw === "enforce") return raw;
  return env.NODE_ENV === "production" ? "off" : "shadow";
}

/**
 * Guard thresholds. These gate the WRITE; they are NOT band thresholds and NOT
 * scoring parameters. Kept local to the guard and versioned with it.
 */
export const SCORE_WRITE_GUARD = {
  /**
   * A single snapshot whose score moves more than this from the prior snapshot,
   * with zero verified behavior records since that prior snapshot, is treated
   * as unexplained movement. Small drift (recompute jitter, timezone rollover)
   * is allowed unconditionally so shadow mode does not drown in false positives.
   */
  UNEXPLAINED_DELTA: 15,
  /**
   * How far back to look for verified behavior when there is no prior snapshot
   * to anchor the evidence window to. With a prior snapshot the window is
   * "since the prior snapshot" instead.
   */
  EVIDENCE_WINDOW_MS: 6 * 60 * 60 * 1000,
} as const;

export interface PriorSnapshot {
  score: number;
  capturedAt: Date;
}

/** Counts of append-only, verified behavior records since the prior snapshot. */
export interface WriteEvidence {
  /** rows in `aforce_confirmations` for this user in the window */
  confirmations: number;
  /** rows in `aforce_intake_logs` for this user in the window */
  intakeLogs: number;
}

export interface ProposedWrite {
  score: number;
}

export type ScoreWriteViolation = {
  code: "unexplained_movement";
  delta: number;
  evidenceCount: number;
};

export interface ScoreWriteVerdict {
  /** true = the write is consistent with Score Protection. */
  ok: boolean;
  /** proposed − prior; null when there is no prior snapshot. */
  delta: number | null;
  /** total verified behavior records observed in the window. */
  evidenceCount: number;
  violations: ScoreWriteViolation[];
}

/**
 * Judge a proposed score write. Pure — no IO, deterministic given its inputs.
 *
 * Rules:
 *   - No prior snapshot → the user's first score; nothing to protect. OK.
 *   - |delta| ≤ UNEXPLAINED_DELTA → within allowed drift. OK.
 *   - |delta| >  UNEXPLAINED_DELTA with at least one verified record → the
 *     movement is explained by real behavior. OK.
 *   - |delta| >  UNEXPLAINED_DELTA with ZERO verified records → unexplained
 *     movement. VIOLATION (logged in shadow, rejected in enforce).
 */
export function evaluateScoreWrite(args: {
  proposed: ProposedWrite;
  prior: PriorSnapshot | null;
  evidence: WriteEvidence;
}): ScoreWriteVerdict {
  const { proposed, prior, evidence } = args;
  const evidenceCount = evidence.confirmations + evidence.intakeLogs;

  if (prior === null) {
    return { ok: true, delta: null, evidenceCount, violations: [] };
  }

  const delta = proposed.score - prior.score;
  const violations: ScoreWriteViolation[] = [];

  if (Math.abs(delta) > SCORE_WRITE_GUARD.UNEXPLAINED_DELTA && evidenceCount === 0) {
    violations.push({ code: "unexplained_movement", delta, evidenceCount });
  }

  return { ok: violations.length === 0, delta, evidenceCount, violations };
}

export interface GuardDecision {
  mode: ScoreProtectionMode;
  verdict: ScoreWriteVerdict;
  /** true ONLY in `enforce` mode on a failed verdict; shadow never blocks. */
  blocked: boolean;
}

/**
 * Turn a verdict into an action for the current mode. This is the ONLY place
 * that decides whether a write is blocked, so Phase 3A (shadow) and Phase 3B
 * (enforce) share one code path — flipping the mode is the entire behavior
 * change, which keeps rollback to a single env var.
 */
export function decideScoreWrite(
  mode: ScoreProtectionMode,
  verdict: ScoreWriteVerdict,
): GuardDecision {
  const blocked = mode === "enforce" && !verdict.ok;
  return { mode, verdict, blocked };
}
