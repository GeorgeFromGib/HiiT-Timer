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
}
