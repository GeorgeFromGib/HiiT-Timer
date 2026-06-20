import ActivityKit

struct WorkoutActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var phase: String       // "work" | "rest" | "warmup" | "cooldown"
        var phaseLabel: String  // "WORK" | "RECOVER" | "WARM UP" | "COOL DOWN"
        var timeRemaining: Int  // seconds remaining in this segment
        var phaseColor: String  // hex e.g. "#ff5a5f"
    }

    var sessionName: String
}
