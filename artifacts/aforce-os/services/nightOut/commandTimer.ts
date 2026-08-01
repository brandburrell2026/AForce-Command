/**
 * Night Out — Water-First command timer (NO-c). PURE + dependency-free.
 *
 * The timer contract (founder-approved):
 *   • It never begins before the user accepts the command (START WATER creates
 *     the record; there is no timer object until then).
 *   • It is anchored to an AUTHORITATIVE stored start timestamp — NOT an in-memory
 *     countdown. Restoration re-derives remaining time from `startedAtMs` + `now`,
 *     so it survives backgrounding / force-close / reopen (persistence layer:
 *     `commandTimerStore.ts`, local AsyncStorage — NOT cross-device; there is no
 *     server persistence for this timer, so cross-device restoration is NOT
 *     supported and must not be claimed).
 *   • Clock-safe: never returns negative time; a backwards clock jump is treated
 *     conservatively (no over-credit); an invalid/stale timestamp resolves to a
 *     safe recoverable state.
 *   • Expiry is NOT completion — the window elapsing never marks water completed
 *     and never advances the session. Completion requires an explicit verified
 *     user action routed through the approved intake path.
 *
 * This module computes STATE ONLY. It never mutates HydroState, logs intake, or
 * touches the session — Score-Protection.
 */

export interface NightOutCommandTimer {
  /** Identity of the accepted command this timer belongs to. */
  commandId: string;
  /** Authoritative start timestamp (ms since epoch) — set at acceptance. */
  startedAtMs: number;
  /** Command completion window length in ms (from the engine command window). */
  windowMs: number;
}

export type NightOutTimerStatus = 'running' | 'expired' | 'invalid';

export interface NightOutTimerView {
  status: NightOutTimerStatus;
  /** Milliseconds remaining in the window; always ≥ 0. */
  remainingMs: number;
  /** Whole seconds remaining (for display); always ≥ 0. */
  remainingSec: number;
  /** Elapsed ms since start (clamped ≥ 0). */
  elapsedMs: number;
  /** True only when the window has fully elapsed. Expiry ≠ completion. */
  expired: boolean;
}

function isValidTimer(t: NightOutCommandTimer | null | undefined): t is NightOutCommandTimer {
  return (
    !!t &&
    typeof t.startedAtMs === 'number' &&
    Number.isFinite(t.startedAtMs) &&
    t.startedAtMs > 0 &&
    typeof t.windowMs === 'number' &&
    Number.isFinite(t.windowMs) &&
    t.windowMs > 0
  );
}

/** Create the authoritative timer record at the moment the user accepts (START WATER). */
export function makeCommandTimer(
  commandId: string,
  windowMs: number,
  nowMs: number,
): NightOutCommandTimer {
  return { commandId, startedAtMs: nowMs, windowMs };
}

/**
 * Resolve the timer's display state from the authoritative record + current clock.
 * Pure. Used both live (tick) and on restoration (reopen) — identical result for
 * the same inputs, which is what makes background/force-close restoration correct.
 */
export function resolveCommandTimerView(
  timer: NightOutCommandTimer | null | undefined,
  nowMs: number,
): NightOutTimerView {
  if (!isValidTimer(timer) || !Number.isFinite(nowMs)) {
    // Safe recoverable state — the caller shows a "timer unavailable, restart the
    // command" affordance rather than a fabricated running/negative timer.
    return { status: 'invalid', remainingMs: 0, remainingSec: 0, elapsedMs: 0, expired: false };
  }
  // Conservative on backwards clock movement: never credit negative elapsed.
  const elapsedMs = Math.max(0, nowMs - timer.startedAtMs);
  if (elapsedMs >= timer.windowMs) {
    // Window elapsed. This is EXPIRY, not completion.
    return {
      status: 'expired',
      remainingMs: 0,
      remainingSec: 0,
      elapsedMs,
      expired: true,
    };
  }
  const remainingMs = timer.windowMs - elapsedMs;
  return {
    status: 'running',
    remainingMs,
    remainingSec: Math.ceil(remainingMs / 1000),
    elapsedMs,
    expired: false,
  };
}

/** Format remaining seconds as m:ss (display helper; pure). */
export function formatRemaining(remainingSec: number): string {
  const s = Math.max(0, Math.floor(remainingSec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}
