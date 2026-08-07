# Watch Heart Rate & Calories Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show live heart rate (bpm) and accumulated active energy (kcal) on the watch's running-session screen, sourced from the `HKWorkoutSession`/`HKLiveWorkoutBuilder` already recording every session.

**Architecture:** `HealthKitWorkoutManager` already requests read authorization for `.heartRate` and `.activeEnergyBurned` and already has an `HKLiveWorkoutDataSource` silently collecting both throughout every session — that data just isn't read back out anywhere yet. This plan adds: (1) a small `WorkoutLiveStats` value type and a pure merge helper, threaded through `WorkoutSessionRecording`/`WorkoutSessionCoordinator` as a new `onStatsUpdate` callback (mirroring the existing `onTransition`/`onFinish`/`onStatusChange` closure pattern already used by `WorkoutTimerEngine`); (2) `HealthKitWorkoutManager` adopting `HKLiveWorkoutBuilderDelegate` to receive live samples and emit merged stats through that callback; (3) `SessionRunView`'s `EngineHolder` subscribing and a compact heart-rate/calorie row added to the existing "timer" page of the running view.

**Tech Stack:** Swift, SwiftUI, HealthKit (`HKLiveWorkoutBuilderDelegate`, `HKQuantityType`, `HKUnit`), XCTest.

## Global Constraints

- Deployment target is watchOS 10.0 (`ios/ClearHiiT.xcodeproj/project.pbxproj`) — every HealthKit API used here (`HKLiveWorkoutBuilderDelegate`, `HKQuantityType`, `HKUnit`) has been available since watchOS 2, so no `#available` guards are needed.
- No new files are created by this plan — every task modifies an existing file already registered in the relevant Xcode targets, so no `project.pbxproj` edits are required.
- Heart rate and calories are shown **only** in the normal (non-Always-On-Display) running view, as a compact row on the existing "timer" `TabView` page — per an explicit product decision, the Always-On Display view (`alwaysOnView` in `SessionRunView.swift`, added by the prior always-on-display plan) is **not** touched by this plan and keeps showing only the interval name and countdown.
- `HealthKitWorkoutManager` wraps HealthKit APIs that can't be meaningfully unit tested (per its own existing doc comment: "verified manually on a paired watch"). This plan keeps that precedent — no new automated tests are added directly to that class. Instead, the one piece of genuinely testable logic (merging partial HealthKit updates into a running stats snapshot) is extracted into a free function (`mergingLiveStats`) that Task 1 covers with real unit tests.
- Heart rate requires a real, worn Apple Watch — it does not work in the Simulator or on an unworn watch. Task 4 (manual verification) must run on a physical device on-wrist.

---

### Task 1: WorkoutLiveStats model, merge helper, and coordinator pass-through

**Files:**
- Modify: `ios/Shared/WorkoutSessionRecording.swift`
- Test: `ios/ClearHiiTTests/WorkoutSessionCoordinatorTests.swift`

**Interfaces:**
- Produces: `WorkoutLiveStats` (`Equatable` struct: `heartRate: Double?`, `activeEnergy: Double?`); `mergingLiveStats(_:heartRate:activeEnergy:) -> WorkoutLiveStats`; `WorkoutSessionRecording.onStatsUpdate: ((WorkoutLiveStats) -> Void)? { get set }`; `WorkoutSessionCoordinator.onStatsUpdate` (computed pass-through). Task 2 consumes `WorkoutLiveStats` and `mergingLiveStats`. Task 3 consumes `WorkoutSessionCoordinator.onStatsUpdate`.

- [ ] **Step 1: Write the failing tests**

Add to `ios/ClearHiiTTests/WorkoutSessionCoordinatorTests.swift`. First, add the new stored property to `FakeRecorder` (inside its existing body, alongside `endCalls`):

```swift
    var endCalls: [Bool] = []
    var onStatsUpdate: ((WorkoutLiveStats) -> Void)?
```

Then add these tests at the end of the `WorkoutSessionCoordinatorTests` class body (after `test_wiredToEngine_tickPastTotalDuration_endsWithSaveTrue`):

