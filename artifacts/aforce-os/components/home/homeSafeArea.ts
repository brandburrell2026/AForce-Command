/**
 * Home — bottom clearance for the persistent tab bar (founder amendment §2).
 *
 * THE DEFECT THIS EXISTS FOR. Home applied NO device-derived bottom inset, and
 * four separate things had to be true for that to be survivable — none of them
 * were:
 *
 *   1. `AFScreen` defaults `edges={['top']}` and Home passes no `edges`, so the
 *      shell's bottom safe-area contribution is exactly 0.
 *   2. Home sets no `contentInsetAdjustmentBehavior`, and RN's default is
 *      'never', so iOS adds nothing either.
 *   3. `app/(tabs)/_layout.tsx` gives the tab bar `position: 'absolute'`.
 *      react-navigation then renders scenes at `absoluteFill` and only
 *      PUBLISHES the bar's height through `BottomTabBarHeightContext` — it
 *      injects no padding of its own. Nothing in this repo read that context.
 *   4. The real height is `49 + insets.bottom` (react-navigation's
 *      `getTabBarHeight`): 49 on a home-button device, 83 on a notched one.
 *
 * Home's substitute was a hard-coded 128 (`Spacing[24] + Spacing[8]`), which is
 * DEVICE-BLIND: it means "79pt of clearance" on an SE and "45pt" on an iPhone 15,
 * and the non-V3 path's flat 40 meant NEGATIVE clearance on every device — the
 * last 9pt (SE) to 43pt (notched) of Home sat permanently under the bar.
 *
 * THE RULE. Padding = the height the navigator already published + one token of
 * breathing room. Founder: "Do not hard-code another device-specific constant."
 * Nothing here measures a device, names a device, or guesses an inset; the only
 * number this module owns is the breathing allowance, and that is a spacing
 * token, not a device fact.
 *
 * WHY THAT IS PROVABLY ENOUGH. In a ScrollView the last content pixel can always
 * be brought to `viewportHeight - paddingBottom`, and the bar's top edge is at
 * `viewportHeight - tabBarHeight`, so the gap the member sees is
 * `paddingBottom - tabBarHeight` — i.e. exactly the breathing room, on every
 * device, at every content height and every Dynamic Type size. The device terms
 * cancel. `homeSafeArea.test.ts` asserts that invariant rather than trusting it.
 *
 * Pure and node-testable, following this directory's established idiom
 * (`homePresentation.ts`, `homeBaselineState.ts`, `homeConfidence.ts`): the
 * DECISION lives here, the context read lives in the screen. Home-scoped — no
 * other surface imports this, and no shared primitive changed.
 */
import { Spacing } from '@/theme';

/**
 * Breathing room between the last pixel of Home and the top edge of the tab
 * bar. This is the SAME token Home already spent as its bottom spacer
 * (`Spacing[10]`, which itself replaced a trailing `<View height:40/>`), so a
 * surface with no tab bar above it renders exactly as it does today — the fix
 * adds the bar's height, it does not re-space the screen.
 */
export const HOME_BOTTOM_BREATHING_ROOM = Spacing[10];

/**
 * Home's scroll-content `paddingBottom`.
 *
 * @param publishedTabBarHeight the value of `BottomTabBarHeightContext` — the
 *   height react-navigation actually laid the bar out at. `undefined`/`null`
 *   means "no bottom tab bar above this content" (Home mounted outside the tab
 *   navigator, e.g. a render harness), which is a real 0, not a missing
 *   measurement to guess at.
 */
export function resolveHomeScrollBottomPadding(
  publishedTabBarHeight: number | null | undefined,
): number {
  const published =
    typeof publishedTabBarHeight === 'number' && Number.isFinite(publishedTabBarHeight)
      ? Math.max(0, publishedTabBarHeight)
      : 0;
  return published + HOME_BOTTOM_BREATHING_ROOM;
}
