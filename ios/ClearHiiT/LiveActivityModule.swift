import ActivityKit
import Foundation

@objc(LiveActivityModule)
class LiveActivityModule: NSObject {
    private var currentActivity: Activity<WorkoutActivityAttributes>?

    @objc static func requiresMainQueueSetup() -> Bool { false }

    @objc func startActivity(
        _ sessionName: String,
        phase: String,
        phaseLabel: String,
        timeRemaining: NSNumber,
        phaseColor: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            resolve(nil)
            return
        }

        // End any existing activity before starting a new one
        if let existing = currentActivity {
            Task { await existing.end(nil, dismissalPolicy: .immediate) }
            currentActivity = nil
        }

        let state = WorkoutActivityAttributes.ContentState(
            phase: phase,
            phaseLabel: phaseLabel,
            timeRemaining: timeRemaining.intValue,
            phaseColor: phaseColor
        )
        let content = ActivityContent(state: state, staleDate: nil)

        do {
            currentActivity = try Activity.request(
                attributes: WorkoutActivityAttributes(sessionName: sessionName),
                content: content,
                pushType: nil
            )
            resolve(nil)
        } catch {
            reject("LIVE_ACTIVITY_START_FAILED", error.localizedDescription, error)
        }
    }

    @objc func updateActivity(
        _ phase: String,
        phaseLabel: String,
        timeRemaining: NSNumber,
        phaseColor: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let activity = currentActivity else {
            resolve(nil)
            return
        }

        let state = WorkoutActivityAttributes.ContentState(
            phase: phase,
            phaseLabel: phaseLabel,
            timeRemaining: timeRemaining.intValue,
            phaseColor: phaseColor
        )
        let content = ActivityContent(state: state, staleDate: nil)
        Task { await activity.update(content) }
        resolve(nil)
    }

    @objc func endActivity(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let activity = currentActivity else {
            resolve(nil)
            return
        }
        Task { await activity.end(nil, dismissalPolicy: .immediate) }
        currentActivity = nil
        resolve(nil)
    }
}
