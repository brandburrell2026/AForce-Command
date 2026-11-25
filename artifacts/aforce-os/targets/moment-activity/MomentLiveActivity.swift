import ActivityKit
import SwiftUI
import WidgetKit

// MUST stay identical (name and shape) to the copy in
// modules/moment-live-activity/ios/MomentLiveActivityModule.swift. The app
// starts the activity with that copy; this target draws it with this one.
struct MomentActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var inProgress: Bool
  }
}

/// Where a tap goes. The app decides what to open: the Moment that is locked
/// in, sign-in first if needed, or Moments when there is none.
private let returnURL = URL(string: "aforce-os://moment-return")

private struct Mark: View {
  let height: CGFloat
  var body: some View {
    Image("nnMark")
      .resizable()
      .scaledToFit()
      .frame(height: height)
      .accessibilityLabel("AFORCE")
  }
}

struct MomentLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: MomentActivityAttributes.self) { _ in
      // Lock Screen and banner. No title, place, time or score: private by design.
      HStack(spacing: 14) {
        Mark(height: 22)
        Text("Moment in progress")
          .font(.system(size: 15, weight: .medium))
          .foregroundColor(Color(red: 0.97, green: 0.96, blue: 0.94))
        Spacer(minLength: 0)
      }
      .padding(.horizontal, 20)
      .padding(.vertical, 18)
      .activityBackgroundTint(Color(red: 0.035, green: 0.039, blue: 0.039))
      .activitySystemActionForegroundColor(.white)
      .widgetURL(returnURL)
    } dynamicIsland: { _ in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Mark(height: 22).padding(.leading, 8)
        }
        DynamicIslandExpandedRegion(.center) {
          Text("Moment in progress")
            .font(.system(size: 15, weight: .medium))
            .foregroundColor(.white)
        }
      } compactLeading: {
        // Logo only.
        Mark(height: 14)
      } compactTrailing: {
        EmptyView()
      } minimal: {
        Mark(height: 10)
      }
      .widgetURL(returnURL)
      .keylineTint(Color(red: 0.898, green: 0.118, blue: 0.165))
    }
  }
}
