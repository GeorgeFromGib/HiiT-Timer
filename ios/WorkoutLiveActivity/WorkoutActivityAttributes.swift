import ActivityKit

struct WorkoutActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var phase: String       // "work" | "rest" | "warmup" | "cooldown"
        var phaseLabel: String  // "WORK" | "RECOVER" | "WARM UP" | "COOL DOWN"
        var endDate: Double     // Unix seconds when this segment ends
        var phaseColor: String  // hex e.g. "#ff5a5f"
    }

    var sessionName: String
}
