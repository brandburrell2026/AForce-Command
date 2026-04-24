/**
 * Broadcast pools — AForce share copy. Brand voice from the website:
 *
 *   "AForce inside you."
 *   "This is not a drink. This is a system."
 *   "Clean AF. Effective AF."
 *   "Restore what life takes out of you."
 *   "Two brothers. One promise."
 *
 * Rules (every entry):
 *   - max 5 words per line
 *   - short, powerful, identity-driven
 *   - no weak language, no filler, no explanations
 *   - feels like status / control / performance / identity
 *
 * Three voices (orthogonal to ShareType):
 *   STATUS   — declarative system state, mapped from the user's live state
 *   ACTION   — proof-of-action, in motion
 *   IDENTITY — manifesto, pure brand
 */

import type { BroadcastEntry, StateLabel } from '../types/share';

/**
 * STATUS headline mapped from live performance state. Each headline is
 * ≤4 words, brand-aligned, and reads like a status — never a metric.
 */
export const STATUS_HEADLINES: Record<StateLabel, string> = {
  Peak:       'AFORCE INSIDE',
  Balanced:   'SYSTEM ON',
  Recovering: 'RESTORING NOW',
  Depleted:   'RESET INCOMING',
};

/**
 * Status subtext pool — same 3 brand-flavored options regardless of state.
 * No data, no score, no education — pure identity reinforcement. The
 * empty string is the minimal/no-subtext variant for users who want the
 * headline to stand alone.
 */
export const STATUS_SUBTEXTS: ReadonlyArray<string> = [
  'Clean AF.',
  'Effective AF.',
  '',
];

/**
 * ACTION pool — proof-of-action lines. The user is broadcasting that
 * they are *running the protocol*. Every headline ≤3 words.
 */
export const ACTION_BROADCASTS: BroadcastEntry[] = [
  { id: 'act-aforce',   voice: 'action', headline: 'Took 1 AForce.',     subtext: 'System on.' },
  { id: 'act-restore',  voice: 'action', headline: 'Restoring now.',     subtext: 'AForce inside.' },
  { id: 'act-cycle',    voice: 'action', headline: 'Cycle in motion.',   subtext: 'Effective AF.' },
  { id: 'act-hydrate',  voice: 'action', headline: 'Hydrating now.',     subtext: 'Clean AF.' },
  { id: 'act-protocol', voice: 'action', headline: 'Protocol executed.', subtext: 'System back online.' },
];

/**
 * IDENTITY pool — manifesto. Every line is straight off the AForce
 * brand voice. No data, no protocol mechanics — pure identity.
 */
export const IDENTITY_BROADCASTS: BroadcastEntry[] = [
  { id: 'id-inside',    voice: 'identity', headline: 'AForce inside me.',        subtext: 'Two brothers. One promise.' },
  { id: 'id-not-drink', voice: 'identity', headline: 'Not a drink.',             subtext: 'A system.' },
  { id: 'id-clean-af',  voice: 'identity', headline: 'Clean AF.',                subtext: 'Effective AF.' },
  { id: 'id-system',    voice: 'identity', headline: 'Performance is a system.', subtext: 'I run mine.' },
  { id: 'id-restore',   voice: 'identity', headline: 'Restore what life takes.', subtext: 'AForce inside.' },
];
