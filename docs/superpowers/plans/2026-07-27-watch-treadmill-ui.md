# Watch Treadmill UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Treadmill sessions on the watch show target speed as the dominant, large, center-screen element during a run, closing out the last remaining v1 mode from `docs/HIIT_Timer_watchOS_Feature_Architecture.md.docx` (section 2.3: "target speed shown large and center-screen per interval; this is arguably the mode watch helps most").

**Architecture:** `SessionRunView` (`ios/ClearHiiTWatch Watch App/SessionRunView.swift`) already receives per-segment `speed`/`incline` from `segmentsForSession` (`ios/Shared/SegmentBuilder.swift`) — the data layer is done. The only gap is visual: today speed renders as a small `.title3` line below the countdown timer, identical prominence for both modes. This plan adds a `SessionDTO.isTreadmill` flag and branches `SessionRunView`'s layout on it: Treadmill sessions get speed as the hero element (large, bold) with the countdown demoted below it; Standard sessions are untouched.

**Tech Stack:** Swift, SwiftUI, XCTest (`ClearHiiTTests` target).

## Global Constraints

- watchOS deployment target stays `10.0` (existing project setting — do not change).
- Touch only `ios/Shared/WorkoutModels.swift`, `ios/ClearHiiTWatch Watch App/SessionRunView.swift`, and `ios/ClearHiiTTests/SessionDecodingTests.swift`. No changes to Core Data, CloudKit, HealthKit, WatchConnectivity, or any other file.
- Match existing code style: 2-space indentation, no comments unless documenting a non-obvious constraint (see existing files for the bar).
- `xcodebuild test` destination on this machine is `platform=iOS Simulator,name=iPhone 17` — `iPhone 16` (used in older plan docs) is not installed here.
- Standard-mode sessions (`session.isTreadmill == false`) must render pixel-identical to today — this plan only changes the Treadmill branch.

---

### Task 1: Add `SessionDTO.isTreadmill`

**Files:**
- Modify: `ios/Shared/WorkoutModels.swift:47-65` (the `SessionDTO` struct)
- Test: `ios/ClearHiiTTests/SessionDecodingTests.swift`

**Interfaces:**
- Produces: `SessionDTO.isTreadmill: Bool` — `true` when `activityType == "run"`, mirroring the same convention `isRunnableInV1` already uses (`ios/Shared/WorkoutModels.swift:62-64`). Task 2 consumes this to branch `SessionRunView`'s layout.

- [ ] **Step 1: Write the failing test**

Append to `ios/ClearHiiTTests/SessionDecodingTests.swift` (inside the `SessionDecodingTests` class, after `test_isRunnableInV1_falseForCircuitAndWalkAndSpinning`):

```swift
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/SessionDecodingTests/test_isTreadmill_trueOnlyForRunActivityType 2>&1 | tail -30`
Expected: FAIL — `value of type 'SessionDTO' has no member 'isTreadmill'`.

- [ ] **Step 3: Write minimal implementation**

In `ios/Shared/WorkoutModels.swift`, add the property directly below `isRunnableInV1` (line 64):

```swift
  var isTreadmill: Bool {
    activityType == "run"
  }
```

So the full `SessionDTO` struct reads:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/SessionDecodingTests 2>&1 | tail -30`
Expected: `** TEST SUCCEEDED **`, all `SessionDecodingTests` passing (7/7 including the new one).

- [ ] **Step 5: Commit**

```bash
git add ios/Shared/WorkoutModels.swift ios/ClearHiiTTests/SessionDecodingTests.swift
git commit -m "feat: add SessionDTO.isTreadmill"
```

---

### Task 2: Make speed the hero element in `SessionRunView` for Treadmill sessions

**Files:**
- Modify: `ios/ClearHiiTWatch Watch App/SessionRunView.swift:14-51` (the `body` property)

**Interfaces:**
- Consumes: `SessionDTO.isTreadmill: Bool` (Task 1), `Segment.speed: Double?` / `Segment.incline: Double?` (`ios/Shared/WorkoutModels.swift:8-16`, unchanged), `fmtTimer(_:) -> String` (`ios/Shared/WorkoutModels.swift:77-85`, unchanged), `phaseWord: [Phase: String]` (`ios/Shared/WorkoutModels.swift:67-74`, unchanged).

- [ ] **Step 1: Replace the `body` property**

In `ios/ClearHiiTWatch Watch App/SessionRunView.swift`, replace the entire `body` property (lines 14-51) with:

```swift
  var body: some View {
    let state = engineHolder.engine.state
    let segment = engineHolder.currentSegment

    VStack(spacing: 8) {
      Text(segment.map { phaseWord[$0.phase] ?? "" } ?? "")
        .font(.headline)

      if session.isTreadmill, let speed = segment?.speed {
        Text(String(format: "%.1f", speed))
          .font(.system(size: 44, weight: .bold, design: .rounded))
          .monospacedDigit()
        Text("km/h")
          .font(.caption2)
          .foregroundStyle(.secondary)

        Text(fmtTimer(state.remainingInSegment))
          .font(.system(size: 22, weight: .semibold, design: .rounded))
          .monospacedDigit()

        if let incline = segment?.incline {
          Text(String(format: "%.0f%% incline", incline))
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
      } else {
        Text(fmtTimer(state.remainingInSegment))
          .font(.system(size: 40, weight: .bold, design: .rounded))
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
    }
    .padding()
    .navigationTitle(session.name)
  }
```

Note: the `else` branch is byte-for-byte what Standard sessions already render today (same font size 40, same weight/design/modifiers) — this satisfies the Global Constraint that Standard mode stays pixel-identical.

- [ ] **Step 2: Build the watch scheme to verify it compiles**

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination "platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)" 2>&1 | tail -30`
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 3: Run the full test suite to confirm no regressions**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests 2>&1 | tail -30`
Expected: `** TEST SUCCEEDED **`, all tests passing (21/21 — 20 existing + 1 new from Task 1).

- [ ] **Step 4 (manual, human only): Visually verify both modes on a real watch**

This project's default sessions (`getDefaultSessions()` in `src/lib/sessions.ts`) already include a Treadmill session (`default-run-2`, `activityType: 'run'`) and Standard sessions, so no new test data is needed. This sandbox has no way to interact with simulator/device UI (no macOS Accessibility permission), so this step needs a human:

1. Build and install the watch app to your paired physical Apple Watch (or watch simulator), same as the rest of this session: `xcodebuild build -workspace ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination "id=<watch-id>"` then `xcrun devicectl device install app --device <watch-id> "<built .app path>"`.
2. Open a Standard session on the watch — confirm it looks exactly as it did before this change (countdown as the only large number, no speed/km/h text).
3. Open the Treadmill session (`default-run-2`) — confirm the speed number is now the largest, boldest element on screen, with "km/h" beneath it, the countdown timer visibly smaller underneath, and incline (if present) as a small footnote at the bottom. Confirm nothing is clipped or overflows the screen on your watch's size.

- [ ] **Step 5: Commit**

```bash
git add "ios/ClearHiiTWatch Watch App/SessionRunView.swift"
git commit -m "feat: show treadmill speed as the hero element in SessionRunView"
```
