import XCTest

final class SessionDecodingTests: XCTestCase {
  func test_isRunnableInV1_trueForStandardAndTreadmill() {
    let standard = SessionDTO(id: "1", name: "S", folderId: "f", activityType: nil,
                               runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
                               mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                               intervals: nil)
    let treadmill = SessionDTO(id: "2", name: "T", folderId: "f", activityType: "run",
                                runSpeeds: RunSpeeds(warmupSpeed: 3, workSpeed: 9, restSpeed: 4, cooldownSpeed: 3),
                                runInclines: nil, inclineEnabled: false,
                                mode: "advanced", config: nil,
                                intervals: [IntervalDTO(type: .work, dur: 20, speed: nil, incline: nil)])
    XCTAssertTrue(standard.isRunnableInV1)
    XCTAssertTrue(treadmill.isRunnableInV1)
  }

  func test_isRunnableInV1_falseForCircuitAndWalkAndSpinning() {
    let circuit = SessionDTO(id: "3", name: "C", folderId: "f", activityType: nil,
                              runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
                              mode: "circuit", config: nil, intervals: [])
    let walk = SessionDTO(id: "4", name: "W", folderId: "f", activityType: "walk",
                           runSpeeds: RunSpeeds(warmupSpeed: 3, workSpeed: 5, restSpeed: 3, cooldownSpeed: 3),
                           runInclines: nil, inclineEnabled: nil,
                           mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                           intervals: nil)
    let spinning = SessionDTO(id: "5", name: "Sp", folderId: "f", activityType: "spinning",
                               runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
                               mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                               intervals: nil)
    XCTAssertFalse(circuit.isRunnableInV1)
    XCTAssertFalse(walk.isRunnableInV1)
    XCTAssertFalse(spinning.isRunnableInV1)
  }

  func test_isTreadmill_trueOnlyForRunActivityType() {
    let standard = SessionDTO(id: "1", name: "S", folderId: "f", activityType: nil,
                               runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
                               mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                               intervals: nil)
    let treadmill = SessionDTO(id: "2", name: "T", folderId: "f", activityType: "run",
                                runSpeeds: RunSpeeds(warmupSpeed: 3, workSpeed: 9, restSpeed: 4, cooldownSpeed: 3),
                                runInclines: nil, inclineEnabled: false,
                                mode: "advanced", config: nil,
                                intervals: [IntervalDTO(type: .work, dur: 20, speed: nil, incline: nil)])
    let walk = SessionDTO(id: "3", name: "W", folderId: "f", activityType: "walk",
                           runSpeeds: RunSpeeds(warmupSpeed: 3, workSpeed: 5, restSpeed: 3, cooldownSpeed: 3),
                           runInclines: nil, inclineEnabled: nil,
                           mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                           intervals: nil)
    XCTAssertFalse(standard.isTreadmill)
    XCTAssertTrue(treadmill.isTreadmill)
    XCTAssertFalse(walk.isTreadmill)
  }

  func test_segmentsForSession_standardHasNoSpeed() {
    let session = SessionDTO(id: "1", name: "S", folderId: "f", activityType: nil,
                              runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
                              mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 0, rounds: 1, cooldown: 0),
                              intervals: nil)
    let segs = segmentsForSession(session)
    XCTAssertEqual(segs.map(\.phase), [.work])
    XCTAssertNil(segs[0].speed)
  }

  func test_segmentsForSession_treadmillOverlaysSpeedAndIncline() {
    let session = SessionDTO(
      id: "2", name: "T", folderId: "f", activityType: "run",
      runSpeeds: RunSpeeds(warmupSpeed: 3, workSpeed: 9, restSpeed: 4, cooldownSpeed: 3),
      runInclines: RunInclines(warmupIncline: 0, workIncline: 2, restIncline: 1, cooldownIncline: 0),
      inclineEnabled: true,
      mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 1, cooldown: 0),
      intervals: nil
    )
    let segs = segmentsForSession(session)
    XCTAssertEqual(segs.map(\.phase), [.work, .rest])
    XCTAssertEqual(segs[0].speed, 9)
    XCTAssertEqual(segs[0].incline, 2)
    XCTAssertEqual(segs[1].speed, 4)
    XCTAssertEqual(segs[1].incline, 1)
  }

  func test_segmentsForSession_treadmillWithInclineDisabled_omitsIncline() {
    let session = SessionDTO(
      id: "3", name: "T2", folderId: "f", activityType: "run",
      runSpeeds: RunSpeeds(warmupSpeed: 3, workSpeed: 9, restSpeed: 4, cooldownSpeed: 3),
      runInclines: RunInclines(warmupIncline: 0, workIncline: 2, restIncline: 1, cooldownIncline: 0),
      inclineEnabled: false,
      mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 0, rounds: 1, cooldown: 0),
      intervals: nil
    )
    let segs = segmentsForSession(session)
    XCTAssertEqual(segs[0].speed, 9)
    XCTAssertNil(segs[0].incline)
  }

  func test_decodeRunnableSessions_parsesAndFiltersBlobs() {
    let standardJSON = """
    {"id":"1","name":"S","folderId":"f","mode":"easy","config":{"warmup":0,"high":20,"low":0,"rounds":1,"cooldown":0}}
    """
    let circuitJSON = """
    {"id":"2","name":"C","folderId":"f","mode":"circuit"}
    """
    let malformedJSON = "not json"

    let result = decodeRunnableSessions(fromJSONBlobs: [standardJSON, circuitJSON, malformedJSON])
    XCTAssertEqual(result.map(\.id), ["1"])
  }
}
