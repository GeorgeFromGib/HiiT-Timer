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

  func test_nextLiveSessionAction_staleIncoming_isIgnored() {
    let incoming = LiveSessionState(sessionId: "1", name: "Tabata", elapsed: 20, status: "running", updatedAt: Date(timeIntervalSince1970: 1000))
    let now = Date(timeIntervalSince1970: 1000 + liveSessionMaxAge + 1)
    let action = nextLiveSessionAction(currentSessionId: nil, lastAppliedUpdatedAt: nil, incoming: incoming, now: now)
    XCTAssertEqual(action, .ignore)
  }

  func test_nextLiveSessionAction_notNewerThanLastApplied_isIgnored() {
    let incoming = LiveSessionState(sessionId: "1", name: "Tabata", elapsed: 20, status: "running", updatedAt: Date(timeIntervalSince1970: 1000))
    let action = nextLiveSessionAction(currentSessionId: nil, lastAppliedUpdatedAt: Date(timeIntervalSince1970: 1000), incoming: incoming, now: Date(timeIntervalSince1970: 1001))
    XCTAssertEqual(action, .ignore)
  }

  func test_nextLiveSessionAction_noCurrentSession_launchesNew() {
    let incoming = LiveSessionState(sessionId: "1", name: "Tabata", elapsed: 20, status: "paused", updatedAt: Date(timeIntervalSince1970: 1000))
    let action = nextLiveSessionAction(currentSessionId: nil, lastAppliedUpdatedAt: nil, incoming: incoming, now: Date(timeIntervalSince1970: 1000))
    XCTAssertEqual(action, .launchNew(sessionId: "1", resumeElapsed: 20))
  }

  func test_nextLiveSessionAction_differentCurrentSession_launchesNew() {
    let incoming = LiveSessionState(sessionId: "2", name: "Sprint", elapsed: 5, status: "paused", updatedAt: Date(timeIntervalSince1970: 1000))
    let action = nextLiveSessionAction(currentSessionId: "1", lastAppliedUpdatedAt: nil, incoming: incoming, now: Date(timeIntervalSince1970: 1000))
    XCTAssertEqual(action, .launchNew(sessionId: "2", resumeElapsed: 5))
  }

  func test_nextLiveSessionAction_sameCurrentSession_appliesToCurrent() {
    let incoming = LiveSessionState(sessionId: "1", name: "Tabata", elapsed: 20, status: "running", updatedAt: Date(timeIntervalSince1970: 1000))
    let now = Date(timeIntervalSince1970: 1004)
    let action = nextLiveSessionAction(currentSessionId: "1", lastAppliedUpdatedAt: nil, incoming: incoming, now: now)
    XCTAssertEqual(action, .applyToCurrent(elapsed: 24, status: "running"))
  }

  func test_isNewerLiveSessionUpdate_trueWhenNothingAcceptedYet() {
    XCTAssertTrue(isNewerLiveSessionUpdate(updatedAt: Date(timeIntervalSince1970: 1000), lastAccepted: nil))
  }

  func test_isNewerLiveSessionUpdate_rejectsStaleOrEqual() {
    let lastAccepted = Date(timeIntervalSince1970: 1000)
    XCTAssertFalse(isNewerLiveSessionUpdate(updatedAt: Date(timeIntervalSince1970: 999), lastAccepted: lastAccepted))
    XCTAssertFalse(isNewerLiveSessionUpdate(updatedAt: lastAccepted, lastAccepted: lastAccepted))
  }

  func test_isNewerLiveSessionUpdate_acceptsNewer() {
    let lastAccepted = Date(timeIntervalSince1970: 1000)
    XCTAssertTrue(isNewerLiveSessionUpdate(updatedAt: Date(timeIntervalSince1970: 1001), lastAccepted: lastAccepted))
  }
}
