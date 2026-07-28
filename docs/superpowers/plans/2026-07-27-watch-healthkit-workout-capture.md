# Watch HealthKit Workout Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every watch session captures heart rate, calories, and workout metadata via `HKWorkoutSession` + `HKLiveWorkoutBuilder`, auto-saving to Health with no manual logging step — closing out `docs/HIIT_Timer_watchOS_Feature_Architecture.md.docx` section 2.2 ("Live workout session (HealthKit)") and the v1 phasing line in section 5.

**Architecture:** A pure, testable `WorkoutSessionCoordinator` (new, `ios/Shared/WorkoutSessionRecording.swift`) mirrors `WorkoutTimerEngine`'s status (`running`/`paused`/`finished`) onto a `WorkoutSessionRecording` protocol exactly once per transition. `EngineHolder` (`ios/ClearHiiTWatch Watch App/SessionRunView.swift`) owns a coordinator wired to a concrete `HealthKitWorkoutManager` (new, watch-only, wraps `HKHealthStore`/`HKWorkoutSession`/`HKLiveWorkoutBuilder`). This split mirrors the codebase's existing convention (`WorkoutTimerEngine` is pure/tested, `HapticsController` is watch-only/untested-by-XCTest) — HealthKit's actual session lifecycle can't be unit tested (no fake `HKHealthStore`, no simulator heart rate source), but the orchestration logic deciding *when* to call start/pause/resume/end is pure and fully covered by `WorkoutSessionCoordinatorTests`.

**Tech Stack:** Swift, SwiftUI, HealthKit, XCTest (`ClearHiiTTests` target).

## Global Constraints

- watchOS deployment target stays `10.0` (existing project setting — do not change).
- `xcodebuild test` destination on this machine is `platform=iOS Simulator,name=iPhone 17`; `xcodebuild build` for the watch scheme uses `platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)`.
- Match existing code style: 2-space indentation, no comments unless documenting a non-obvious constraint (see existing files for the bar).
- **Scope: watch-only.** The architecture doc says "HealthKit permissions requested on both targets," but nothing on the phone reads HealthKit data today (no stats/dashboard screen consumes it) — requesting phone-side permission now would be a prompt with no purpose. This plan only touches the Watch App target. Revisit phone-side HealthKit read access when a phone stats screen is built.
- No live heart-rate display in the UI this plan — that's the Spin-mode "target vs actual" feature (doc §2.3), and Spin isn't runnable on the watch in v1 (`SessionDTO.isRunnableInV1`). This plan only captures and saves data.
- No location/GPS — `HKWorkoutConfiguration.locationType = .indoor` always, since there's no outdoor-tracking feature in this app.
- `HKWorkoutSession`/`HKLiveWorkoutBuilder` cannot run in this sandbox (no paired watch, no macOS Accessibility permission for simulator interaction) and can't be meaningfully unit tested (no fake `HKHealthStore`). Tasks touching real HealthKit APIs get a build-verify step plus an explicit manual, human-only on-device verification step — same pattern already used in `docs/superpowers/plans/2026-07-27-watch-treadmill-ui.md`.
- The Apple Developer Portal App ID for `com.georgefromgib.hiittimer.watchkitapp` needs the HealthKit capability enabled before this works on a real device/watch — that's an account-level, human-only step outside this sandbox. Local Simulator builds do not require it.
- **Assumption (not specified in the architecture doc): sessions abandoned before `.finished` are discarded, not saved as partial workouts.** `discardIfUnfinished()` calls `end(save: false)` when the view disappears mid-run. If partial workouts should instead be saved (some fitness apps do this), that's a one-line change (`discardIfUnfinished()` → `finish(save: true)`) — flagging so this is a conscious choice, not a silent one.
- **Known gap, intentionally out of scope for v1: no crash/force-quit recovery.** If the watch app is force-quit or crashes mid-session, `HealthKitWorkoutManager.end()` never runs and the `HKWorkoutSession` is orphaned (HealthKit does not auto-save it). Recovering an orphaned session on relaunch would need `HKHealthStore.recoverActiveWorkoutSession`, which is a meaningfully bigger feature than "capture and save" — not added here per Simplicity First. Revisit if orphaned sessions turn out to be a real problem in practice.

---

### Task 1: Enable HealthKit capability on the Watch App target