```swift
  func test_onStatsUpdate_forwardsToRecorder() {
    let recorder = FakeRecorder()
    let coordinator = WorkoutSessionCoordinator(recorder: recorder, activityType: .running)
    var received: WorkoutLiveStats?
    coordinator.onStatsUpdate = { received = $0 }
    recorder.onStatsUpdate?(WorkoutLiveStats(heartRate: 140, activeEnergy: 55))
    XCTAssertEqual(received, WorkoutLiveStats(heartRate: 140, activeEnergy: 55))
  }

  func test_mergingLiveStats_updatesOnlyProvidedFields() {
    let current = WorkoutLiveStats(heartRate: 120, activeEnergy: 30)
    let merged = mergingLiveStats(current, heartRate: nil, activeEnergy: 45)
    XCTAssertEqual(merged, WorkoutLiveStats(heartRate: 120, activeEnergy: 45))
  }

  func test_mergingLiveStats_bothNil_keepsCurrentUnchanged() {
    let current = WorkoutLiveStats(heartRate: 120, activeEnergy: 30)
    let merged = mergingLiveStats(current, heartRate: nil, activeEnergy: nil)
    XCTAssertEqual(merged, current)
  }

  func test_mergingLiveStats_fromEmptyState_setsBothProvidedFields() {
    let merged = mergingLiveStats(WorkoutLiveStats(), heartRate: 150, activeEnergy: 60)
    XCTAssertEqual(merged, WorkoutLiveStats(heartRate: 150, activeEnergy: 60))
  }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `xcodebuild test -workspace ios/ClearHiiT.xcworkspace -scheme "ClearHiiT" -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/WorkoutSessionCoordinatorTests`

Expected: FAIL to compile — `WorkoutLiveStats` and `mergingLiveStats` don't exist yet, and `FakeRecorder` doesn't satisfy the (not-yet-updated) `WorkoutSessionRecording` protocol's new requirement.

- [ ] **Step 3: Implement the model, helper, protocol change, and coordinator pass-through**

In `ios/Shared/WorkoutSessionRecording.swift`, add the struct and helper near the top (after the `import HealthKit`, before the `protocol WorkoutSessionRecording` declaration):

```swift
struct WorkoutLiveStats: Equatable {
  var heartRate: Double?
  var activeEnergy: Double?
}

