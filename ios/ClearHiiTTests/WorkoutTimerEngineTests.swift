import XCTest

final class WorkoutTimerEngineTests: XCTestCase {
  func makeSegments() -> [Segment] {
    [
      Segment(phase: .warmup, duration: 10, startAt: 0, endAt: 10, index: 0),
      Segment(phase: .work, duration: 20, startAt: 10, endAt: 30, index: 1),
      Segment(phase: .cooldown, duration: 5, startAt: 30, endAt: 35, index: 2),
    ]
  }

  func test_start_setsRunningAndFirstSegment() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    engine.start()
    XCTAssertEqual(engine.state.status, .running)
    XCTAssertEqual(engine.state.currentIndex, 0)
  }

  func test_tick_advancesElapsedFromWallClock() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    engine.start()
    now = now.addingTimeInterval(12) // now inside the "work" segment (index 1)
    engine.tick()
    XCTAssertEqual(engine.state.currentIndex, 1)
    XCTAssertEqual(engine.state.elapsed, 12, accuracy: 0.001)
    XCTAssertEqual(engine.state.remainingInSegment, 18, accuracy: 0.001)
  }

  func test_pauseThenResume_preservesElapsedAcrossTheGap() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    engine.start()
    now = now.addingTimeInterval(5)
    engine.tick()
    engine.pause()
    now = now.addingTimeInterval(100) // large real-world gap while paused
    engine.resume()
    now = now.addingTimeInterval(2)
    engine.tick()
    XCTAssertEqual(engine.state.elapsed, 7, accuracy: 0.001) // 5 + 2, the 100s gap is not counted
  }

  func test_reset_returnsToIdle() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    engine.start()
    now = now.addingTimeInterval(5)
    engine.tick()
    engine.reset()
    XCTAssertEqual(engine.state.status, .idle)
    XCTAssertEqual(engine.state.currentIndex, -1)
    XCTAssertEqual(engine.state.elapsed, 0)
  }

  func test_tick_pastTotalDuration_firesFinishOnce() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    var finishCount = 0
    engine.onFinish = { finishCount += 1 }
    engine.start()
    now = now.addingTimeInterval(999)
    engine.tick()
    engine.tick() // second tick past the end must not fire onFinish again
    XCTAssertEqual(engine.state.status, .finished)
    XCTAssertEqual(finishCount, 1)
  }

  func test_tick_afterFinish_isNoOpAndDoesNotRefireTransition() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    var transitionCount = 0
    engine.onTransition = { _, _ in transitionCount += 1 }
    engine.start()
    now = now.addingTimeInterval(999)
    engine.tick() // finishes; fires exactly one onTransition (to nil)
    let transitionsAfterFinish = transitionCount
    engine.tick() // must be a complete no-op
    XCTAssertEqual(transitionCount, transitionsAfterFinish)
    XCTAssertEqual(engine.state.status, .finished)
    XCTAssertEqual(engine.state.currentIndex, -1)
  }
}
