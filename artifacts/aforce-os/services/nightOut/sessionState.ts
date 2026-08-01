/**
 * AForce Night Out Protocol — canonical session-state model (NO-a).
 *
 * Night Out is the renamed "Social Mode" (governance NO-1). This module defines
 * the canonical session lifecycle and RECONCILES it with the EXISTING
 * `SocialModeState` architecture (`types/socialMode.ts`) — it does NOT introduce
 * a parallel state system, and it does NOT change the stored shape (so there is
 * no data migration and all legacy Social Mode records keep working).
 *
 * Canonical lifecycle (founder-approved NO-a):
 *
 *   OFF → PREPARING → ACTIVE → WINDING_DOWN → RECOVERY_HANDOFF → CLOSED
 *
 * The current `SocialModeState` distinguishes OFF / ACTIVE / RECOVERY_HANDOFF /
 * CLOSED directly (via `active`, `endedAt`, and the recovery window). PREPARING
 * (a pre-activation step before `active` is set) and WINDING_DOWN (an explicit
 * "ending soon" signal) are NOT yet represented in the stored shape — they are
 * reserved canonical states that the session-start / wind-down flows in later
 * slices (NO-c) will drive via the optional `phaseHint`. Until then this
 * resolver returns them ONLY when a caller explicitly passes the hint, so the
 * derivation stays truthful to what the stored data actually expresses.
 *
 * PURE + dependency-free (no React / store / I/O) so it is unit-testable and
 * reusable from any layer. It READS existing state; it never mutates score,
 * intake, alcohol calculations, navigation, or entitlements (Score-Protection).
 */

import type { SocialModeState } from '@/types';

/** Canonical Night Out session lifecycle states. */
export type NightOutSessionState =
  | 'OFF'
  | 'PREPARING'
  | 'ACTIVE'
  | 'WINDING_DOWN'
  | 'RECOVERY_HANDOFF'
  | 'CLOSED';

/**
 * Documented internal legacy alias. The stored state key + engine remain
 * "socialMode" for backward compatibility (stored data, deep links, historical
 * analytics, route migration); "Night Out" is the public name (NO-1). Nothing
 * public may render this alias.
 */
export const NIGHT_OUT_LEGACY_ALIAS = 'social_mode' as const;

/** Recovery-window lengths, mirrored from the existing SocialModeState contract. */
export const RECOVERY_WINDOW_MS = 8 * 60 * 60 * 1000; //  8h (default)
export const CRUISE_RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h while Cruise engaged

export interface ResolveNightOutOptions {
  /** Evaluation clock (ms). Injectable for deterministic tests + clock safety. */
  now?: number;
  /**
   * Explicit lifecycle hint from the session-start / wind-down flow (NO-c+).
   * `'preparing'` applies only before the session is active; `'winding_down'`
   * applies only while active. Ignored when inconsistent with the stored state.
   */
  phaseHint?: 'preparing' | 'winding_down';
}

function toMs(d: Date | string | number | undefined | null): number | null {
  if (d == null) return null;
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Resolve the canonical Night Out session state from the existing
 * `SocialModeState`. Pure. Clock-safe (a future `endedAt` from clock skew is
 * treated as still-active rather than prematurely CLOSED).
 */
export function resolveNightOutSessionState(
  social: SocialModeState | undefined | null,
  opts: ResolveNightOutOptions = {},
): NightOutSessionState {
  const now = opts.now ?? Date.now();
  const started = !!social?.active;
  const endedAt = toMs(social?.endedAt);

  // ── Ended → recovery window vs closed (takes precedence over `active`) ──
  if (endedAt != null) {
    // Clock skew: an `endedAt` in the future means the session hasn't really
    // ended on this clock — keep it active/winding-down, never CLOSED early.
    if (now < endedAt) {
      return opts.phaseHint === 'winding_down' ? 'WINDING_DOWN' : 'ACTIVE';
    }
    const cruiseUntil = toMs(social?.cruiseUntil);
    const windowMs =
      cruiseUntil != null && cruiseUntil > now
        ? CRUISE_RECOVERY_WINDOW_MS
        : RECOVERY_WINDOW_MS;
    return now < endedAt + windowMs ? 'RECOVERY_HANDOFF' : 'CLOSED';
  }

  // ── Active, not ended ──
  if (started) {
    return opts.phaseHint === 'winding_down' ? 'WINDING_DOWN' : 'ACTIVE';
  }

  // ── Not started, not ended ── (PREPARING only via an explicit pre-start hint)
  return opts.phaseHint === 'preparing' ? 'PREPARING' : 'OFF';
}

/** True when a Night Out session is engaged (preparing / active / winding down). */
export function isNightOutSessionEngaged(state: NightOutSessionState): boolean {
  return state === 'PREPARING' || state === 'ACTIVE' || state === 'WINDING_DOWN';
}

/** True when the session is in or past its recovery handoff (post-`endedAt`). */
export function isNightOutInRecovery(state: NightOutSessionState): boolean {
  return state === 'RECOVERY_HANDOFF';
}

/** All canonical states, in lifecycle order (fixtures + exhaustiveness checks). */
export const NIGHT_OUT_SESSION_STATES: readonly NightOutSessionState[] = [
  'OFF',
  'PREPARING',
  'ACTIVE',
  'WINDING_DOWN',
  'RECOVERY_HANDOFF',
  'CLOSED',
] as const;