/// Folds newly-collected values into the previous reading, leaving fields
/// HealthKit didn't report in this callback untouched — HKLiveWorkoutBuilder
/// only reports the sample types that changed on any given callback, not a
/// full snapshot every time.
func mergingLiveStats(_ current: WorkoutLiveStats, heartRate: Double?, activeEnergy: Double?) -> WorkoutLiveStats {
  var result = current
  if let heartRate { result.heartRate = heartRate }
  if let activeEnergy { result.activeEnergy = activeEnergy }
  return result
}
```

Change the protocol declaration to require `AnyObject` (needed so `WorkoutSessionCoordinator` can assign through its `let recorder: WorkoutSessionRecording` existential — without this constraint the compiler must assume a conforming type could be a value type, which would make property assignment through a `let`-held existential a compile error) and add the new requirement:

```swift
protocol WorkoutSessionRecording: AnyObject {
  var onStatsUpdate: ((WorkoutLiveStats) -> Void)? { get set }
  func requestAuthorization(_ completion: @escaping (Bool) -> Void)
  func start(activityType: HKWorkoutActivityType)
  func pause()
  func resume()
  func end(save: Bool)
}
```

Add the pass-through computed property to `WorkoutSessionCoordinator` (after `requestAuthorization(_:)`):

```swift
  var onStatsUpdate: ((WorkoutLiveStats) -> Void)? {
    get { recorder.onStatsUpdate }
    set { recorder.onStatsUpdate = newValue }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `xcodebuild test -workspace ios/ClearHiiT.xcworkspace -scheme "ClearHiiT" -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/WorkoutSessionCoordinatorTests`

Expected: PASS, all tests in the file (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add ios/Shared/WorkoutSessionRecording.swift ios/ClearHiiTTests/WorkoutSessionCoordinatorTests.swift
git commit -m "feat: add WorkoutLiveStats and a live-stats pass-through to WorkoutSessionCoordinator"
```

---

### Task 2: Collect live heart rate and calories in HealthKitWorkoutManager

**Files:**
- Modify: `ios/ClearHiiTWatch Watch App/HealthKitWorkoutManager.swift`

**Interfaces:**
- Consumes: `WorkoutLiveStats`, `mergingLiveStats` (from Task 1).
- Produces: `HealthKitWorkoutManager.onStatsUpdate` (satisfies the `WorkoutSessionRecording` requirement from Task 1) — emits merged stats on the main thread whenever HealthKit reports new heart rate or active energy samples. Task 3 consumes this indirectly via `WorkoutSessionCoordinator.onStatsUpdate`.

**Note on testing:** Per this file's existing doc comment, it wraps HealthKit APIs that can't be meaningfully unit tested and is verified manually. This task adds no new automated tests — the stats-merging logic it calls into (`mergingLiveStats`) is already covered by Task 1's tests. Verify with a build only; Task 4 covers the real on-device behavior.

- [ ] **Step 1: Adopt `HKLiveWorkoutBuilderDelegate` and wire live stats collection**

Replace the full contents of `ios/ClearHiiTWatch Watch App/HealthKitWorkoutManager.swift` with:

```swift
// ios/ClearHiiTWatch Watch App/HealthKitWorkoutManager.swift
import HealthKit

/// Live-session recorder used on-device. See WorkoutSessionCoordinatorTests
/// (ios/Shared/WorkoutSessionRecording.swift) for the tested start/pause/
/// resume/end call sequencing — this class wraps the untestable HealthKit
/// APIs themselves and is verified manually on a paired watch.
final class HealthKitWorkoutManager: NSObject, WorkoutSessionRecording, HKLiveWorkoutBuilderDelegate {
  static let isAvailable = HKHealthStore.isHealthDataAvailable()

  private let healthStore = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  private var latestStats = WorkoutLiveStats()
  var onStatsUpdate: ((WorkoutLiveStats) -> Void)?

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
    builder.delegate = self
    self.session = session
    self.builder = builder
    self.latestStats = WorkoutLiveStats()
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

  // MARK: - HKLiveWorkoutBuilderDelegate

  func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
    var heartRate: Double?
    var activeEnergy: Double?
    for type in collectedTypes {
      guard let quantityType = type as? HKQuantityType,
            let statistics = workoutBuilder.statistics(for: quantityType) else { continue }
      switch quantityType.identifier {
      case HKQuantityTypeIdentifier.heartRate.rawValue:
        heartRate = statistics.mostRecentQuantity()?.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
      case HKQuantityTypeIdentifier.activeEnergyBurned.rawValue:
        activeEnergy = statistics.sumQuantity()?.doubleValue(for: .kilocalorie())
      default:
        break
      }
    }
    latestStats = mergingLiveStats(latestStats, heartRate: heartRate, activeEnergy: activeEnergy)
    let stats = latestStats
    DispatchQueue.main.async { [weak self] in self?.onStatsUpdate?(stats) }
  }

  func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
}
```

Notes on the changes from the current file: `NSObject` is added as a superclass (`HKLiveWorkoutBuilderDelegate` extends `NSObjectProtocol`, which a plain Swift class can't satisfy without inheriting `NSObject`); `builder.delegate = self` is added in `start(activityType:)`; `latestStats` resets to empty at the start of every new session; and the two `HKLiveWorkoutBuilderDelegate` methods are added at the bottom. Everything else (`requestAuthorization`, `pause`, `resume`, `end`) is unchanged.

- [ ] **Step 2: Verify the watch target builds**

Run: `xcodebuild build -workspace ios/ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination 'platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)'`

Expected: `BUILD SUCCEEDED`.

- [ ] **Step 3: Run the full test suite to confirm no regression**

Run: `xcodebuild test -workspace ios/ClearHiiT.xcworkspace -scheme "ClearHiiT" -destination 'platform=iOS Simulator,name=iPhone 17'`

Expected: all tests pass (this task adds no new test-covered logic of its own, but confirms nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add "ios/ClearHiiTWatch Watch App/HealthKitWorkoutManager.swift"
git commit -m "feat: collect live heart rate and active energy via HKLiveWorkoutBuilderDelegate"
```

---

### Task 3: Show heart rate and calories on the watch's running view

**Files:**
- Modify: `ios/ClearHiiTWatch Watch App/SessionRunView.swift`

**Interfaces:**
- Consumes: `WorkoutSessionCoordinator.onStatsUpdate` (from Task 1), populated by `HealthKitWorkoutManager` (from Task 2).

**Note on testing:** Pure SwiftUI view composition and a closure-wiring change in `EngineHolder.init` — no snapshot/ViewInspector infrastructure exists in this project (same situation as the prior always-on-display plan's Task 2). Verify with a build; Task 4 covers the real on-device appearance.

- [ ] **Step 1: Publish live stats from EngineHolder**

In `ios/ClearHiiTWatch Watch App/SessionRunView.swift`, add a published property to `EngineHolder` (after `@Published private(set) var currentSegment: Segment?`):

```swift
  @Published private(set) var currentSegment: Segment?
  @Published private(set) var liveStats = WorkoutLiveStats()
```

In `EngineHolder.init`, right after `workoutSession.requestAuthorization { _ in }`, add:

```swift
    workoutSession.requestAuthorization { _ in }
    workoutSession.onStatsUpdate = { [weak self] stats in
      self?.liveStats = stats
    }
```

- [ ] **Step 2: Add the heart rate / calories row to the timer page**

In `runningView`'s timer-page `VStack` (tagged `.tag(RunningPage.timer)`), insert this block right after the `if/else if/else` that renders the countdown (i.e., immediately after the closing brace of the `else { Text(fmtTimer(state.remainingInSegment))... }` block) and before the `if session.mode == "circuit", let circuitNumber = ...` block:

```swift
        if engineHolder.liveStats.heartRate != nil || engineHolder.liveStats.activeEnergy != nil {
          HStack(spacing: 12) {
            if let heartRate = engineHolder.liveStats.heartRate {
              HStack(spacing: 3) {
                Image(systemName: "heart.fill")
                  .foregroundStyle(.red)
                Text("\(Int(heartRate.rounded()))")
              }
            }
            if let activeEnergy = engineHolder.liveStats.activeEnergy {
              HStack(spacing: 3) {
                Image(systemName: "flame.fill")
                  .foregroundStyle(.orange)
                Text("\(Int(activeEnergy.rounded()))")
              }
            }
          }
          .font(.caption2)
          .foregroundStyle(.secondary)
        }
```

This row shows for every session mode (standard, treadmill, spin, circuit) and is omitted entirely until the first HealthKit reading arrives (both fields start `nil`). It is not added to `alwaysOnView`, per this plan's Global Constraints.

- [ ] **Step 3: Verify the watch target builds**

Run: `xcodebuild build -workspace ios/ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination 'platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)'`

Expected: `BUILD SUCCEEDED`.

- [ ] **Step 4: Run the full test suite to confirm no regression**

Run: `xcodebuild test -workspace ios/ClearHiiT.xcworkspace -scheme "ClearHiiT" -destination 'platform=iOS Simulator,name=iPhone 17'`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add "ios/ClearHiiTWatch Watch App/SessionRunView.swift"
git commit -m "feat: show live heart rate and calories on the watch running view"
```

---

### Task 4: Manual on-device verification (human-only)

Heart rate requires a real sensor reading from skin contact — this cannot be exercised in the Simulator or with Xcode's Environment Overrides. This step must run on a physical Apple Watch, worn on the wrist, with a real session.

- [ ] **Step 1:** Run the watch scheme on your physical Apple Watch via Xcode, worn on your wrist. Start any session.
- [ ] **Step 2:** Confirm the heart rate/calorie row is absent for the first few seconds (before HealthKit's first sample arrives), then appears with a heart icon + bpm and a flame icon + kcal.
- [ ] **Step 3:** Confirm the bpm value updates every several seconds as you move, and the kcal value only ever increases (cumulative), never decreases or resets mid-session.
- [ ] **Step 4:** Pause the session. Confirm the row keeps showing the last known values (frozen), doesn't disappear or crash.
- [ ] **Step 5:** Resume, then let the session run to completion. Confirm no crash on finish, and after finishing, open Health app / a fresh session and confirm the row resets to nothing until new readings arrive (i.e. `latestStats` doesn't leak across sessions).
- [ ] **Step 6:** Lower your wrist into Always-On Display during the session. Confirm the heart rate/calorie row does **not** appear in the AOD view (per this plan's scope decision) — only interval name and countdown, matching the prior plan's behavior.
- [ ] **Step 7:** Report pass/fail per step back to the controller; any failure needs a follow-up fix task before this plan is considered done.

## Notes

- Baseline before starting: confirm the full test suite is green (`xcodebuild test -workspace ios/ClearHiiT.xcworkspace -scheme "ClearHiiT" -destination 'platform=iOS Simulator,name=iPhone 17'`) so any new failure after this plan's tasks is attributable to it. Note: the `ClearHiiTWatch Watch App` scheme itself has no XCTest test action configured (pre-existing, confirmed during the always-on-display plan) — use the `ClearHiiT` (phone) scheme for all test runs on this branch; it includes every shared/watch-adjacent test target.
- This plan builds directly on top of the always-on-display plan (`docs/superpowers/plans/2026-07-30-watch-always-on-display.md`), already merged into this branch, and reuses its established pattern of a per-file testable-logic extraction plus a human-only manual verification task for what can't be automated.