**Files:**
- Modify: `ios/ClearHiiTWatch Watch App/ClearHiiTWatch Watch App.entitlements`
- Modify: `ios/ClearHiiTWatch Watch App/Info.plist`

**Interfaces:** None (declarative config only — no Swift symbols produced).

- [ ] **Step 1: Add the HealthKit entitlement**

In `ios/ClearHiiTWatch Watch App/ClearHiiTWatch Watch App.entitlements`, replace:

```xml
	<key>com.apple.developer.icloud-services</key>
	<array>
		<string>CloudKit</string>
	</array>
</dict>
```

with:

```xml
	<key>com.apple.developer.icloud-services</key>
	<array>
		<string>CloudKit</string>
	</array>
	<key>com.apple.developer.healthkit</key>
	<true/>
</dict>
```

- [ ] **Step 2: Add HealthKit usage description strings**

In `ios/ClearHiiTWatch Watch App/Info.plist`, replace:

```xml
    <key>WKCompanionAppBundleIdentifier</key>
    <string>com.georgefromgib.hiittimer</string>
  </dict>
```

with:

```xml
    <key>WKCompanionAppBundleIdentifier</key>
    <string>com.georgefromgib.hiittimer</string>
    <key>NSHealthShareUsageDescription</key>
    <string>ClearHiiT reads your heart rate during a workout to record it to Health.</string>
    <key>NSHealthUpdateUsageDescription</key>
    <string>ClearHiiT saves your completed workouts, heart rate, and calories to Health.</string>
  </dict>
```

- [ ] **Step 3: Build to verify the plists are still valid**

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination "platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)" 2>&1 | tail -30`
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 4: Commit**

```bash
git add "ios/ClearHiiTWatch Watch App/ClearHiiTWatch Watch App.entitlements" "ios/ClearHiiTWatch Watch App/Info.plist"
git commit -m "feat: enable HealthKit capability on the watch app target"
```

---

### Task 2: Add `WorkoutSessionCoordinator` — the pure start/pause/resume/end orchestration logic

**Files:**
- Create: `ios/Shared/WorkoutSessionRecording.swift`
- Create: `ios/ClearHiiTTests/WorkoutSessionCoordinatorTests.swift`
- Modify: `ios/ClearHiiT.xcodeproj/project.pbxproj` (register the new Shared file — `ios/Shared` is a manually-listed group, unlike `ios/ClearHiiTWatch Watch App` and `ios/ClearHiiTTests`, which are Xcode 16 file-system-synchronized groups that pick up new files automatically)

**Interfaces:**
- Consumes: `SessionDTO.isTreadmill: Bool` (`ios/Shared/WorkoutModels.swift:66-68`), `TimerState.Status` (`ios/Shared/WorkoutTimerEngine.swift:5`).
- Produces: `protocol WorkoutSessionRecording` with `requestAuthorization(_:)`, `start(activityType:)`, `pause()`, `resume()`, `end(save:)`; `func hkActivityType(for session: SessionDTO) -> HKWorkoutActivityType`; `final class WorkoutSessionCoordinator` with `init(recorder:activityType:)`, `requestAuthorization(_:)`, `handle(status: TimerState.Status)`, `discardIfUnfinished()`. Task 3 consumes the protocol; Task 4 consumes the coordinator and both functions.

- [ ] **Step 1: Write the failing tests**

Create `ios/ClearHiiTTests/WorkoutSessionCoordinatorTests.swift`:

```swift
import XCTest
import HealthKit

final class WorkoutSessionCoordinatorTests: XCTestCase {
  final class FakeRecorder: WorkoutSessionRecording {
    var authorizationRequested = false
    var startedActivityType: HKWorkoutActivityType?
    var pauseCount = 0
    var resumeCount = 0
    var endCalls: [Bool] = []

    func requestAuthorization(_ completion: @escaping (Bool) -> Void) {
      authorizationRequested = true
      completion(true)
    }
    func start(activityType: HKWorkoutActivityType) {
      startedActivityType = activityType
    }
    func pause() { pauseCount += 1 }
    func resume() { resumeCount += 1 }
    func end(save: Bool) { endCalls.append(save) }
  }

