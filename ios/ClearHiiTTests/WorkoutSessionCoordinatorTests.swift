import XCTest
import HealthKit

final class WorkoutSessionCoordinatorTests: XCTestCase {
  final class FakeRecorder: WorkoutSessionRecording {
    var authorizationRequested = false
    var startedActivityType: HKWorkoutActivityType?
    var pauseCount = 0
    var resumeCount = 0
    var endCalls: [Bool] = []
    var onStatsUpdate: ((WorkoutLiveStats) -> Void)?

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

  // MARK: - Wired to a real WorkoutTimerEngine (engine: in init)

  func makeEngineSegments() -> [Segment] {
    [
      Segment(phase: .warmup, duration: 10, startAt: 0, endAt: 10, index: 0),
      Segment(phase: .work, duration: 20, startAt: 10, endAt: 30, index: 1),
    ]
  }

  func test_wiredToEngine_start_startsRecorderWithActivityType() {
    let recorder = FakeRecorder()
    let now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeEngineSegments(), now: { now })
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running, engine: engine)
    _ = coordinator

    engine.start()
    XCTAssertEqual(recorder.startedActivityType, .running)
  }

  func test_wiredToEngine_pauseThenResume_forwardsToRecorderWithoutManualHandleCalls() {
    let recorder = FakeRecorder()
    let now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeEngineSegments(), now: { now })
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running, engine: engine)
    _ = coordinator

    engine.start()
    engine.pause()
    engine.resume()
    XCTAssertEqual(recorder.pauseCount, 1)
    XCTAssertEqual(recorder.resumeCount, 1)
  }

  func test_wiredToEngine_pauseWhileAlreadyPaused_doesNotRefireRecorderPause() {
    let recorder = FakeRecorder()
    let now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeEngineSegments(), now: { now })
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running, engine: engine)
    _ = coordinator

    engine.start()
    engine.pause()
    engine.pause() // no-op on the engine (already paused) — must not re-signal the coordinator
    XCTAssertEqual(recorder.pauseCount, 1)
  }

  func test_wiredToEngine_tickPastTotalDuration_endsWithSaveTrue() {
    let recorder = FakeRecorder()
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeEngineSegments(), now: { now })
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running, engine: engine)
    _ = coordinator

    engine.start()
    now = now.addingTimeInterval(999)
    engine.tick()
    XCTAssertEqual(recorder.endCalls, [true])
  }

  func test_onStatsUpdate_forwardsToRecorder() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    var received: WorkoutLiveStats?
    coordinator.onStatsUpdate = { received = $0 }
    recorder.onStatsUpdate?(WorkoutLiveStats(heartRate: 140, activeEnergy: 55))
    XCTAssertEqual(received, WorkoutLiveStats(heartRate: 140, activeEnergy: 55))
  }

  func test_mergingLiveStats_updatesOnlyProvidedFields() {
    let current = WorkoutLiveStats(heartRate: 120, activeEnergy: 30)
    let merged = mergingLiveStats(current, heartRate: nil, activeEnergy: 45)
    XCTAssertEqual(merged, WorkoutLiveStats(heartRate: 120, activeEnergy: 45))
  }

  func test_mergingLiveStats_bothNil_keepsCurrentUnchanged() {
    let current = WorkoutLiveStats(heartRate: 120, activeEnergy: 30)
    let merged = mergingLiveStats(current, heartRate: nil, activeEnergy: nil)
    XCTAssertEqual(merged, current)
  }

  func test_mergingLiveStats_fromEmptyState_setsBothProvidedFields() {
    let merged = mergingLiveStats(WorkoutLiveStats(), heartRate: 150, activeEnergy: 60)
    XCTAssertEqual(merged, WorkoutLiveStats(heartRate: 150, activeEnergy: 60))
  }
}
