// ios/Shared/WorkoutSessionRecording.swift
import HealthKit

struct WorkoutLiveStats: Equatable {
  var heartRate: Double?
  var activeEnergy: Double?
}

/// Folds newly-collected values into the previous reading, leaving fields
/// HealthKit didn't report in this callback untouched — HKLiveWorkoutBuilder
/// only reports the sample types that changed on any given callback, not a
/// full snapshot every time.
func mergingLiveStats(_ current: WorkoutLiveStats, heartRate: Double?, activeEnergy: Double?) -> WorkoutLiveStats {
  var result = current
  if let heartRate { result.heartRate = heartRate }
  if let activeEnergy { result.activeEnergy = activeEnergy }
  return result
}

/// Mirrors src/lib/heartRate.ts: zone 1–5 by fraction of max HR, 0 below zone 1.
func heartRateZone(bpm: Double, maxHr: Double) -> Int {
  [0.5, 0.6, 0.7, 0.8, 0.9].filter { bpm / maxHr >= $0 }.count
}

/// Mirrors ZONE_COLORS in src/lib/heartRate.ts (index = zone).
let heartRateZoneColors: [UInt32] = [0x8a9ba0, 0x46a6ff, 0x5fd38a, 0xf5c542, 0xff8a3d, 0xff5a5f]

/// True when black text reads better than white on this 0xRRGGBB colour (WCAG contrast).
func prefersDarkText(onHex hex: UInt32) -> Bool {
  func lin(_ shift: UInt32) -> Double {
    let c = Double((hex >> shift) & 0xff) / 255
    return c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
  }
  let lum = 0.2126 * lin(16) + 0.7152 * lin(8) + 0.0722 * lin(0)
  return (lum + 0.05) / 0.05 > 1.05 / (lum + 0.05)
}

/// 220 − age (190 when unknown), matching maxHrFromAge on the phone.
func maxHeartRate(age: Int?) -> Double {
  age.map { Double(220 - $0) } ?? 190
}

/// A finished (or abandoned) watch-owned run, sent to the phone so it lands in
/// History (SB-27). Mirrors the phone's HistoryEntry (src/lib/history.ts) minus
/// `source`, which the phone stamps as 'watch' on receipt. `startedAt` is epoch ms.
struct WatchHistoryRecord: Equatable {
  let id: String
  let startedAt: Double
  let sessionId: String
  let sessionName: String
  let activityType: String
  let plannedSecs: Double
  let activeSecs: Double
  let rounds: Int
  let workSecs: Double
  let completed: Bool

  /// WCSession.transferUserInfo payload; `kind` lets the phone tell it apart
  /// from live-session/preferences traffic.
  var userInfo: [String: Any] {
    [
      "kind": "historyEntry",
      "id": id,
      "startedAt": startedAt,
      "sessionId": sessionId,
      "sessionName": sessionName,
      "activityType": activityType,
      "plannedSecs": plannedSecs,
      "activeSecs": activeSecs,
      "rounds": rounds,
      "workSecs": workSecs,
      "completed": completed,
    ]
  }
}

/// Abandoned runs shorter than this are accidental starts — same threshold as
/// MIN_ABANDONED_SECS in src/lib/history.ts.
let minAbandonedSecs: Double = 5

/// Builds the record for a run that ended at `elapsed` seconds. Returns nil for
/// an abandoned run too short to count. `rounds` is the number of intervals
/// reached and `workSecs` the work-phase time actually covered, matching what
/// the phone derives from its own segments.
func makeWatchHistoryRecord(
  id: String,
  session: SessionDTO,
  segments: [Segment],
  elapsed: Double,
  completed: Bool,
  now: Date = Date()
) -> WatchHistoryRecord? {
  if !completed && elapsed < minAbandonedSecs { return nil }
  let workSecs = segments
    .filter { $0.phase == .work }
    .reduce(0.0) { $0 + max(0, min(elapsed, $1.endAt) - $1.startAt) }
  return WatchHistoryRecord(
    id: id,
    startedAt: ((now.timeIntervalSince1970 - elapsed) * 1000).rounded(),
    sessionId: session.id,
    sessionName: session.name,
    activityType: session.kind == .unsupported ? "general" : session.kind.rawValue,
    plannedSecs: segments.last?.endAt ?? 0,
    activeSecs: elapsed.rounded(),
    rounds: segments.filter { $0.startAt < elapsed }.count,
    workSecs: workSecs.rounded(),
    completed: completed
  )
}

protocol WorkoutSessionRecording: AnyObject {
  var onStatsUpdate: ((WorkoutLiveStats) -> Void)? { get set }
  func requestAuthorization(_ completion: @escaping (Bool) -> Void)
  func start(activityType: HKWorkoutActivityType)
  func pause()
  func resume()
  func end(save: Bool)
}

func hkActivityType(for session: SessionDTO) -> HKWorkoutActivityType {
  session.kind == .run ? .running : .highIntensityIntervalTraining
}

/// Mirrors WorkoutTimerEngine's status onto a WorkoutSessionRecording exactly
/// once per transition. Pass `engine:` to wire this up automatically off the
/// engine's `onStatusChange` — every start/pause/resume/finish then reaches
/// `handle(status:)` with no separate call needed at the use site.
/// `handle(status:)` stays reachable directly too; that's what the unit tests
/// below use to exercise it without a real WorkoutTimerEngine.
final class WorkoutSessionCoordinator {
  private let recorder: WorkoutSessionRecording
  private let activityType: HKWorkoutActivityType
  private var didStart = false
  private var didEnd = false

  init(recorder: WorkoutSessionRecording, activityType: HKWorkoutActivityType, engine: WorkoutTimerEngine? = nil) {
    self.recorder = recorder
    self.activityType = activityType
    // Strong self is safe (and required for this to survive past init): the
    // coordinator never stores `engine`, so there's no retain cycle, and the
    // engine's closure is what keeps this coordinator alive for its lifetime.
    engine?.onStatusChange = { [self] status in handle(status: status) }
  }

  func requestAuthorization(_ completion: @escaping (Bool) -> Void) {
    recorder.requestAuthorization(completion)
  }

  var onStatsUpdate: ((WorkoutLiveStats) -> Void)? {
    get { recorder.onStatsUpdate }
    set { recorder.onStatsUpdate = newValue }
  }

  func handle(status: TimerState.Status) {
    switch status {
    case .idle:
      break
    case .running:
      guard !didEnd else { return }
      if didStart {
        recorder.resume()
      } else {
        didStart = true
        recorder.start(activityType: activityType)
      }
    case .paused:
      guard didStart, !didEnd else { return }
      recorder.pause()
    case .finished:
      finish(save: true)
    }
  }

  /// Call when the view disappears without reaching `.finished` (e.g. the
  /// user swipes back to the session list mid-run) so the in-progress
  /// HealthKit session is ended and discarded instead of left dangling.
  func discardIfUnfinished() {
    finish(save: false)
  }

  private func finish(save: Bool) {
    guard didStart, !didEnd else { return }
    didEnd = true
    recorder.end(save: save)
  }
}
