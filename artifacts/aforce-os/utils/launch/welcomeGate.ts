/**
 * Who meets the cold-launch welcome screen.
 *
 * Founder direction, 2026-11-22: the welcome screen is for signed-out people
 * only. A signed-in member goes straight into AFORCE once the opening has
 * played. Quiet keeps its existing behaviour (no front door at all).
 *
 * Pure decision; the app shell applies it. Nothing here routes or writes.
 */
import type { LaunchPhase } from '@/hooks/useLaunchPhase';

export interface WelcomeGateInput {
  phase: LaunchPhase;
  signedIn: boolean;
  quiet: boolean;
  momentsHydrated: boolean;
}

export interface WelcomeGateDecision {
  /** Mount the welcome screen (under the opening, then on its own). */
  show: boolean;
  /** Close the front door now, so the app underneath is what the member sees. */
  finish: boolean;
}

export function welcomeGate({ phase, signedIn, quiet, momentsHydrated }: WelcomeGateInput): WelcomeGateDecision {
  if (phase === 'done') return { show: false, finish: false };
  if (quiet) return { show: false, finish: momentsHydrated };
  // Signed in: never show it. Wait for the opening to finish before closing the
  // front door, so the overlays that wait for 'done' never stack on the opening.
  if (signedIn) return { show: false, finish: phase === 'welcome' };
  return { show: true, finish: false };
}
