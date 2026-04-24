/**
 * Share-card glow rotation — gives shared cards visual variety so a
 * user's feed doesn't look monochrome (everything red because they
 * happened to share a few times during a Depleted state).
 *
 * The state dot + score badge stay tied to live state (so meaning is
 * preserved); only the large background GLOW rotates through this
 * 4-color brand palette.
 *
 * Selection is deterministic from the broadcast id, so the same share
 * always renders with the same glow — no flicker on re-render, but
 * naturally varied across different broadcasts.
 */

import { Colors } from '../theme/colors';

/**
 * 4 brand glow colors. Order is fixed and exposed for tests + analytics.
 * Red is intentionally first — it's the original state-Depleted accent
 * the rotation replaces, kept in the rotation so high-urgency shares
 * still feel "hot" some of the time.
 */
export const GLOW_PALETTE: readonly string[] = [
  Colors.states.DEPLETED.primary,    // #FF2D55  red
  Colors.states.PEAK.primary,        // #B4FF50  lime
  Colors.states.BALANCED.primary,    // #00E5C8  teal
  Colors.guardian.primary,           // #8B5CF6  violet
] as const;

/**
 * Stable string hash — sum of char codes, modulo palette length. The
 * input is typically a broadcast id (e.g. "id-become") or message text;
 * either way, two distinct inputs map evenly across the palette.
 */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Pick a glow color for a share. Pass the broadcast id (or any stable
 * per-share string) so the same share keeps the same color, but
 * different shares cycle through the palette.
 */
export function pickGlowAccent(seed: string | undefined | null): string {
  const safe = seed && seed.length > 0 ? seed : 'default';
  return GLOW_PALETTE[hash(safe) % GLOW_PALETTE.length];
}
