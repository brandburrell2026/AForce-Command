/**
 * RECOVERY COMMAND — the single normalized object behind the Recovery Coach
 * screen, and the one derivation that turns it into everything visible.
 *
 * Spec §7 (non-negotiable): every visible instruction — title, one-line
 * instruction, countdown, progress, duration label, dose — derives from ONE
 * command object. Never a separate hardcoded "10 minutes"/dose string. The
 * countdown, progress, and duration are all computed from `createdAt`/`recheckAt`
 * here, so copy, dose, timer, and progress can never disagree (spec §11).
 *
 * A stale/invalid command never renders as active: `deriveRecoveryCommandView`
 * promotes a command past `expiresAt` to `expired`, and an invalid command to a
 * safe fallback ("Refresh your command") — never partial or conflicting guidance.
 *
 * Score-Protection: this is display derivation only. It never awards, mutates, or
 * fabricates a score, and it never invents a dose — the dose shown is exactly
 * `command.quantity`, which must come from the validated rules/content layer
 * upstream. Pure · no React Native · no I/O · `now` is passed in (no Date.now()).
 */

export type RecoveryCommandState =
  | 'active'
  | 'acknowledged'
  | 'rechecking'
  | 'complete'
  | 'expired';

export type RecoveryQuantityUnit = 'oz' | 'ml' | 'serving';

/** The single normalized command (spec §7). */
export interface RecoveryCommand {
  id: string;
  state: RecoveryCommandState;
  title: string;
  instruction: string;
  primaryActionLabel: string;
  quantity?: { value: number; unit: RecoveryQuantityUnit };
  recheckAt: string; //  ISO-8601 — the single source for countdown/progress/duration
  rationale: string;
  sourceVersion: string;
  createdAt: string; //  ISO-8601
  expiresAt: string; //  ISO-8601
}

/** Everything the screen renders — all derived, nothing independently authored. */
export interface RecoveryCommandView {
  /** Effective state (a command past expiresAt reads `expired` regardless of stored state). */
  state: RecoveryCommandState;
  title: string;
  instruction: string;
  primaryActionLabel: string;
  /** True when the primary action has been taken (renders the check + "logged" treatment). */
  acknowledged: boolean;
  quantity?: { value: number; unit: RecoveryQuantityUnit };
  timerLabel: string; //     'NEXT CHECK'
  countdown: string; //      'mm:ss' from recheckAt - now (clamped ≥ 0)
  countdownSeconds: number;
  progress: number; //       0..1 from createdAt → recheckAt (clamped)
  durationLabel: string; //  e.g. '15 MIN' from createdAt → recheckAt
  rationale: string;
  /** False → render the safe fallback instead of any partial guidance. */
  valid: boolean;
  /** When offline with a still-valid cached command: 'Updated X min ago'. */
  updatedAgoLabel?: string;
}

// ── Copy the DERIVATION owns (state/expiry/fallback), per spec §2/§7/§8 ──
export const RECOVERY_TIMER_LABEL = 'NEXT CHECK';
export const RECOVERY_EXPIRED_TITLE = 'Your command needs an update';
export const RECOVERY_EXPIRED_ACTION = 'Refresh command';
export const RECOVERY_ACK_ACTION = 'Water logged';
export const RECOVERY_RECHECKING_TITLE = 'Recheck in progress';
export const RECOVERY_FALLBACK_TITLE = 'Refresh your command';
export const RECOVERY_FALLBACK_INSTRUCTION = 'Tap to get your latest guidance.';

