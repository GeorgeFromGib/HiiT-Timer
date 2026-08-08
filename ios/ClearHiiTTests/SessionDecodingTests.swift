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

  func test_isRunnableInV1_trueForCircuit() {
    let circuit = SessionDTO(id: "3", name: "C", folderId: "f", activityType: nil,
                              runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
                              mode: "circuit", config: nil,
                              intervals: [IntervalDTO(type: .work, dur: 40, speed: nil, incline: nil, activityLabel: "Push-ups")],
                              circuits: 3, warmup: 60, cooldown: 60, circuitRest: 30)
    XCTAssertTrue(circuit.isRunnableInV1)
  }

  func test_isRunnableInV1_falseForWalk() {
    let walk = SessionDTO(id: "4", name: "W", folderId: "f", activityType: "walk",
                           runSpeeds: RunSpeeds(warmupSpeed: 3, workSpeed: 5, restSpeed: 3, cooldownSpeed: 3),
                           runInclines: nil, inclineEnabled: nil,
                           mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                           intervals: nil)
    XCTAssertFalse(walk.isRunnableInV1)
  }

  func test_isRunnableInV1_trueForSpinning() {
    let spinning = SessionDTO(id: "5", name: "Sp", folderId: "f", activityType: "spinning",
                               runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
                               mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                               intervals: nil)
    XCTAssertTrue(spinning.isRunnableInV1)
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

  func test_isSpinning_trueOnlyForSpinningActivityType() {
    let standard = SessionDTO(id: "1", name: "S", folderId: "f", activityType: nil,
                               runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
                               mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                               intervals: nil)
    let spinning = SessionDTO(id: "2", name: "Sp", folderId: "f", activityType: "spinning",
                               runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
                               mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                               intervals: nil)
    let walk = SessionDTO(id: "3", name: "W", folderId: "f", activityType: "walk",
                           runSpeeds: RunSpeeds(warmupSpeed: 3, workSpeed: 5, restSpeed: 3, cooldownSpeed: 3),
                           runInclines: nil, inclineEnabled: nil,
                           mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                           intervals: nil)
    XCTAssertFalse(standard.isSpinning)
    XCTAssertTrue(spinning.isSpinning)
    XCTAssertFalse(walk.isSpinning)
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

  func test_segmentsForSession_spinningOverlaysResistanceAndPower() {
    let session = SessionDTO(
      id: "5", name: "Sp", folderId: "f", activityType: "spinning",
      runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
      mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 1, cooldown: 0),
      intervals: nil,
      spinValues: SpinValuesDTO(
        warmupResistance: 3, warmupPower: 85,
        workResistance: 5, workPower: 120,
        restResistance: 2, restPower: 60,
        cooldownResistance: 3, cooldownPower: 85
      )
    )
    let segs = segmentsForSession(session)
    XCTAssertEqual(segs.map(\.phase), [.work, .rest])
    XCTAssertEqual(segs[0].resistance, 5)
    XCTAssertEqual(segs[0].power, 120)
    XCTAssertEqual(segs[1].resistance, 2)
    XCTAssertEqual(segs[1].power, 60)
  }

  func test_segmentsForSession_spinningWithNoSpinValues_usesDefaults() {
    let session = SessionDTO(
      id: "6", name: "Sp", folderId: "f", activityType: "spinning",
      runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
      mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 0, rounds: 1, cooldown: 0),
      intervals: nil
    )
    let segs = segmentsForSession(session)
    XCTAssertEqual(segs[0].resistance, 5)  // DEFAULT_SPIN_VALUES.workResistance, mirrors sessions.ts
    XCTAssertEqual(segs[0].power, 120)     // DEFAULT_SPIN_VALUES.workPower
  }

  func test_segmentsForSession_spinningAdvancedIntervalOverridesResistanceAndPower() {
    let session = SessionDTO(
      id: "7", name: "Sp", folderId: "f", activityType: "spinning",
      runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
      mode: "advanced", config: nil,
      intervals: [IntervalDTO(type: .work, dur: 20, speed: nil, incline: nil, resistance: 8, power: 200)],
      spinValues: SpinValuesDTO(
        warmupResistance: 3, warmupPower: 85,
        workResistance: 5, workPower: 120,
        restResistance: 2, restPower: 60,
        cooldownResistance: 3, cooldownPower: 85
      )
    )
    let segs = segmentsForSession(session)
    XCTAssertEqual(segs[0].resistance, 8)
    XCTAssertEqual(segs[0].power, 200)
  }

  func test_segmentsForSession_circuitBuildsCircuitSegments() {
    let session = SessionDTO(
      id: "4", name: "C", folderId: "f", activityType: nil,
      runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
      mode: "circuit", config: nil,
      intervals: [
        IntervalDTO(type: .work, dur: 40, speed: nil, incline: nil, activityLabel: "Push-ups"),
        IntervalDTO(type: .rest, dur: 20, speed: nil, incline: nil),
      ],
      circuits: 2, warmup: 60, cooldown: 60, circuitRest: 30
    )
    let segs = segmentsForSession(session)
    XCTAssertEqual(segs.map(\.phase), [.warmup, .work, .rest, .circuitRest, .work, .rest, .cooldown])
    XCTAssertEqual(segs[1].activityLabel, "Push-ups")
    XCTAssertEqual(segs[1].circuitNumber, 1)
    XCTAssertEqual(segs[4].circuitNumber, 2)
  }

  func test_decodeRunnableSessions_parsesAndFiltersBlobs() {
    let standardJSON = """
    {"id":"1","name":"S","folderId":"f","mode":"easy","config":{"warmup":0,"high":20,"low":0,"rounds":1,"cooldown":0}}
    """
    let spinningJSON = """
    {"id":"2","name":"Sp","folderId":"f","mode":"easy","activityType":"spinning","config":{"warmup":0,"high":20,"low":0,"rounds":1,"cooldown":0}}
    """
    let walkJSON = """
    {"id":"3","name":"W","folderId":"f","mode":"easy","activityType":"walk","config":{"warmup":0,"high":20,"low":0,"rounds":1,"cooldown":0}}
    """
    let malformedJSON = "not json"

    let result = decodeRunnableSessions(fromJSONBlobs: [standardJSON, spinningJSON, walkJSON, malformedJSON])
    XCTAssertEqual(result.map(\.id), ["1", "2"])
  }

  func test_dedupeFoldersById_keepsFirstOccurrencePerId() {
    let folders = [
      FolderDTO(id: "f1", name: "Cardio", orderIndex: 0),
      FolderDTO(id: "f2", name: "Strength", orderIndex: 1),
      FolderDTO(id: "f1", name: "Cardio (duplicate CloudKit record)", orderIndex: 2),
    ]
    let result = dedupeFoldersById(folders)
    XCTAssertEqual(result.map(\.id), ["f1", "f2"])
    XCTAssertEqual(result[0].name, "Cardio")
  }
}