  func test_handleRunning_firstTime_startsWithGivenActivityType() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .running)
    XCTAssertEqual(recorder.startedActivityType, .running)
    XCTAssertEqual(recorder.resumeCount, 0)
  }

  func test_handleRunning_afterPause_callsResumeNotStartAgain() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .running)
    coordinator.handle(status: .paused)
    coordinator.handle(status: .running)
    XCTAssertEqual(recorder.resumeCount, 1)
  }

  func test_handlePaused_callsPauseOnce() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .running)
    coordinator.handle(status: .paused)
    XCTAssertEqual(recorder.pauseCount, 1)
  }

  func test_handlePaused_beforeStart_isNoOp() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .paused)
    XCTAssertEqual(recorder.pauseCount, 0)
  }

  func test_handleFinished_endsWithSaveTrue() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .running)
    coordinator.handle(status: .finished)
    XCTAssertEqual(recorder.endCalls, [true])
  }

  func test_handleFinished_isIdempotent_doesNotDoubleEnd() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .running)
    coordinator.handle(status: .finished)
    coordinator.handle(status: .finished)
    XCTAssertEqual(recorder.endCalls, [true])
  }

  func test_discardIfUnfinished_endsWithSaveFalse_whenStartedButNotFinished() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .running)
    coordinator.discardIfUnfinished()
    XCTAssertEqual(recorder.endCalls, [false])
  }

  func test_discardIfUnfinished_isNoOp_whenNeverStarted() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.discardIfUnfinished()
    XCTAssertTrue(recorder.endCalls.isEmpty)
  }

  func test_discardIfUnfinished_isNoOp_afterAlreadyFinished() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    coordinator.handle(status: .running)
    coordinator.handle(status: .finished)
    coordinator.discardIfUnfinished()
    XCTAssertEqual(recorder.endCalls, [true])
  }

  func test_requestAuthorization_forwardsToRecorder() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    var granted = false
    coordinator.requestAuthorization { granted = $0 }
    XCTAssertTrue(recorder.authorizationRequested)
    XCTAssertTrue(granted)
  }

  func test_hkActivityType_running_forTreadmillSession() {
    let session = SessionDTO(id: "1", name: "T", folderId: "f", activityType: "run",
                              runSpeeds: RunSpeeds(warmupSpeed: 3, workSpeed: 9, restSpeed: 4, cooldownSpeed: 3),
                              runInclines: nil, inclineEnabled: false,
                              mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                              intervals: nil)
    XCTAssertEqual(hkActivityType(for: session), .running)
  }

  func test_hkActivityType_hiit_forStandardSession() {
    let session = SessionDTO(id: "2", name: "S", folderId: "f", activityType: nil,
                              runSpeeds: nil, runInclines: nil, inclineEnabled: nil,
                              mode: "easy", config: WorkoutConfig(warmup: 0, high: 20, low: 10, rounds: 3, cooldown: 0),
                              intervals: nil)
    XCTAssertEqual(hkActivityType(for: session), .highIntensityIntervalTraining)
  }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/WorkoutSessionCoordinatorTests 2>&1 | tail -30`
Expected: FAIL — `cannot find type 'WorkoutSessionCoordinator' in scope` (or similar: the type doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `ios/Shared/WorkoutSessionRecording.swift`:

```swift
// ios/Shared/WorkoutSessionRecording.swift
import HealthKit

protocol WorkoutSessionRecording {
  func requestAuthorization(_ completion: @escaping (Bool) -> Void)
  func start(activityType: HKWorkoutActivityType)
  func pause()
  func resume()
  func end(save: Bool)
}

func hkActivityType(for session: SessionDTO) -> HKWorkoutActivityType {
  session.isTreadmill ? .running : .highIntensityIntervalTraining
}

/// Mirrors WorkoutTimerEngine's status onto a WorkoutSessionRecording exactly
/// once per transition, so callers can pass every status change through
/// `handle(status:)` without worrying about redundant HealthKit calls.
final class WorkoutSessionCoordinator {
  private let recorder: WorkoutSessionRecording
  private let activityType: HKWorkoutActivityType
  private var didStart = false
  private var didEnd = false

  init(recorder: WorkoutSessionRecording, activityType: HKWorkoutActivityType) {
    self.recorder = recorder
    self.activityType = activityType
  }

  func requestAuthorization(_ completion: @escaping (Bool) -> Void) {
    recorder.requestAuthorization(completion)
  }

  func handle(status: TimerState.Status) {
    switch status {
    case .idle:
      break
    case .running:
      guard !didEnd else { return }
      if didStart {
        recorder.resume()
      } else {
        didStart = true
        recorder.start(activityType: activityType)
      }
    case .paused:
      guard didStart, !didEnd else { return }
      recorder.pause()
    case .finished:
      finish(save: true)
    }
  }

