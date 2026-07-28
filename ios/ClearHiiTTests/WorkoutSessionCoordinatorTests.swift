import XCTest
import HealthKit

final class WorkoutSessionCoordinatorTests: XCTestCase {
  final class FakeRecorder: WorkoutSessionRecording {
    var authorizationRequested = false
    var startedActivityType: HKWorkoutActivityType?
    var pauseCount = 0
    var resumeCount = 0
    var endCalls: [Bool] = []

    func requestAuthorization(_ completion: @escaping (Bool) -> Void) {
      authorizationRequested = true
      completion(true)
    }
    func start(activityType: HKWorkoutActivityType) {
      startedActivityType = activityType
    }
    func pause() { pauseCount += 1 }
    func resume() { resumeCount += 1 }
    func end(save: Bool) { endCalls.append(save) }
  }

  func test_handleRunning_firstTime_startsWithGivenActivityType() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .running)
    XCTAssertEqual(recorder.startedActivityType, .running)
    XCTAssertEqual(recorder.resumeCount, 0)
  }

  func test_handleRunning_afterPause_callsResumeNotStartAgain() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .running)
    coordinator.handle(status: .paused)
    coordinator.handle(status: .running)
    XCTAssertEqual(recorder.resumeCount, 1)
  }

  func test_handlePaused_callsPauseOnce() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .running)
    coordinator.handle(status: .paused)
    XCTAssertEqual(recorder.pauseCount, 1)
  }

  func test_handlePaused_beforeStart_isNoOp() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .paused)
    XCTAssertEqual(recorder.pauseCount, 0)
  }

  func test_handleFinished_endsWithSaveTrue() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .running)
    coordinator.handle(status: .finished)
    XCTAssertEqual(recorder.endCalls, [true])
  }

  func test_handleFinished_isIdempotent_doesNotDoubleEnd() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .running)
    coordinator.handle(status: .finished)
    coordinator.handle(status: .finished)
    XCTAssertEqual(recorder.endCalls, [true])
  }

  func test_discardIfUnfinished_endsWithSaveFalse_whenStartedButNotFinished() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .running)
    coordinator.discardIfUnfinished()
    XCTAssertEqual(recorder.endCalls, [false])
  }

  func test_discardIfUnfinished_isNoOp_whenNeverStarted() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.discardIfUnfinished()
    XCTAssertTrue(recorder.endCalls.isEmpty)
  }

  func test_discardIfUnfinished_isNoOp_afterAlreadyFinished() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .running)
    coordinator.handle(status: .finished)
    coordinator.discardIfUnfinished()
    XCTAssertEqual(recorder.endCalls, [true])
  }

  func test_requestAuthorization_forwardsToRecorder() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    var granted = false
    coordinator.requestAuthorization { granted = $0 }
    XCTAssertTrue(recorder.authorizationRequested)
    XCTAssertTrue(granted)
  }

  func test_hkActivityType_running_forTreadmillSession() {
    let session = SessionDTO(id: "1", name: "T", folderId: "f", activityType: "run",
                              runSpeeds: RunSpeeds(warmupSpeed: 3, workSpeed: 9, restSpeed: 4, cooldownSpeed: 3),
                              runInclines: nil, inclineEnabled: false,
                              mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                              intervals: nil)
    XCTAssertEqual(hkActivityType(for: session), .running)
  }

  func test_hkActivityType_hiit_forStandardSession() {
    let session = SessionDTO(id: "2", name: "S", folderId: "f", activityType: nil,
                              runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
                              mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                              intervals: nil)
    XCTAssertEqual(hkActivityType(for: session), .highIntensityIntervalTraining)
  }
}
