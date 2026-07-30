# Watch Circuit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Circuit-mode sessions decodable, expandable into segments, and runnable on the watch — showing the named exercise, circuit progress ("Circuit 2 / 3"), and a Crown-scrollable "up next" list of the remaining exercises in the current circuit round — closing out the Circuit line of `docs/HIIT_Timer_watchOS_Feature_Architecture.md.docx` §2.3 and the v2 phasing line in §5.

**Architecture:** Circuit sessions already sync to the watch's Core Data + CloudKit store today (`WorkoutStore.applySessionsDataJSON` stores the raw JSON blob for every session regardless of mode) — they're just filtered out by `SessionDTO.isRunnableInV1` before reaching the UI. This plan (1) extends `SessionDTO`/`IntervalDTO`/`Segment` with the circuit fields the phone's `Session`/`Interval`/`Segment` types already carry, ports the phone's pure `expandCircuit()` (`src/lib/workout.ts:85-122`) to Swift, and flips `isRunnableInV1` on for circuit sessions; then (2) adds a pure, tested `upNextExercises()` helper and wires it plus the existing `Segment.activityLabel`/`circuitNumber` fields into `SessionRunView`. No phone (React Native), Core Data schema, or HealthKit changes are needed — this is entirely a watch-side decode/expand/display change.

**Tech Stack:** Swift, SwiftUI, XCTest (`ClearHiiTTests` target).

## Global Constraints

- watchOS deployment target stays `10.0` (existing project setting — do not change).
- `xcodebuild test` destination on this machine is `platform=iOS Simulator,name=iPhone 17`; `xcodebuild build` for the watch scheme uses `platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)`.
- Match existing code style: 2-space indentation, no comments unless documenting a non-obvious constraint (see existing files for the bar).
- **Scope: watch-only, view/run only.** Building or editing Circuit workouts on the watch stays out of scope (architecture doc §2.4) — the phone remains the only place to author a circuit session.
- New test files go in `ios/ClearHiiTTests`, which is an Xcode 16 file-system-synchronized group — new files there are picked up automatically, no `project.pbxproj` edits needed (unlike `ios/Shared`, which is manually listed and only touched here to modify existing files).
- HealthKit activity-type classification for circuit sessions is unchanged and not revisited here: `hkActivityType(for:)` (`ios/Shared/WorkoutSessionRecording.swift`) already maps any non-treadmill session, circuit included, to `.highIntensityIntervalTraining`.
- No Digital Crown-specific code is required for the "up next" list — a SwiftUI `ScrollView` on watchOS scrolls via the Digital Crown natively, matching the architecture doc's "Crown-scrollable" wording for free.
- **Design decision (not specified in the architecture doc): the exercise name replaces the phase word in the headline, it doesn't sit alongside it.** The phone shows both — a "WORK"/"RECOVER" phase word plus a separate exercise-name pill (`src/screens/WorkoutScreen.tsx:258-267`). The watch has no room for both at this font size, so `segment?.activityLabel ?? phaseWord[...]` is a straight replacement: warmup/circuitRest/cooldown segments (no `activityLabel`) still show the phase word, work/rest segments show the exercise name instead of "WORK"/"RECOVER". Flagging so this is a conscious call, not a silent gap versus phone parity.
- **Known gap, intentionally out of scope for this plan: no "Next circuit N / M" messaging during the circuitRest break.** The phone shows this (`workout.nextCircuit`, `src/screens/WorkoutScreen.tsx:321-324`); the watch plan only shows "Circuit N / M" while a work/rest segment is active (`segment?.circuitNumber` is nil during circuitRest itself), so the line simply disappears during the break. Revisit if this turns out to matter in practice — it's a small addition (compute the next segment's `circuitNumber` the same way `SessionRunView`'s `WorkoutScreen.tsx` reference does) but adds a second code path this plan doesn't need.
- Baseline test count going into this plan: 37 (`SessionDecodingTests` 7, `SegmentBuilderTests` 4, `WorkoutSessionCoordinatorTests` 16, `WorkoutTimerEngineTests` 10).

---

### Task 1: Decode, expand, and mark Circuit sessions runnable

