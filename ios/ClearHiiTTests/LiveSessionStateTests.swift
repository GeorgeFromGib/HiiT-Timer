import XCTest

final class LiveSessionStateTests: XCTestCase {
  func test_liveSessionState_parsesValidContext() {
    let context: [String: Any] = [
      "sessionId": "abc123",
      "name": "Tabata",
      "elapsed": 42.5,
      "status": "running",
      "updatedAt": 1_700_000_000.0,
    ]
    let state = liveSessionState(fromApplicationContext: context)
    XCTAssertEqual(state?.sessionId, "abc123")
    XCTAssertEqual(state?.name, "Tabata")
    XCTAssertEqual(state?.elapsed, 42.5)
    XCTAssertEqual(state?.status, "running")
    XCTAssertEqual(state?.updatedAt, Date(timeIntervalSince1970: 1_700_000_000))
  }

  func test_liveSessionState_nilForEmptyContext() {
    XCTAssertNil(liveSessionState(fromApplicationContext: [:]))
  }

  func test_liveSessionState_nilWhenAFieldIsMissing() {
    let context: [String: Any] = [
      "sessionId": "abc123",
      "name": "Tabata",
      "elapsed": 42.5,
      "status": "running",
    ]
    XCTAssertNil(liveSessionState(fromApplicationContext: context))
  }

  func test_resumeElapsed_addsWallClockGapWhileRunning() {
    let state = LiveSessionState(sessionId: "1", name: "Tabata", elapsed: 20, status: "running", updatedAt: Date(timeIntervalSince1970: 1000))
    let now = Date(timeIntervalSince1970: 1008)
    XCTAssertEqual(resumeElapsed(for: state, now: now), 28, accuracy: 0.001)
  }

  func test_resumeElapsed_ignoresWallClockGapWhilePaused() {
    let state = LiveSessionState(sessionId: "1", name: "Tabata", elapsed: 20, status: "paused", updatedAt: Date(timeIntervalSince1970: 1000))
    let now = Date(timeIntervalSince1970: 1008)
    XCTAssertEqual(resumeElapsed(for: state, now: now), 20, accuracy: 0.001)
  }

  func test_isLiveSessionFresh_trueWithinMaxAge() {
    let state = LiveSessionState(sessionId: "1", name: "Tabata", elapsed: 20, status: "paused", updatedAt: Date(timeIntervalSince1970: 1000))
    let now = Date(timeIntervalSince1970: 1000 + liveSessionMaxAge - 1)
    XCTAssertTrue(isLiveSessionFresh(state, now: now))
  }

  func test_isLiveSessionFresh_falseBeyondMaxAge() {
    let state = LiveSessionState(sessionId: "1", name: "Tabata", elapsed: 20, status: "paused", updatedAt: Date(timeIntervalSince1970: 1000))
    let now = Date(timeIntervalSince1970: 1000 + liveSessionMaxAge + 1)
    XCTAssertFalse(isLiveSessionFresh(state, now: now))
  }
}
