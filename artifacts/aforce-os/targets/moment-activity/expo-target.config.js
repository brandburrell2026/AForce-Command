/**
 * The AFORCE Live Activity: the thin N–И mark in the Dynamic Island and on
 * the Lock Screen while a Moment is locked in. Tapping it returns to the app.
 *
 * Privacy: the activity carries no Moment title, place, time or score. It
 * shows the mark and, where there is room, "Moment in progress".
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: 'widget',
  name: 'MomentActivity',
  displayName: 'AFORCE',
  bundleIdentifier: '.momentactivity',
  // Live Activities need iOS 16.2 for the ActivityContent API used here.
  deploymentTarget: '16.2',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
  images: {
    // The same artwork as the launch image and app icon (PR #1313): Inter 300,
    // mirrored second N, 0.4em bar, Signal Red, on a clear background.
    nnMark: './nn-mark.png',
  },
};
