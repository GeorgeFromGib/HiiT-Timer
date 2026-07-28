// ios/Shared/WorkoutSessionRecording.swift
import HealthKit

protocol WorkoutSessionRecording {
  func requestAuthorization(_ completion: @escaping (Bool) -> Void)
  func start(activityType: HKWorkoutActivityType)
  func pause()
  func resume()
  func end(save: Bool)
}

func hkActivityType(for session: SessionDTO) -> HKWorkoutActivityType {
  session.isTreadmill ? .running : .highIntensityIntervalTraining
}

/// Mirrors WorkoutTimerEngine's status onto a WorkoutSessionRecording exactly
/// once per transition, so callers can pass every status change through
/// `handle(status:)` without worrying about redundant HealthKit calls.
final class WorkoutSessionCoordinator {
  private let recorder: WorkoutSessionRecording
  private let activityType: HKWorkoutActivityType
  private var didStart = false
  private var didEnd = false

  init(recorder: WorkoutSessionRecording, activityType: HKWorkoutActivityType) {
    self.recorder = recorder
    self.activityType = activityType
  }

  func requestAuthorization(_ completion: @escaping (Bool) -> Void) {
    recorder.requestAuthorization(completion)
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
