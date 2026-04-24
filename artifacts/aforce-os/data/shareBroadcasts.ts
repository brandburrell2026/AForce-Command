/**
 * Broadcast pools — the AForce share system as a status / identity engine.
 *
 * Three voices (orthogonal to ShareType):
 *   STATUS   — declarative system state, driven by the user's live state.
 *   ACTION   — proof-of-action moments. Short, in motion.
 *   IDENTITY — manifesto / philosophy. Pure identity, no data.
 *
 * Voice rules (enforced by `services/shareTemplateEngine.ts#enforceTone`
 * when these strings are routed through composeTextShare):
 *   - direct, confident, minimal
 *   - no hype, no slang, no emojis, no exclamation
 *   - no medical or generic-fitness tone
 *   - small subtext, large headline
 */

import type { BroadcastEntry, StateLabel } from '../types/share';

/**
 * STATUS headline mapped from live performance state. State drives the
 * dominant headline; the subtext is composed at runtime from the score
 * (e.g. "Score 88." / "Operating.").
 */
export const STATUS_HEADLINES: Record<StateLabel, string> = {
  Peak:       'SYSTEM CONTROLLED',
  Balanced:   'SYSTEM CONTROLLED',
  Recovering: 'RECOVERING',
  Depleted:   'SYSTEM UNSTABLE',
};

/**
 * ACTION pool — proof-of-action lines. Each entry stands on its own —
 * the user is broadcasting that they are *doing the protocol*, not
 * reporting numbers.
 */
export const ACTION_BROADCASTS: BroadcastEntry[] = [
  { id: 'act-aforce',    voice: 'action', headline: 'Took 1 AForce.',     subtext: 'Stabilizing.' },
  { id: 'act-hydrate',   voice: 'action', headline: 'Hydrating now.',     subtext: 'On cadence.' },
  { id: 'act-reset',     voice: 'action', headline: 'Reset in progress.', subtext: 'System rebasing.' },
  { id: 'act-cycle',     voice: 'action', headline: 'Cycle complete.',    subtext: 'Back online.' },
  { id: 'act-heat-held', voice: 'action', headline: 'Heat curve held.',   subtext: 'System intervened.' },
];

/**
 * IDENTITY pool — manifesto. No score, no state, no protocol. Pure
 * identity statements that read like a personal mantra.
 */
export const IDENTITY_BROADCASTS: BroadcastEntry[] = [
  { id: 'id-loop',       voice: 'identity', headline: 'Check. Act. Win. Repeat.', subtext: 'AForce protocol.' },
  { id: 'id-system',     voice: 'identity', headline: 'Performance is a system.', subtext: 'I run mine.' },
  { id: 'id-no-guess',   voice: 'identity', headline: 'No guessing.',             subtext: 'The system decides.' },
  { id: 'id-discipline', voice: 'identity', headline: 'Discipline over hype.',    subtext: 'Earned, not promised.' },
  { id: 'id-identity',   voice: 'identity', headline: 'Hydration is identity.',   subtext: 'Repeat the protocol.' },
];