  /// Call when the view disappears without reaching `.finished` (e.g. the
  /// user swipes back to the session list mid-run) so the in-progress
  /// HealthKit session is ended and discarded instead of left dangling.
  func discardIfUnfinished() {
    finish(save: false)
  }

  private func finish(save: Bool) {
    guard didStart, !didEnd else { return }
    didEnd = true
    recorder.end(save: save)
  }
}
```

- [ ] **Step 4: Register the new file in the Xcode project**

`ios/Shared` files must be members of all three targets (`ClearHiiT`, `ClearHiiTWatch Watch App`, `ClearHiiTTests`) — this matches how `WorkoutModels.swift` and `SegmentBuilder.swift` are already registered in `project.pbxproj`.

In `ios/ClearHiiT.xcodeproj/project.pbxproj`, replace:

```
		5E21ECFF301217A5003B942C /* WorkoutTimerEngine.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5E21ECFC301217A5003B942C /* WorkoutTimerEngine.swift */; };
```

with:

```
		5E21ECFF301217A5003B942C /* WorkoutTimerEngine.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5E21ECFC301217A5003B942C /* WorkoutTimerEngine.swift */; };
		7F78E029BE910236C0C63DC2 /* WorkoutSessionRecording.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */; };
		5930942B2A47F64F92DA8F87 /* WorkoutSessionRecording.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */; };
		5AAAF0DFFB85A1407BEF24A9 /* WorkoutSessionRecording.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */; };
```

Then, in the same file, replace:

```
		5E21ECFC301217A5003B942C /* WorkoutTimerEngine.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = WorkoutTimerEngine.swift; path = Shared/WorkoutTimerEngine.swift; sourceTree = "<group>"; };
```

with:

```
		5E21ECFC301217A5003B942C /* WorkoutTimerEngine.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = WorkoutTimerEngine.swift; path = Shared/WorkoutTimerEngine.swift; sourceTree = "<group>"; };
		5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = WorkoutSessionRecording.swift; path = Shared/WorkoutSessionRecording.swift; sourceTree = "<group>"; };
```

Then, still in the same file, replace (this is the `ClearHiiT` group's children list):

```
				5E21ECFC301217A5003B942C /* WorkoutTimerEngine.swift */,
				5E21ECD3301161A2003B942C /* WorkoutModels.swift */,
				5E21ECCE3011611D003B942C /* SegmentBuilder.swift */,
```

with:

```
				5E21ECFC301217A5003B942C /* WorkoutTimerEngine.swift */,
				5E21ECD3301161A2003B942C /* WorkoutModels.swift */,
				5E21ECCE3011611D003B942C /* SegmentBuilder.swift */,
				5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */,
```

Finally, add each new "in Sources" build-file ID to its target's `PBXSourcesBuildPhase`. Replace:

```
				5E21ECFE301217A5003B942C /* WorkoutTimerEngine.swift in Sources */,
				5E59C9B8300FD7F300C04775 /* WorkoutSyncModule.swift in Sources */,
				5E21ECD4301161A2003B942C /* WorkoutModels.swift in Sources */,
				5E21ECD03011611D003B942C /* SegmentBuilder.swift in Sources */,
```

with:

```
				5E21ECFE301217A5003B942C /* WorkoutTimerEngine.swift in Sources */,
				5E59C9B8300FD7F300C04775 /* WorkoutSyncModule.swift in Sources */,
				5E21ECD4301161A2003B942C /* WorkoutModels.swift in Sources */,
				5E21ECD03011611D003B942C /* SegmentBuilder.swift in Sources */,
				7F78E029BE910236C0C63DC2 /* WorkoutSessionRecording.swift in Sources */,
```

Replace:

```
				5E21ECFD301217A5003B942C /* WorkoutTimerEngine.swift in Sources */,
				5E21ECD6301161A2003B942C /* WorkoutModels.swift in Sources */,
				5E21ECD130116142003B942C /* SegmentBuilder.swift in Sources */,
```

with:

```
				5E21ECFD301217A5003B942C /* WorkoutTimerEngine.swift in Sources */,
				5E21ECD6301161A2003B942C /* WorkoutModels.swift in Sources */,
				5E21ECD130116142003B942C /* SegmentBuilder.swift in Sources */,
				5930942B2A47F64F92DA8F87 /* WorkoutSessionRecording.swift in Sources */,
