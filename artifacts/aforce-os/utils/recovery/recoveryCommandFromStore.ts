/**
 * Adapter: existing store/engine state → a normalized RecoveryCommand.
 *
 * The Recovery Coach screen is driven ENTIRELY by one RecoveryCommand (spec §7).
 * This builds that object from real store data — the engine's current command +
 * the risk-timer's next-check — rather than hardcoding the hero copy. It never
 * fabricates a dose: `quantity` is only set when a structured, validated dose is
 * supplied; the loose engine command text is passed through as the instruction
 * as-is. When the recovery/rules engine later emits structured commands, feed
 * those here instead.
 *
 * Pure · no React Native · `now` passed in. Score-Protection: shapes existing
 * data for display; never writes a score and never invents a quantity.
 */
import type { RecoveryCommand, RecoveryQuantityUnit } from './recoveryCommand';

export interface RecoveryCommandSource {
  /** Stable id of the current command (for idempotent analytics + de-dupe). */
  commandId: string;
  /** The recovery-framed title, e.g. 'Start with water' (sentence case, spec §2). */
  title: string;
  /** One-line instruction — passed through verbatim; no dose is parsed out of it. */
  instruction: string;
  /** Primary CTA label, e.g. "I've had the water". */
  primaryActionLabel: string;
  /** Plain-language rationale for the Why-this-command disclosure. */
  rationale: string;
  /** Seconds until the next check (from the risk timer). Clamped ≥ 0. */
  recheckInSeconds: number;
  /** Only set when a structured, validated dose exists — never fabricated. */
  quantity?: { value: number; unit: RecoveryQuantityUnit };
  /** Version of the rules/content source that produced this command. */
  sourceVersion: string;
  /** How long past the recheck the command stays valid before it must refresh (default 45 min). */
  validForMs?: number;
}

const DEFAULT_VALID_FOR_MS = 45 * 60_000;

/**
 * Split a loose engine command string (Command.action — "WHAT + WHEN + OUTCOME",
 * e.g. "Start with water — 20 oz now. Recheck in 15 minutes.") into a clean
 * title + one-line instruction, STRIPPING any "Recheck in …" clause.
 *
 * This is the spec §2/§7 enforcement point: the recheck time is shown ONLY by the
 * live countdown, so it must never survive into the instruction (a static
 * "Recheck in 15 minutes" next to a ticking 04:12 is the exact contradiction the
 * spec forbids). Pure + testable.
 */
export function parseEngineActionCopy(action: string): { title: string; instruction: string } {
  // Drop a trailing "Recheck in <…>." sentence (case-insensitive), and any
  // now-empty trailing separators/whitespace.
  const noRecheck = action
    .replace(/\s*Recheck in[^.]*\.?\s*$/i, '')
    // Trim only trailing whitespace / dangling separators left behind — NOT a
    // sentence-ending period (keep "20 oz now.").
    .replace(/[\s—–-]+$/u, '')
    .trim();
  // Titles never carry a trailing period; instructions keep theirs.
  const titleize = (s: string) => s.replace(/\.\s*$/u, '').trim();
  // Split the leading title off an em-dash / dash separator when present.
  const m = noRecheck.split(/\s+[—–-]\s+/u);
  if (m.length >= 2 && m[0].trim()) {
    return { title: titleize(m[0]), instruction: m.slice(1).join(' — ').trim() };
  }
  return { title: titleize(noRecheck), instruction: '' };
}

/**
 * Build a validated-shape RecoveryCommand from source data. createdAt = now,
 * recheckAt = now + recheckInSeconds, expiresAt = recheckAt + validFor. The
 * caller should still pass the result through deriveRecoveryCommandView, which
 * enforces validity + expiry at render.
 */
export function buildRecoveryCommand(src: RecoveryCommandSource, now: number): RecoveryCommand {
  const recheckMs = now + Math.max(0, src.recheckInSeconds) * 1000;
  const validFor = src.validForMs ?? DEFAULT_VALID_FOR_MS;
  return {
    id: src.commandId,
    state: 'active',
    title: src.title,
    instruction: src.instruction,
    primaryActionLabel: src.primaryActionLabel,
    quantity: src.quantity,
    recheckAt: new Date(recheckMs).toISOString(),
    rationale: src.rationale,
    sourceVersion: src.sourceVersion,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(recheckMs + validFor).toISOString(),
  };
}
