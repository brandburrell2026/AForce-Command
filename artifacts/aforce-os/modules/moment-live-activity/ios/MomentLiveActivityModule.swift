import ExpoModulesCore
#if canImport(ActivityKit)
import ActivityKit
#endif

// MUST stay identical (name and shape) to the copy in
// targets/moment-activity/MomentLiveActivity.swift.
#if canImport(ActivityKit)
@available(iOS 16.2, *)
struct MomentActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var inProgress: Bool
  }
}
#endif

/// Starts and ends the one AFORCE Live Activity. It is given no Moment data:
/// only when the card should be treated as stale.
public class MomentLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MomentLiveActivity")

    /// False on iOS below 16.2 and when the member has Live Activities off.
    Function("isEnabled") { () -> Bool in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      #endif
      return false
    }

    /// Ends any earlier activity, then starts one. Resolves false when nothing was started.
    AsyncFunction("start") { (staleAtMs: Double, promise: Promise) in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
          promise.resolve(false)
          return
        }
        Task {
          for activity in Activity<MomentActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
          }
          let content = ActivityContent(
            state: MomentActivityAttributes.ContentState(inProgress: true),
            staleDate: Date(timeIntervalSince1970: staleAtMs / 1000)
          )
          do {
            _ = try Activity.request(attributes: MomentActivityAttributes(), content: content, pushType: nil)
            promise.resolve(true)
          } catch {
            promise.resolve(false)
          }
        }
        return
      }
      #endif
      promise.resolve(false)
    }

    /// Ends every AFORCE activity at once. Resolves how many were running.
    AsyncFunction("end") { (promise: Promise) in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        Task {
          let running = Activity<MomentActivityAttributes>.activities
          for activity in running {
            await activity.end(nil, dismissalPolicy: .immediate)
          }
          promise.resolve(running.count)
        }
        return
      }
      #endif
      promise.resolve(0)
    }

    /// How many AFORCE activities are running (0 or 1 in normal use).
    Function("runningCount") { () -> Int in
      #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        return Activity<MomentActivityAttributes>.activities.count
      }
      #endif
      return 0
    }
  }
}