```

Replace:

```
				5E21ECFF301217A5003B942C /* WorkoutTimerEngine.swift in Sources */,
				5E21ECD5301161A2003B942C /* WorkoutModels.swift in Sources */,
				5E21ECCF3011611D003B942C /* SegmentBuilder.swift in Sources */,
```

with:

```
				5E21ECFF301217A5003B942C /* WorkoutTimerEngine.swift in Sources */,
				5E21ECD5301161A2003B942C /* WorkoutModels.swift in Sources */,
				5E21ECCF3011611D003B942C /* SegmentBuilder.swift in Sources */,
				5AAAF0DFFB85A1407BEF24A9 /* WorkoutSessionRecording.swift in Sources */,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/WorkoutSessionCoordinatorTests 2>&1 | tail -40`
Expected: `** TEST SUCCEEDED **`, all 11 tests passing.

- [ ] **Step 6: Commit**

```bash
git add ios/Shared/WorkoutSessionRecording.swift ios/ClearHiiTTests/WorkoutSessionCoordinatorTests.swift ios/ClearHiiT.xcodeproj/project.pbxproj
git commit -m "feat: add WorkoutSessionCoordinator for HealthKit session orchestration"
```

---

### Task 3: Implement `HealthKitWorkoutManager` — the real HKWorkoutSession wrapper

**Files:**
- Create: `ios/ClearHiiTWatch Watch App/HealthKitWorkoutManager.swift`

**Interfaces:**
- Consumes: `WorkoutSessionRecording` (Task 2).
- Produces: `final class HealthKitWorkoutManager: WorkoutSessionRecording` with a no-arg `init()`. Task 4 consumes this as the concrete recorder passed to `WorkoutSessionCoordinator`.

This class can't be unit tested (no fake `HKHealthStore`, no simulator heart-rate source) — this task is build-verify only; correctness is confirmed manually in Task 4's on-device step.

- [ ] **Step 1: Write the implementation**

Create `ios/ClearHiiTWatch Watch App/HealthKitWorkoutManager.swift`:

```swift
// ios/ClearHiiTWatch Watch App/HealthKitWorkoutManager.swift
import HealthKit

/// Live-session recorder used on-device. See WorkoutSessionCoordinatorTests
/// (ios/Shared/WorkoutSessionRecording.swift) for the tested start/pause/
/// resume/end call sequencing — this class wraps the untestable HealthKit
/// APIs themselves and is verified manually on a paired watch.
final class HealthKitWorkoutManager: WorkoutSessionRecording {
  static let isAvailable = HKHealthStore.isHealthDataAvailable()

  private let healthStore = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?

  func requestAuthorization(_ completion: @escaping (Bool) -> Void) {
    guard Self.isAvailable,
          let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate),
          let energy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) else {
      completion(false)
      return
    }
    let toShare: Set<HKSampleType> = [HKObjectType.workoutType()]
    let toRead: Set<HKObjectType> = [heartRate, energy]
    healthStore.requestAuthorization(toShare: toShare, read: toRead) { success, _ in
      DispatchQueue.main.async { completion(success) }
    }
  }

  func start(activityType: HKWorkoutActivityType) {
    guard Self.isAvailable else { return }
    let config = HKWorkoutConfiguration()
    config.activityType = activityType
    config.locationType = .indoor
    guard let session = try? HKWorkoutSession(healthStore: healthStore, configuration: config) else { return }
    let builder = session.associatedWorkoutBuilder()
    builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)
    self.session = session
    self.builder = builder
    let startDate = Date()
    session.startActivity(with: startDate)
    builder.beginCollection(withStart: startDate) { _, _ in }
  }

  func pause() {
    session?.pause()
  }

  func resume() {
    session?.resume()
  }

  func end(save: Bool) {
    guard let session, let builder else { return }
    session.end()
    builder.endCollection(withEnd: Date()) { [weak self] _, _ in
      guard save else {
        self?.session = nil
        self?.builder = nil
        return
      }
      builder.finishWorkout { _, _ in
        self?.session = nil
        self?.builder = nil
      }
    }
  }
}
```

- [ ] **Step 2: Build to verify it compiles**

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination "platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)" 2>&1 | tail -30`
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 3: Commit**