**Files:**
- Modify: `ios/Shared/WorkoutModels.swift`
- Modify: `ios/Shared/SegmentBuilder.swift`
- Modify: `ios/ClearHiiTTests/SegmentBuilderTests.swift`
- Modify: `ios/ClearHiiTTests/SessionDecodingTests.swift`

**Interfaces:**
- Consumes: `Phase.circuitRest` (`ios/Shared/WorkoutModels.swift:5`, already exists), `Segment` (`ios/Shared/WorkoutModels.swift:8-16`), `IntervalDTO` (`ios/Shared/WorkoutModels.swift:26-31`).
- Produces: `Segment.activityLabel: String?`, `Segment.circuitNumber: Int?`; `IntervalDTO.activityLabel: String?`; `SessionDTO.circuits/warmup/cooldown/circuitRest: Int?/Double?/Double?/Double?`; `func expandCircuit(_ intervals: [IntervalDTO], circuits: Int, warmup: Double, cooldown: Double, circuitRest: Double) -> [Segment]`. Task 2 consumes `Segment.activityLabel`/`circuitNumber` and calls `segmentsForSession` (already existing, extended here) to get circuit segments.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `ios/ClearHiiTTests/SegmentBuilderTests.swift`:

```swift
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
}
```

Replace the entire contents of `ios/ClearHiiTTests/SessionDecodingTests.swift`:

```swift
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

  func test_isRunnableInV1_falseForWalkAndSpinning() {
    let walk = SessionDTO(id: "4", name: "W", folderId: "f", activityType: "walk",
                           runSpeeds: RunSpeeds(warmupSpeed: 3, workSpeed: 5, restSpeed: 3, cooldownSpeed: 3),
                           runInclines: nil, inclineEnabled: nil,
                           mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                           intervals: nil)
    let spinning = SessionDTO(id: "5", name: "Sp", folderId: "f", activityType: "spinning",
                               runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
                               mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                               intervals: nil)
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
    let malformedJSON = "not json"

    let result = decodeRunnableSessions(fromJSONBlobs: [standardJSON, spinningJSON, malformedJSON])
    XCTAssertEqual(result.map(\.id), ["1"])
  }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/SegmentBuilderTests -only-testing:ClearHiiTTests/SessionDecodingTests 2>&1 | tail -40`
