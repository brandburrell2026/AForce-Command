/**
 * Where the centre One Breath orb sits in the bottom bar.
 *
 * Screen Upgrade v1.1 §1: the orb is 64pt and raised 12pt above the bar.
 *
 * The bar's own row is 49pt tall. On a phone with a home indicator the bar
 * also has a safe-area strip below that row, so a 64pt orb raised 12pt (52pt
 * hanging below the bar's top edge) fits. On a phone with no home indicator
 * (iPhone SE class, and Android with button navigation) there is no strip, and
 * 52pt does not fit in 49pt: the bottom of the orb would run off the screen.
 * There the orb is raised just enough more to keep it whole.
 */
export const ORB_SIZE = 64;
export const ORB_RAISE = 12;
/** Height of the tab bar's own row, without the safe-area strip. */
export const TAB_BAR_ROW_HEIGHT = 49;
/** Smallest gap kept between the orb and the bottom of the screen. */
export const ORB_MIN_BOTTOM_GAP = 4;

/** How far the orb's top edge sits above the bar's top edge. Never less than 12pt. */
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
