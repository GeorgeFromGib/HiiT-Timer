import ExpoModulesCore
import ActivityKit

// Must match WorkoutActivityAttributes.swift in the widget extension (same Codable layout).
struct WorkoutActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var phase: String
        var phaseLabel: String
        var endDate: Double     // Unix seconds
        var phaseColor: String
    }
    var sessionName: String
}

public class LiveActivityModule: Module {
    private var currentActivity: Activity<WorkoutActivityAttributes>?

    public func definition() -> ModuleDefinition {
        Name("LiveActivityModule")

        AsyncFunction("startActivity") { (sessionName: String, phase: String, phaseLabel: String, endTime: Double, phaseColor: String) async throws in
            let authInfo = ActivityAuthorizationInfo()
            guard authInfo.areActivitiesEnabled else { return }

            if let existing = self.currentActivity {
                await existing.end(nil, dismissalPolicy: .immediate)
                self.currentActivity = nil
            }

            let state = WorkoutActivityAttributes.ContentState(
                phase: phase,
                phaseLabel: phaseLabel,
                endDate: endTime,
                phaseColor: phaseColor
            )
            self.currentActivity = try Activity.request(
                attributes: WorkoutActivityAttributes(sessionName: sessionName),
                content: ActivityContent(state: state, staleDate: nil),
                pushType: nil
            )
            print("[LiveActivity] started — id: \(self.currentActivity?.id ?? "nil")")
        }

        AsyncFunction("updateActivity") { (phase: String, phaseLabel: String, endTime: Double, phaseColor: String) async in
            guard let activity = self.currentActivity else { return }
            let state = WorkoutActivityAttributes.ContentState(
                phase: phase,
                phaseLabel: phaseLabel,
                endDate: endTime,
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
