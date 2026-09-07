/**
 * ENVIRONMENTAL ACQUISITION — the application-level owner of fetching live
 * environmental evidence.
 *
 * ── WHY A HOOK IN THE PROVIDER, AND NOT A RESURRECTED BANNER ───────────────
 *
 * `LocationInsightBanner` and `SmartModesBanner` are both dead. Mounting one to
 * give this a home would make a UI component the owner of a background data
 * concern — the surface could never be redesigned or removed without silently
 * killing acquisition, and acquisition would start and stop as a member
 * scrolled. Ownership belongs where the app already owns exactly this pattern:
 * the store provider, beside the server-weather tick it mirrors.
 *
 * This is not a new subsystem. It reuses `useAppStateGatedInterval`, the same
 * permission-checking discipline, and the same mounted-ref guard.
 *
 * ── WHAT IT WILL NOT DO ────────────────────────────────────────────────────
 *
 *   - It never REQUESTS location. The producer checks an existing grant; the
 *     intentional ask lives in onboarding, which explains itself first. A
 *     background tick must never raise an OS dialog.
 *   - It never runs backgrounded — `useAppStateGatedInterval` owns that, so
 *     there is no polling behind the member's back and no background location.
 *   - It never re-prompts after a refusal. There is no prompt here at all.
 *   - It does not duplicate the server weather refresh, which owns
 *     `UserState.weather*` on its own 15-minute cadence and is untouched.
 *
 * ── AND WHAT IT DOES NOT DECIDE ────────────────────────────────────────────
 *
 * Acquisition only makes evidence exist. It does not interpret it, does not
 * score, and does not command. `interpretEnvironment` reads the evidence;
 * RecoveryCommand remains the sole authority for the member's action.
 */
import React from 'react';

import { getLocationSnapshot } from '@/services/locationIntelligenceService';
import { useAppStateGatedInterval } from '@/hooks/useAppStateGatedInterval';

/**
 * How often live environmental evidence is refreshed while the app is in the
 * foreground.
 *
 * Fifteen minutes matches the server-weather cadence already running beside
 * this, and sits inside the producer's own 10-minute cache TTL closely enough
 * that a tick is a real refresh rather than a cache echo. It is deliberately
 * NOT tied to the validity policy: the policy decides when evidence STOPS
 * being current, which is a truth question; this decides how often we look,
 * which is a battery and rate-limit question. Conflating them is how a
 * freshness window turns into a polling loop.
 */
export const ENVIRONMENTAL_REFRESH_MS = 15 * 60 * 1000;

/**
 * Acquire live environmental evidence on a foreground-only cadence.
 *
 * `enabled` is the acquisition feature flag. When false this does nothing at
 * all — no fetch, no permission read, no timer work that reaches the producer
 * — so the flag is a true kill switch rather than a display filter.
 */
export function useEnvironmentalAcquisition(enabled: boolean): void {
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // THE SINGLE GATE. Both callers below invoke `tick` unconditionally and the
  // decision is made here, once. Three copies of one condition is how a rule
  // drifts — and it also makes the gate untestable, because removing any one
  // copy leaves the others silently covering for it.
  const tick = React.useCallback(async () => {
    if (!enabled) return;
    try {
      // The producer owns permission checking, its own cache TTL, and the
      // live-vs-mock decision. A failure here is not an error state to
      // surface: it becomes `unobserved` evidence with a truthful reason,
      // which is the whole point of the layers underneath.
      await getLocationSnapshot();
    } catch {
      // Acquisition is best-effort by design. The evidence layer already
      // represents "we could not see" honestly, so a throw needs no handling
      // beyond not crashing the provider that owns this hook.
    }
    if (!mountedRef.current) return;
  }, [enabled]);

  // Mount-once attempt, so a member who already granted location has evidence
  // without waiting a full interval.
  React.useEffect(() => {
    void tick();
  }, [tick]);

  // Foreground-gated cadence. Zero fetches while backgrounded; one immediately
  // on a genuine return to foreground.
  useAppStateGatedInterval(() => {
    void tick();
  }, ENVIRONMENTAL_REFRESH_MS);
}