const MS_PER_MIN = 60_000;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function parseIso(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * Structural + temporal validity. A command must have the required strings, a
 * coherent createdAt ≤ recheckAt ≤ expiresAt timeline, and — if a dose is present
 * — a finite positive value with a known unit. Returns a reason for diagnostics
 * (never surfaced to the user).
 */
export function validateRecoveryCommand(cmd: RecoveryCommand | null | undefined): {
  valid: boolean;
  reason?: string;
} {
  if (!cmd) return { valid: false, reason: 'missing' };
  if (!cmd.id || !cmd.title || !cmd.instruction || !cmd.primaryActionLabel) {
    return { valid: false, reason: 'missing_fields' };
  }
  const created = parseIso(cmd.createdAt);
  const recheck = parseIso(cmd.recheckAt);
  const expires = parseIso(cmd.expiresAt);
  if (created === null || recheck === null || expires === null) {
    return { valid: false, reason: 'bad_timestamps' };
  }
  if (!(created <= recheck && recheck <= expires)) {
    return { valid: false, reason: 'timeline_out_of_order' };
  }
  if (cmd.quantity !== undefined) {
    const { value, unit } = cmd.quantity;
    if (!isFiniteNumber(value) || value <= 0) return { valid: false, reason: 'bad_quantity' };
    if (unit !== 'oz' && unit !== 'ml' && unit !== 'serving') {
      return { valid: false, reason: 'bad_unit' };
    }
  }
  return { valid: true };
}

/** mm:ss (zero-padded, clamped ≥ 0) from a millisecond remaining value. */
export function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** The safe fallback view (spec §7): never partial or conflicting guidance. */
function fallbackView(): RecoveryCommandView {
  return {
    state: 'expired',
    title: RECOVERY_FALLBACK_TITLE,
    instruction: RECOVERY_FALLBACK_INSTRUCTION,
    primaryActionLabel: RECOVERY_EXPIRED_ACTION,
    acknowledged: false,
    timerLabel: RECOVERY_TIMER_LABEL,
    countdown: '00:00',
    countdownSeconds: 0,
    progress: 0,
    durationLabel: '',
    rationale: '',
    valid: false,
  };
}

export interface DeriveOptions {
  /** Marks the command as offline-cached so the view exposes an 'Updated X min ago' label. */
  offline?: boolean;
}

/**
 * The one derivation. Given a command and `now` (ms), produce every visible value.
 * Countdown, progress, and duration all come from the same createdAt/recheckAt —
 * so they cannot disagree. Expiry and validity are enforced here, never at the
 * call site.
 */
export function deriveRecoveryCommandView(
  cmd: RecoveryCommand | null | undefined,
  now: number,
  opts: DeriveOptions = {},
): RecoveryCommandView {
  const { valid } = validateRecoveryCommand(cmd);
  if (!valid || !cmd) return fallbackView();

  const created = parseIso(cmd.createdAt)!;
  const recheck = parseIso(cmd.recheckAt)!;
  const expires = parseIso(cmd.expiresAt)!;

  const remainingMs = recheck - now;
  const spanMs = Math.max(1, recheck - created); // guard /0 (validate ensures created ≤ recheck)
  const progress = Math.min(1, Math.max(0, (now - created) / spanMs));
  const durationMin = Math.round(spanMs / MS_PER_MIN);
  const durationLabel = `${durationMin} MIN`;

  // Effective state: past expiry ALWAYS reads expired, whatever the stored state.
  const pastExpiry = now >= expires;
  const acknowledged = cmd.state === 'acknowledged' || cmd.state === 'complete';

  if (pastExpiry) {
    return {
      state: 'expired',
      title: RECOVERY_EXPIRED_TITLE,
      instruction: '',
      primaryActionLabel: RECOVERY_EXPIRED_ACTION,
      acknowledged: false,
      timerLabel: RECOVERY_TIMER_LABEL,
      countdown: '00:00',
      countdownSeconds: 0,
      progress: 1, // stopped (spec §8: expired stops progress)
      durationLabel,
      rationale: cmd.rationale,
      valid: true,
    };
  }

  // State-driven display for the non-expired states (spec §8).
  let title = cmd.title;
  let primaryActionLabel = cmd.primaryActionLabel;
  if (cmd.state === 'rechecking') title = RECOVERY_RECHECKING_TITLE;
  if (acknowledged) primaryActionLabel = RECOVERY_ACK_ACTION;

  const updatedAgoLabel = opts.offline
    ? `Updated ${Math.max(0, Math.round((now - created) / MS_PER_MIN))} min ago`
    : undefined;

  return {
    state: cmd.state,
    title,
    instruction: cmd.instruction,
    primaryActionLabel,
    acknowledged,
    quantity: cmd.quantity,
    timerLabel: RECOVERY_TIMER_LABEL,
    countdown: formatCountdown(remainingMs),
    countdownSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
    progress,
    durationLabel,
    rationale: cmd.rationale,
    valid: true,
    updatedAgoLabel,
  };
}
