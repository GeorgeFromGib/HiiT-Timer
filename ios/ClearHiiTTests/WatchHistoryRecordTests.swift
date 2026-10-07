import XCTest

final class WatchHistoryRecordTests: XCTestCase {
  private func session(mode: String = "easy", activityType: String? = nil) -> SessionDTO {
    SessionDTO(id: "s1", name: "Run", folderId: "f", activityType: activityType, runSpeeds: nil, runInclines: nil,
               inclineEnabled: nil, mode: mode, config: nil, intervals: nil)
  }

  // work 0-20, rest 20-30, work 30-50
  private let segments: [Segment] = [
    Segment(phase: .work, duration: 20, startAt: 0, endAt: 20, index: 0),
    Segment(phase: .rest, duration: 10, startAt: 20, endAt: 30, index: 1),
    Segment(phase: .work, duration: 20, startAt: 30, endAt: 50, index: 2),
  ]
  private let now = Date(timeIntervalSince1970: 1_000)

  func testCompletedRunCoversEverySegment() throws {
    let r = try XCTUnwrap(makeWatchHistoryRecord(id: "x", session: session(), segments: segments, elapsed: 50, completed: true, now: now))
    XCTAssertEqual(r.plannedSecs, 50)
    XCTAssertEqual(r.activeSecs, 50)
    XCTAssertEqual(r.rounds, 3)
    XCTAssertEqual(r.workSecs, 40)
    XCTAssertTrue(r.completed)
    XCTAssertEqual(r.startedAt, (1_000 - 50) * 1000)
    XCTAssertEqual(r.activityType, "general")
  }

  func testAbandonedRunCountsOnlyWhatWasCovered() throws {
    let r = try XCTUnwrap(makeWatchHistoryRecord(id: "x", session: session(), segments: segments, elapsed: 35, completed: false, now: now))
    XCTAssertEqual(r.activeSecs, 35)
    XCTAssertEqual(r.rounds, 3)      // third interval started at 30
    XCTAssertEqual(r.workSecs, 25)   // 20 + 5 into the second work segment
    XCTAssertFalse(r.completed)
  }

  func testAbandonedUnderThresholdIsNotLogged() {
    XCTAssertNil(makeWatchHistoryRecord(id: "x", session: session(), segments: segments, elapsed: minAbandonedSecs - 1, completed: false, now: now))
    XCTAssertNotNil(makeWatchHistoryRecord(id: "x", session: session(), segments: segments, elapsed: minAbandonedSecs, completed: false, now: now))
  }

  func testActivityTypeMapping() throws {
    let circuit = try XCTUnwrap(makeWatchHistoryRecord(id: "x", session: session(mode: "circuit"), segments: segments, elapsed: 50, completed: true))
    XCTAssertEqual(circuit.activityType, "circuit")
    let run = try XCTUnwrap(makeWatchHistoryRecord(id: "x", session: session(activityType: "run"), segments: segments, elapsed: 50, completed: true))
    XCTAssertEqual(run.activityType, "run")
  }

  func testTabataSessionIsLoggedAsTabata() throws {
    let r = try XCTUnwrap(makeWatchHistoryRecord(id: "x", session: session(mode: "circuit", activityType: "tabata"), segments: segments, elapsed: 50, completed: true))
    XCTAssertEqual(r.activityType, "tabata")
  }

  func testTabataFlagDecodesFromSyncedJSONAndStaysRunnable() throws {
    let json = #"""
    {"id":"t1","name":"Tabata","folderId":"f","mode":"circuit","circuits":8,"warmup":300,"cooldown":300,"circuitRest":0,"activityType":"tabata","intervals":[]}
    """#
    let dto = try JSONDecoder().decode(SessionDTO.self, from: Data(json.utf8))
    XCTAssertTrue(dto.isTabata)
    XCTAssertTrue(dto.isRunnableInV1)
  }

  func testUserInfoPayloadShapeMatchesWhatThePhoneParses() throws {
    let r = try XCTUnwrap(makeWatchHistoryRecord(id: "x", session: session(), segments: segments, elapsed: 50, completed: true, now: now))
    let info = r.userInfo
    XCTAssertEqual(info["kind"] as? String, "historyEntry")
    for key in ["id", "sessionId", "sessionName", "activityType"] { XCTAssertTrue(info[key] is String, key) }
    for key in ["startedAt", "plannedSecs", "activeSecs", "workSecs"] { XCTAssertTrue(info[key] is Double, key) }
    XCTAssertTrue(info["rounds"] is Int)
    XCTAssertTrue(info["completed"] is Bool)
  }
}