Expected: FAIL to build — `extra argument 'activityLabel' in call`, `value of type 'SessionDTO' has no member 'circuits'`, `cannot find 'expandCircuit' in scope` (or similar: the new members/function don't exist yet).

- [ ] **Step 3: Write the implementation**

In `ios/Shared/WorkoutModels.swift`, replace:

```swift
struct IntervalDTO: Codable {
  let type: Phase
  let dur: Double
  let speed: Double?
  let incline: Double?
}
```

with:

```swift
struct IntervalDTO: Codable {
  let type: Phase
  let dur: Double
  let speed: Double?
  let incline: Double?
  let activityLabel: String? = nil
}
```

Replace:

```swift
struct Segment: Equatable {
  let phase: Phase
  let duration: Double
  let startAt: Double
  let endAt: Double
  let index: Int
  var speed: Double? = nil
  var incline: Double? = nil
}
```

with:

```swift
struct Segment: Equatable {
  let phase: Phase
  let duration: Double
  let startAt: Double
  let endAt: Double
  let index: Int
  var speed: Double? = nil
  var incline: Double? = nil
  var activityLabel: String? = nil
  var circuitNumber: Int? = nil
}
```

Replace:

```swift
struct SessionDTO: Codable {
  let id: String
  let name: String
  let folderId: String
  let activityType: String?
  let runSpeeds: RunSpeeds?
  let runInclines: RunInclines?
  let inclineEnabled: Bool?
  let mode: String
  let config: WorkoutConfig?
  let intervals: [IntervalDTO]?

  /// v1 supports Standard (no activityType) and Treadmill (activityType == "run")
  /// sessions in easy or advanced mode. Circuit mode and walk/spinning activity
  /// types sync to Core Data but aren't runnable on the watch until v2.
  var isRunnableInV1: Bool {
    (mode == "easy" || mode == "advanced") && (activityType == nil || activityType == "run")
  }

  var isTreadmill: Bool {
    activityType == "run"
  }
}
```

with:

```swift
struct SessionDTO: Codable {
  let id: String
  let name: String
  let folderId: String
  let activityType: String?
  let runSpeeds: RunSpeeds?
  let runInclines: RunInclines?
  let inclineEnabled: Bool?
  let mode: String
  let config: WorkoutConfig?
  let intervals: [IntervalDTO]?
  let circuits: Int? = nil
  let warmup: Double? = nil
  let cooldown: Double? = nil
  let circuitRest: Double? = nil

  /// Standard (no activityType) and Treadmill (activityType == "run") sessions
  /// run in easy or advanced mode; Circuit sessions run via their own
  /// circuits/warmup/cooldown/circuitRest fields. Walk/spinning activity types
  /// still sync to Core Data but aren't runnable on the watch yet.
  var isRunnableInV1: Bool {
    mode == "circuit" || ((mode == "easy" || mode == "advanced") && (activityType == nil || activityType == "run"))
  }

  var isTreadmill: Bool {
    activityType == "run"
  }
}
```

In `ios/Shared/SegmentBuilder.swift`, replace:

```swift
func intervalsToSegments(_ intervals: [IntervalDTO]) -> [Segment] {
  var cursor: Double = 0
  return intervals.enumerated().map { i, iv in
    let seg = Segment(phase: iv.type, duration: iv.dur, startAt: cursor, endAt: cursor + iv.dur, index: i)
    cursor += iv.dur
    return seg
  }
}
```

with:

```swift
func intervalsToSegments(_ intervals: [IntervalDTO]) -> [Segment] {
  var cursor: Double = 0
  return intervals.enumerated().map { i, iv in
    let seg = Segment(phase: iv.type, duration: iv.dur, startAt: cursor, endAt: cursor + iv.dur, index: i)
    cursor += iv.dur
    return seg
  }
}

/// Ports src/lib/workout.ts's expandCircuit() — repeats `intervals` for each of
/// `circuits` rounds, tagging every segment in round N with circuitNumber N,
/// with a circuitRest between rounds (never after the last) and warmup/cooldown
/// bookending the whole thing.
func expandCircuit(
  _ intervals: [IntervalDTO],
  circuits: Int,
  warmup: Double,
  cooldown: Double,
  circuitRest: Double
) -> [Segment] {
  var raw: [(phase: Phase, duration: Double, activityLabel: String?, circuitNumber: Int?)] = []

  if warmup > 0 {
    raw.append((.warmup, warmup, nil, nil))
  }

  for c in 0..<circuits {
    for iv in intervals {
      raw.append((iv.type, iv.dur, iv.activityLabel, c + 1))
    }
    if c + 1 < circuits && circuitRest > 0 {
      raw.append((.circuitRest, circuitRest, nil, nil))
    }
  }

  if cooldown > 0 {
    raw.append((.cooldown, cooldown, nil, nil))
  }

  var cursor: Double = 0
  return raw.enumerated().map { i, s in
    var seg = Segment(phase: s.phase, duration: s.duration, startAt: cursor, endAt: cursor + s.duration, index: i)
    seg.activityLabel = s.activityLabel
    seg.circuitNumber = s.circuitNumber
    cursor += s.duration
    return seg
  }
}
```

Replace:

```swift
func segmentsForSession(_ session: SessionDTO) -> [Segment] {
  let base: [Segment]
  if session.mode == "advanced" {
    base = intervalsToSegments(session.intervals ?? [])
  } else {
    base = expandWorkout(session.config ?? WorkoutConfig(warmup: 0, high: 0, low: 0, rounds: 0, cooldown: 0))
  }
```

with:

```swift
func segmentsForSession(_ session: SessionDTO) -> [Segment] {
  if session.mode == "circuit" {
    return expandCircuit(
      session.intervals ?? [],
      circuits: session.circuits ?? 0,
      warmup: session.warmup ?? 0,
      cooldown: session.cooldown ?? 0,
      circuitRest: session.circuitRest ?? 0
    )
  }

  let base: [Segment]
  if session.mode == "advanced" {
    base = intervalsToSegments(session.intervals ?? [])
  } else {
    base = expandWorkout(session.config ?? WorkoutConfig(warmup: 0, high: 0, low: 0, rounds: 0, cooldown: 0))
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/SegmentBuilderTests -only-testing:ClearHiiTTests/SessionDecodingTests 2>&1 | tail -50`
Expected: `** TEST SUCEEDED **`, all tests passing (8 in `SegmentBuilderTests`, 9 in `SessionDecodingTests`).

- [ ] **Step 5: Commit**

```bash
git add ios/Shared/WorkoutModels.swift ios/Shared/SegmentBuilder.swift ios/ClearHiiTTests/SegmentBuilderTests.swift ios/ClearHiiTTests/SessionDecodingTests.swift
git commit -m "feat: decode and expand Circuit sessions on the watch"
```

---

### Task 2: Circuit-specific run UI — exercise name, circuit progress, and the up-next list

**Files:**
- Modify: `ios/Shared/SegmentBuilder.swift`
- Modify: `ios/ClearHiiTTests/SegmentBuilderTests.swift`
- Modify: `ios/ClearHiiTWatch Watch App/SessionRunView.swift`

**Interfaces:**
- Consumes: `Segment.activityLabel`/`circuitNumber` (Task 1), `SessionDTO.circuits` (Task 1), `TimerState.currentIndex` (`ios/Shared/WorkoutTimerEngine.swift:8`, already exists).
- Produces: `func upNextExercises(_ segments: [Segment], currentIndex: Int) -> [String]`.

- [ ] **Step 1: Write the failing tests**

In `ios/ClearHiiTTests/SegmentBuilderTests.swift`, add the following test methods inside the `SegmentBuilderTests` class, after `test_expandCircuit_carriesActivityLabelOntoEachSegment`:

```swift

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/SegmentBuilderTests 2>&1 | tail -30`
Expected: FAIL to build — `cannot find 'upNextExercises' in scope`.

- [ ] **Step 3: Write the implementation**

In `ios/Shared/SegmentBuilder.swift`, replace:

```swift
/// `blobs` is expected newest-first (see WorkoutStore.fetchRunnableSessions' sort
```

with:

```swift
/// Exercises still to come in the wearer's current circuit round, in display
/// order — backs the Crown-scrollable "up next" list on SessionRunView. Empty
/// once the last exercise of the round is reached, or for non-circuit segments.
func upNextExercises(_ segments: [Segment], currentIndex: Int) -> [String] {
  guard let current = segments.first(where: { $0.index == currentIndex }),
        let circuitNumber = current.circuitNumber else { return [] }
  return segments
    .filter { $0.circuitNumber == circuitNumber && $0.index > currentIndex }
    .compactMap(\.activityLabel)
}

/// `blobs` is expected newest-first (see WorkoutStore.fetchRunnableSessions' sort
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/SegmentBuilderTests 2>&1 | tail -30`
Expected: `** TEST SUCCEEDED **`, all 11 tests in `SegmentBuilderTests` passing.

- [ ] **Step 5: Wire circuit display into `SessionRunView`**

In `ios/ClearHiiTWatch Watch App/SessionRunView.swift`, replace:

```swift
  private func runningView(state: TimerState, segment: Segment?) -> some View {
    VStack(spacing: 8) {
      Text(segment.map { phaseWord[$0.phase] ?? "" } ?? "")
        .font(.headline)
        .foregroundStyle(segment.flatMap { phaseColor[$0.phase] } ?? .primary)

      if session.isTreadmill, let speed = segment?.speed {
```

with:

```swift
  private func runningView(state: TimerState, segment: Segment?) -> some View {
    VStack(spacing: 8) {
      Text(segment?.activityLabel ?? segment.map { phaseWord[$0.phase] ?? "" } ?? "")
        .font(.headline)
        .foregroundStyle(segment.flatMap { phaseColor[$0.phase] } ?? .primary)

      if session.isTreadmill, let speed = segment?.speed {
```

Then, still in `runningView`, replace:

```swift
      } else {
        Text(fmtTimer(state.remainingInSegment))
          .font(.system(size: 46, weight: .bold, design: .rounded))
          .monospacedDigit()
      }

      HStack {
        Button(state.status == .running ? "Pause" : "Resume") {
```

with:

```swift
      } else {
        Text(fmtTimer(state.remainingInSegment))
          .font(.system(size: 46, weight: .bold, design: .rounded))
          .monospacedDigit()
      }

      if session.mode == "circuit", let circuitNumber = segment?.circuitNumber {
        Text("Circuit \(circuitNumber) / \(session.circuits ?? circuitNumber)")
          .font(.caption2)
          .foregroundStyle(.secondary)
      }

      if session.mode == "circuit" {
        let upNext = upNextExercises(engineHolder.segments, currentIndex: state.currentIndex)
        if !upNext.isEmpty {
          ScrollView {
            VStack(alignment: .leading, spacing: 2) {
              ForEach(upNext, id: \.self) { name in
                Text(name)
                  .font(.caption2)
                  .foregroundStyle(.secondary)
              }
            }
          }
          .frame(maxHeight: 50)
        }
      }

      HStack {
        Button(state.status == .running ? "Pause" : "Resume") {
```

Finally, expose `segments` on `EngineHolder` — replace:

```swift
private final class EngineHolder: ObservableObject {
  let engine: WorkoutTimerEngine
  @Published private(set) var currentSegment: Segment?
  let congratsMessage: String = congratsMessages.randomElement() ?? ""
  private var cancellable: AnyCancellable?
  private let workoutSession: WorkoutSessionCoordinator

  init(session: SessionDTO, segments: [Segment]) {
    let engine = WorkoutTimerEngine(segments: segments)
    self.engine = engine
    self.currentSegment = segments.first
```

with:

```swift
private final class EngineHolder: ObservableObject {
  let engine: WorkoutTimerEngine
  let segments: [Segment]
  @Published private(set) var currentSegment: Segment?
  let congratsMessage: String = congratsMessages.randomElement() ?? ""
  private var cancellable: AnyCancellable?
  private let workoutSession: WorkoutSessionCoordinator

  init(session: SessionDTO, segments: [Segment]) {
    let engine = WorkoutTimerEngine(segments: segments)
    self.engine = engine
    self.segments = segments
    self.currentSegment = segments.first
```

- [ ] **Step 6: Build the watch scheme to verify it compiles**

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination "platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)" 2>&1 | tail -30`
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 7: Run the full test suite to confirm no regressions**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests 2>&1 | tail -30`
Expected: `** TEST SUCCEEDED **`, all tests passing (46/46 — 37 existing + 2 from Task 1's `SessionDecodingTests` net additions + 4 from Task 1's `expandCircuit` tests + 3 from this task's `upNextExercises` tests).

- [ ] **Step 8 (manual, human only): Visually verify on a real watch or simulator**

This sandbox has no way to interact with a watch simulator (no macOS Accessibility permission), so a human needs to confirm the layout actually looks right at watch scale:

1. Build and run `ClearHiiTWatch Watch App` on the watch simulator or a paired physical watch, and sync a Circuit session from the phone (e.g. the "default-circuit-1" seed session: Push-ups/Squats/Plank, 3 circuits).
2. Open it from `SessionListView` and start it. Confirm the exercise name ("Push-ups") shows where the phase word normally would, "Circuit 1 / 3" shows below the timer, and the up-next list shows "Squats" then blanks out once on the last exercise of the round.
3. Confirm the up-next list is empty during warmup, circuitRest, and cooldown segments (no activityLabel/circuitNumber to show).
4. Confirm haptics still fire correctly on phase transitions (`HapticsController` already handles `.circuitRest` — unchanged by this plan).
5. Confirm the session still saves to Health on completion (unaffected by this plan, but worth a spot check since `hkActivityType` now applies to a previously-unreachable code path for circuit sessions).

- [ ] **Step 9: Commit**

```bash
git add ios/Shared/SegmentBuilder.swift ios/ClearHiiTTests/SegmentBuilderTests.swift "ios/ClearHiiTWatch Watch App/SessionRunView.swift"
git commit -m "feat: show circuit exercise name, progress, and up-next list on the watch"
```
