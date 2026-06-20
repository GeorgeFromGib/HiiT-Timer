import ExpoModulesCore
import ActivityKit

// Must match the struct in WorkoutLiveActivityWidget.swift (same Codable layout).
struct WorkoutActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var phase: String
        var phaseLabel: String
        var timeRemaining: Int
        var phaseColor: String
    }
    var sessionName: String
}

public class LiveActivityModule: Module {
    private var currentActivity: Activity<WorkoutActivityAttributes>?

    public func definition() -> ModuleDefinition {
        Name("LiveActivityModule")

        AsyncFunction("startActivity") { (sessionName: String, phase: String, phaseLabel: String, timeRemaining: Int, phaseColor: String) async throws in
            let authInfo = ActivityAuthorizationInfo()
            print("[LiveActivity] startActivity — areActivitiesEnabled: \(authInfo.areActivitiesEnabled)")
            guard authInfo.areActivitiesEnabled else { return }

            if let existing = self.currentActivity {
                await existing.end(nil, dismissalPolicy: .immediate)
                self.currentActivity = nil
            }

            let state = WorkoutActivityAttributes.ContentState(
                phase: phase,
                phaseLabel: phaseLabel,
                timeRemaining: timeRemaining,
                phaseColor: phaseColor
            )
            let content = ActivityContent(state: state, staleDate: nil)
            self.currentActivity = try Activity.request(
                attributes: WorkoutActivityAttributes(sessionName: sessionName),
                content: content,
                pushType: nil
            )
            print("[LiveActivity] activity started — id: \(self.currentActivity?.id ?? "nil")")
        }

        AsyncFunction("updateActivity") { (phase: String, phaseLabel: String, timeRemaining: Int, phaseColor: String) async in
            guard let activity = self.currentActivity else { return }
            let state = WorkoutActivityAttributes.ContentState(
                phase: phase,
                phaseLabel: phaseLabel,
                timeRemaining: timeRemaining,
                phaseColor: phaseColor
            )
            await activity.update(ActivityContent(state: state, staleDate: nil))
        }

        AsyncFunction("endActivity") { () async in
            guard let activity = self.currentActivity else { return }
            await activity.end(nil, dismissalPolicy: .immediate)
            self.currentActivity = nil
        }
    }
}
