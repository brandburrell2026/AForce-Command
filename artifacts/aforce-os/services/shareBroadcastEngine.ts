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
  ACTION_BROADCASTS,
  IDENTITY_BROADCASTS,
} from '../data/shareBroadcasts';
import type {
  BroadcastEntry,
  ShareContext,
  ShareVoice,
  StateLabel,
} from '../types/share';

/** Active state subtext for STATUS voice — short, no medical tone. */
function statusSubtext(ctx: ShareContext): string {
  if (ctx.score != null) return `Score ${ctx.score}.`;
  if (ctx.streakDays != null) return `${ctx.streakDays} day streak.`;
  if (ctx.state) return `${ctx.state}.`;
  return 'Operating.';
}

/**
 * Returns 3 broadcast variations for the chosen voice, given the live
 * share context. The screen renders these as radio-style picks.
 *
 *   STATUS   — 3 framings of the same SYSTEM CONTROLLED / RECOVERING /
 *              SYSTEM UNSTABLE headline, varied subtext (score / state /
 *              minimal).
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
      return [
        { id: 'status-score', voice: 'status', headline, subtext: statusSubtext(ctx) },
        { id: 'status-state', voice: 'status', headline, subtext: `${state}.` },
        { id: 'status-min',   voice: 'status', headline, subtext: '' },
      ];
    }
    case 'action':
      // Take the first 3 from the pool — keeps the picker scannable.
      return ACTION_BROADCASTS.slice(0, 3);
    case 'identity':
      return IDENTITY_BROADCASTS.slice(0, 3);
    default: {
      // Unknown voice (e.g. value crossed a TS boundary). Always return a
      // safe non-empty STATUS broadcast so the UI never blanks out.
      const headline = STATUS_HEADLINES.Balanced;
      return [{ id: 'status-fallback', voice: 'status', headline, subtext: 'Operating.' }];
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
