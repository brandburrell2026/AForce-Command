/**
 * Where the centre One Breath orb sits in the bottom bar.
 *
 * The approved prototype: a 46pt orb raised 22pt above the bar's top edge, so
 * 24pt of it hangs below that edge, inside the bar's 49pt row. It fits on every
 * phone; the rule below still guarantees the orb is never cut off if the sizes
 * change.
 */
export const ORB_SIZE = 46;
export const ORB_RAISE = 22;
/** Height of the tab bar's own row, without the safe-area strip. */
export const TAB_BAR_ROW_HEIGHT = 49;
/** Smallest gap kept between the orb and the bottom of the screen. */
export const ORB_MIN_BOTTOM_GAP = 4;

/** How far the orb's top edge sits above the bar's top edge. Never less than 22pt. */
export function oneBreathOrbRaise(bottomInset: number): number {
  const inset = Number.isFinite(bottomInset) ? Math.max(0, bottomInset) : 0;
  const roomBelowBarTop = TAB_BAR_ROW_HEIGHT + inset - ORB_MIN_BOTTOM_GAP;
  return Math.max(ORB_RAISE, ORB_SIZE - roomBelowBarTop);
}

/**
 * Extra touch area above the centre tab, so the raised part of the orb is part
 * of the button and not just a picture above it.
 */
export function oneBreathTabHitSlop(bottomInset: number): { top: number } {
  return { top: oneBreathOrbRaise(bottomInset) };
}
