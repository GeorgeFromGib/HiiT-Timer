// ios/ClearHiiTTests/SegmentBuilderTests.swift
import XCTest

final class SegmentBuilderTests: XCTestCase {
  func test_expandWorkout_buildsWarmupWorkRestCooldown() {
    let cfg = WorkoutConfig(warmup: 10, high: 20, low: 5, rounds: 2, cooldown: 15)
    let segs = expandWorkout(cfg)

    XCTAssertEqual(segs.map(\.phase), [.warmup, .work, .rest, .work, .rest, .cooldown])
    XCTAssertEqual(segs.map(\.duration), [10, 20, 5, 20, 5, 15])
    XCTAssertEqual(segs.map(\.startAt), [0, 10, 30, 35, 55, 60])
    XCTAssertEqual(segs.map(\.endAt), [10, 30, 35, 55, 60, 75])
    XCTAssertEqual(segs.map(\.index), [0, 1, 2, 3, 4, 5])
  }

  func test_expandWorkout_skipsZeroDurationPhases() {
    let cfg = WorkoutConfig(warmup: 0, high: 20, low: 0, rounds: 1, cooldown: 0)
    let segs = expandWorkout(cfg)
    XCTAssertEqual(segs.map(\.phase), [.work])
  }

  func test_intervalsToSegments_preservesOrderAndOffsets() {
    let intervals = [
      IntervalDTO(type: .warmup, dur: 20, speed: nil, incline: nil),
      IntervalDTO(type: .work, dur: 30, speed: 10, incline: 2),
      IntervalDTO(type: .rest, dur: 15, speed: nil, incline: nil),
    ]
    let segs = intervalsToSegments(intervals)

    XCTAssertEqual(segs.map(\.phase), [.warmup, .work, .rest])
    XCTAssertEqual(segs.map(\.startAt), [0, 20, 50])
    XCTAssertEqual(segs.map(\.endAt), [20, 50, 65])
  }

  func test_speedForPhase_mapsEachPhase() {
    let speeds = RunSpeeds(warmupSpeed: 3, workSpeed: 9, restSpeed: 4, cooldownSpeed: 3)
    XCTAssertEqual(speedForPhase(.work, speeds), 9)
    XCTAssertEqual(speedForPhase(.rest, speeds), 4)
    XCTAssertEqual(speedForPhase(.circuitRest, speeds), 4) // maps to restSpeed, same as TS
  }

  // MARK: - expandCircuit (mirrors src/lib/__tests__/workout.test.ts's `expandCircuit` suite)

  private let circuitIntervals = [
    IntervalDTO(type: .work, dur: 30, speed: nil, incline: nil, activityLabel: "Push-ups"),
    IntervalDTO(type: .rest, dur: 10, speed: nil, incline: nil),
  ]

  func test_expandCircuit_repeatsIntervalListPerCircuit_taggingCircuitNumber() {
    let segs = expandCircuit(circuitIntervals, circuits: 2, warmup: 60, cooldown: 60, circuitRest: 20)
    XCTAssertEqual(segs.map(\.phase), [.warmup, .work, .rest, .circuitRest, .work, .rest, .cooldown])
    XCTAssertEqual(segs.filter { $0.phase == .work }.map(\.circuitNumber), [1, 2])
  }

  func test_expandCircuit_doesNotAddCircuitRestAfterFinalCircuit() {
    let segs = expandCircuit(circuitIntervals, circuits: 1, warmup: 0, cooldown: 0, circuitRest: 20)
    XCTAssertFalse(segs.contains { $0.phase == .circuitRest })
  }

  func test_expandCircuit_omitsCircuitRestBetweenCircuitsWhenCircuitRestIsZero() {
    let segs = expandCircuit(circuitIntervals, circuits: 2, warmup: 0, cooldown: 0, circuitRest: 0)
    XCTAssertFalse(segs.contains { $0.phase == .circuitRest })
  }

  func test_expandCircuit_carriesActivityLabelOntoEachSegment() {
    let segs = expandCircuit(circuitIntervals, circuits: 1, warmup: 0, cooldown: 0, circuitRest: 0)
    XCTAssertEqual(segs[0].activityLabel, "Push-ups")
  }

  // MARK: - upNextExercises

  func test_upNextExercises_listsRemainingExercisesInCurrentCircuit() {
    let intervals = [
      IntervalDTO(type: .work, dur: 30, speed: nil, incline: nil, activityLabel: "Push-ups"),
      IntervalDTO(type: .rest, dur: 10, speed: nil, incline: nil),
      IntervalDTO(type: .work, dur: 30, speed: nil, incline: nil, activityLabel: "Squats"),
      IntervalDTO(type: .rest, dur: 10, speed: nil, incline: nil),
    ]
    let segs = expandCircuit(intervals, circuits: 2, warmup: 0, cooldown: 0, circuitRest: 20)
    let upNext = upNextExercises(segs, currentIndex: 0)
    XCTAssertEqual(upNext, ["Squats"])
  }

  func test_upNextExercises_emptyOnLastExerciseOfCircuit() {
    let intervals = [IntervalDTO(type: .work, dur: 30, speed: nil, incline: nil, activityLabel: "Push-ups")]
    let segs = expandCircuit(intervals, circuits: 1, warmup: 0, cooldown: 0, circuitRest: 0)
    let upNext = upNextExercises(segs, currentIndex: 0)
    XCTAssertTrue(upNext.isEmpty)
  }

  func test_upNextExercises_emptyForNonCircuitSegment() {
    let segs = expandWorkout(WorkoutConfig(warmup: 10, high: 20, low: 10, rounds: 1, cooldown: 0))
    let upNext = upNextExercises(segs, currentIndex: 0)
    XCTAssertTrue(upNext.isEmpty)
  }
}