```bash
git add "ios/ClearHiiTWatch Watch App/HealthKitWorkoutManager.swift"
git commit -m "feat: add HealthKitWorkoutManager wrapping HKWorkoutSession"
```

---

### Task 4: Wire the HealthKit session into `EngineHolder` and `SessionRunView`

**Files:**
- Modify: `ios/ClearHiiTWatch Watch App/SessionRunView.swift`

**Interfaces:**
- Consumes: `WorkoutSessionCoordinator`, `hkActivityType(for:)` (Task 2), `HealthKitWorkoutManager` (Task 3).

- [ ] **Step 1: Update `SessionRunView.init` to pass the session into `EngineHolder`**

Replace:

```swift
  init(session: SessionDTO) {
    self.session = session
    _engineHolder = StateObject(wrappedValue: EngineHolder(segments: segmentsForSession(session)))
  }
```

with:

```swift
  init(session: SessionDTO) {
    self.session = session
    _engineHolder = StateObject(wrappedValue: EngineHolder(session: session, segments: segmentsForSession(session)))
  }
```

- [ ] **Step 2: Route button actions through `EngineHolder`, and end/discard the HealthKit session when the view disappears**

Replace the entire `body` property:

```swift
  var body: some View {
    let state = engineHolder.engine.state
    let segment = engineHolder.currentSegment

    if state.status == .finished {
      SessionDoneView(congratsMessage: engineHolder.congratsMessage, onDone: { dismiss() })
    } else {
      VStack(spacing: 8) {
        Text(segment.map { phaseWord[$0.phase] ?? "" } ?? "")
          .font(.headline)
          .foregroundStyle(segment.flatMap { phaseColor[$0.phase] } ?? .primary)

        if session.isTreadmill, let speed = segment?.speed {
          Text(fmtTimer(state.remainingInSegment))
            .font(.system(size: 50, weight: .bold, design: .rounded))
            .monospacedDigit()

          HStack {
            HStack(alignment: .lastTextBaseline, spacing: 4) {
              Text(String(format: "%.1f", speed))
                .font(.system(size: 30, weight: .semibold, design: .rounded))
                .monospacedDigit()
              Text("km/h")
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
            if let incline = segment?.incline {
              Spacer()
              Text(String(format: "%.0f%% inc", incline))
                .font(.system(size: 20, weight: .medium, design: .rounded))
                .foregroundStyle(.secondary)
            }
          }
        } else {
          Text(fmtTimer(state.remainingInSegment))
            .font(.system(size: 46, weight: .bold, design: .rounded))
            .monospacedDigit()
        }

        HStack {
          Button(state.status == .running ? "Pause" : "Start") {
            switch state.status {
            case .idle: engineHolder.engine.start()
            case .running: engineHolder.engine.pause()
            case .paused: engineHolder.engine.resume()
            case .finished: break
            }
          }
          Button("Skip") { engineHolder.engine.skip() }
            .disabled(state.status == .idle || state.status == .finished)
        }
        .controlSize(.small)
      }
      .padding()
    }
  }
```

with:

```swift
  var body: some View {
    let state = engineHolder.engine.state
    let segment = engineHolder.currentSegment

    Group {
      if state.status == .finished {
        SessionDoneView(congratsMessage: engineHolder.congratsMessage, onDone: { dismiss() })
      } else {
        VStack(spacing: 8) {
          Text(segment.map { phaseWord[$0.phase] ?? "" } ?? "")
            .font(.headline)
            .foregroundStyle(segment.flatMap { phaseColor[$0.phase] } ?? .primary)

          if session.isTreadmill, let speed = segment?.speed {
            Text(fmtTimer(state.remainingInSegment))
              .font(.system(size: 50, weight: .bold, design: .rounded))
              .monospacedDigit()

            HStack {
              HStack(alignment: .lastTextBaseline, spacing: 4) {
                Text(String(format: "%.1f", speed))
                  .font(.system(size: 30, weight: .semibold, design: .rounded))
                  .monospacedDigit()
                Text("km/h")
                  .font(.caption2)
                  .foregroundStyle(.secondary)
              }
              if let incline = segment?.incline {
                Spacer()
                Text(String(format: "%.0f%% inc", incline))
                  .font(.system(size: 20, weight: .medium, design: .rounded))
                  .foregroundStyle(.secondary)
              }
            }
          } else {
            Text(fmtTimer(state.remainingInSegment))
              .font(.system(size: 46, weight: .bold, design: .rounded))
              .monospacedDigit()
          }

          HStack {
            Button(state.status == .running ? "Pause" : "Start") {
              switch state.status {
              case .idle: engineHolder.start()
              case .running: engineHolder.pause()
              case .paused: engineHolder.resume()
              case .finished: break
              }
            }
            Button("Skip") { engineHolder.engine.skip() }
              .disabled(state.status == .idle || state.status == .finished)
          }
          .controlSize(.small)
        }
        .padding()
      }
    }
    .onDisappear { engineHolder.discardIfUnfinished() }
  }
```

