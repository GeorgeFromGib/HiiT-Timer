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

  func test_skip_jumpsToStartOfNextSegment() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    engine.start()
    now = now.addingTimeInterval(3) // still in warmup (segment 0, ends at 10)
    engine.tick()
    engine.skip()
    XCTAssertEqual(engine.state.currentIndex, 1) // landed exactly on segment 1's start
    XCTAssertEqual(engine.state.elapsed, 10, accuracy: 0.001)
  }

  func test_skip_onLastSegment_finishesWorkout() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    var finishCount = 0
    engine.onFinish = { finishCount += 1 }
    engine.start()
    now = now.addingTimeInterval(32) // in the cooldown segment (index 2, ends at 35)
    engine.tick()
    engine.skip()
    XCTAssertEqual(engine.state.status, .finished)
    XCTAssertEqual(finishCount, 1)
  }

  func test_skip_beforeStart_isNoOp() {
    let engine = WorkoutTimerEngine(segments: makeSegments())
    engine.skip()
    XCTAssertEqual(engine.state.status, .idle)
  }

  func test_onTransition_firesOnceWithFromAndToSegments() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    var transitions: [(Int?, Int?)] = []
    engine.onTransition = { from, to in transitions.append((from?.index, to?.index)) }
    engine.start() // fires (nil, 0)
    now = now.addingTimeInterval(11) // fires (0, 1)
    engine.tick()
    engine.tick() // same segment, must not fire again
    XCTAssertEqual(transitions.map(\.0), [nil, 0])
    XCTAssertEqual(transitions.map(\.1), [0, 1])
  }

  func test_start_atElapsed_resumesMidSegment() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    engine.start(atElapsed: 15) // 15s in, inside the "work" segment (index 1, 10...30)
    XCTAssertEqual(engine.state.status, .running)
    XCTAssertEqual(engine.state.currentIndex, 1)
    XCTAssertEqual(engine.state.elapsed, 15, accuracy: 0.001)
    XCTAssertEqual(engine.state.remainingInSegment, 15, accuracy: 0.001)
  }

  func test_start_atElapsed_pastTotalDuration_finishesImmediately() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    var finishCount = 0
    engine.onFinish = { finishCount += 1 }
    engine.start(atElapsed: 999)
    XCTAssertEqual(engine.state.status, .finished)
    XCTAssertEqual(finishCount, 1)
  }

  func test_tick_whileRunning_setsSegmentEndDateToNowPlusRemaining() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    engine.start()
    now = now.addingTimeInterval(12) // inside "work" segment (10...30), remainingInSegment = 18
    engine.tick()
    XCTAssertEqual(engine.state.segmentEndDate, now.addingTimeInterval(18))
  }

  func test_segmentEndDate_isNilWhenIdle() {
    let engine = WorkoutTimerEngine(segments: makeSegments())
    XCTAssertNil(engine.state.segmentEndDate)
  }

  func test_segmentEndDate_isNilAfterPause() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    engine.start()
    now = now.addingTimeInterval(5)
    engine.tick()
    engine.pause()
    XCTAssertNil(engine.state.segmentEndDate)
  }

  func test_segmentEndDate_isNilAfterFinish() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    engine.start()
    now = now.addingTimeInterval(999) // past total duration (35s)
    engine.tick()
    XCTAssertNil(engine.state.segmentEndDate)
  }
}
