/**
 * Broadcast engine — generates the headline + subtext shown on a share
 * card / story / text. Pure functions, no I/O.
 *
 * Sits beside `shareTemplateEngine.ts` (which still powers legacy
 * variation-based shares). The screen prefers broadcasts; the legacy
 * engine remains for non-UI consumers (tests, server events).
 */

import {
  STATUS_HEADLINES,
  STATUS_SUBTEXTS,
  ACTION_BROADCASTS,
  IDENTITY_BROADCASTS,
} from '../data/shareBroadcasts';
import type {
  BroadcastEntry,
  ShareContext,
  ShareVoice,
  StateLabel,
} from '../types/share';

/**
 * Returns 3 broadcast variations for the chosen voice, given the live
 * share context. The screen renders these as radio-style picks.
 *
 *   STATUS   — 1 brand headline mapped from live state (AFORCE INSIDE /
 *              SYSTEM ON / RESTORING NOW / RESET INCOMING) paired with
 *              3 brand-flavored subtexts (Clean AF. / Effective AF. / —).
 *              Never carries data in subtext — identity, not metrics.
 *   ACTION   — 3 curated proof-of-action lines (rotated from the pool).
 *   IDENTITY — 3 manifesto lines (rotated from the pool).
 */
export function generateBroadcasts(voice: ShareVoice, ctx: ShareContext): BroadcastEntry[] {
  switch (voice) {
    case 'status': {
      // Defensive: state may be a string at runtime if a caller bypassed
      // the screen's allowlist. Fall back to Balanced if it doesn't map
      // to a known headline.
      const state: StateLabel = (ctx.state && STATUS_HEADLINES[ctx.state]) ? ctx.state : 'Balanced';
      const headline = STATUS_HEADLINES[state];
      return STATUS_SUBTEXTS.map((subtext, i) => ({
        id: `status-${state.toLowerCase()}-${i}`,
        voice: 'status',
        headline,
        subtext,
      }));
    }
    case 'action':
      // Take the first 3 from the pool — keeps the picker scannable.
      return ACTION_BROADCASTS.slice(0, 3);
    case 'identity':
      // 4 manifesto picks — one more than action because the IDENTITY
      // pool is the most-loved voice and "Become AForce." sits at the top.
      return IDENTITY_BROADCASTS.slice(0, 4);
    default: {
      // Unknown voice (e.g. value crossed a TS boundary). Always return a
      // safe non-empty STATUS broadcast so the UI never blanks out.
      const headline = STATUS_HEADLINES.Balanced;
      return [{ id: 'status-fallback', voice: 'status', headline, subtext: 'Clean AF.' }];
    }
  }
}

/**
 * Auto-pick the most appropriate voice for the live share context. The
 * default is STATUS — it's the most relatable and the closest to the
 * existing share UX. ACTION is preferred when a recent intake/protocol
 * just happened. IDENTITY is never auto-selected — it's a deliberate
 * user choice.
 */
export function defaultVoice(ctx: ShareContext): ShareVoice {
  if (ctx.type === 'protocol' || ctx.type === 'command' || ctx.type === 'reset') return 'action';
  if (ctx.type === 'heat_save') return 'action';
  return 'status';
}

/**
 * Compose a one-line text payload for X / Threads / iMessage from a
 * broadcast. Headline + subtext joined by a single space; brand tag is
 * appended on a new line by the legacy `composeTextShare` to keep the
 * existing format.
 */
export function broadcastToMessage(b: BroadcastEntry): string {
  const sub = b.subtext.trim();
  return sub ? `${b.headline} ${sub}` : b.headline;
}