- [ ] **Step 3: Wire `EngineHolder` to the HealthKit coordinator**

Replace the entire `EngineHolder` class:

```swift
private final class EngineHolder: ObservableObject {
  let engine: WorkoutTimerEngine
  @Published private(set) var currentSegment: Segment?
  let congratsMessage: String = congratsMessages.randomElement() ?? ""
  private var cancellable: AnyCancellable?

  init(segments: [Segment]) {
    let engine = WorkoutTimerEngine(segments: segments)
    self.engine = engine
    self.currentSegment = segments.first
    engine.onTransition = { [weak self] _, to in
      self?.currentSegment = to
      if let phase = to?.phase {
        HapticsController.play(for: phase)
      }
    }
    engine.onFinish = { [weak self] in
      HapticsController.play(for: .finish)
    }
    cancellable = engine.objectWillChange.sink { [weak self] in
      self?.objectWillChange.send()
    }
  }
}
```

with:

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
    self.workoutSession = WorkoutSessionCoordinator(
      recorder: HealthKitWorkoutManager(),
      activityType: hkActivityType(for: session)
    )
    workoutSession.requestAuthorization { _ in }
    engine.onTransition = { [weak self] _, to in
      self?.currentSegment = to
      if let phase = to?.phase {
        HapticsController.play(for: phase)
      }
    }
    engine.onFinish = { [weak self] in
      HapticsController.play(for: .finish)
      self?.workoutSession.handle(status: .finished)
    }
    cancellable = engine.objectWillChange.sink { [weak self] in
      self?.objectWillChange.send()
    }
  }

  func start() {
    engine.start()
    workoutSession.handle(status: .running)
  }

  func pause() {
    engine.pause()
    workoutSession.handle(status: .paused)
  }

  func resume() {
    engine.resume()
    workoutSession.handle(status: .running)
  }

  func discardIfUnfinished() {
    workoutSession.discardIfUnfinished()
  }
}
```

- [ ] **Step 4: Build the watch scheme to verify it compiles**

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination "platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)" 2>&1 | tail -30`
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests 2>&1 | tail -30`
Expected: `** TEST SUCCEEDED **`, all tests passing (32/32 — 21 existing + 11 new from Task 2).

- [ ] **Step 6 (manual, human only): Verify real HealthKit capture on a paired watch**

This sandbox has no way to interact with a watch simulator or grant HealthKit permission dialogs (no macOS Accessibility permission), so this step needs a human with a paired Apple Watch and the Apple Developer Portal HealthKit capability already enabled for `com.georgefromgib.hiittimer.watchkitapp` (see Global Constraints):

1. Build and install the watch app to your paired physical Apple Watch: `xcodebuild build -workspace ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination "id=<watch-id>"` then `xcrun devicectl device install app --device <watch-id> "<built .app path>"`.
2. Open any session and tap Start. Confirm a system Health-permission sheet appears the first time (from `requestAuthorization` in `EngineHolder.init`); grant it.
3. Run a session to completion. Confirm in the iPhone Health app (Browse → Activity → Workouts) that a new workout appears with heart rate and active-energy samples for the session's duration, tagged as Running for a treadmill session or HIIT for a standard session.
4. Start a new session, let it run for ~10 seconds, then swipe back to the session list *without* finishing. Confirm no workout for that attempt appears in Health (the `onDisappear` → `discardIfUnfinished()` path should discard it).
5. Start a session, pause it, wait a few seconds, resume, then finish it. Confirm the saved workout's duration reflects only the running time (HealthKit excludes paused time automatically once `session.pause()`/`resume()` are called).

- [ ] **Step 7: Commit**

```bash
git add "ios/ClearHiiTWatch Watch App/SessionRunView.swift"
git commit -m "feat: capture watch sessions as HealthKit workouts"
```
