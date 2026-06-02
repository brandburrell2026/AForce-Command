/**
 * Web layout padding constants.
 *
 * On web the safe-area insets aren't available the same way they are
 * on native, so screens fall back to fixed pixel padding that matches
 * the visual rhythm of the iOS / Android safe areas.
 *
 *   WEB_TOP_PADDING    — replaces `Platform.OS === 'web' ? 67 : insets.top`
 *   WEB_BOTTOM_INSET   — bottom safe-area substitute (no tab bar)
 *   TAB_BAR_HEIGHT     — fixed height the tab bar reserves on web
 *   WEB_BOTTOM_PADDING — bottom inset + tab bar (use on tab screens)
 */
export const WEB_TOP_PADDING = 67;
export const WEB_BOTTOM_INSET = 34;
export const TAB_BAR_HEIGHT = 84;
export const WEB_BOTTOM_PADDING = WEB_BOTTOM_INSET + TAB_BAR_HEIGHT;
