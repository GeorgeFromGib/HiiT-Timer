# Watch Always-On Display Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the wearer lowers their wrist during a running session (watchOS Always-On Display / `isLuminanceReduced`), the current interval name and a live, still-ticking countdown remain visible, and everything non-essential (controls page, up-next list, treadmill/spin secondary readouts) is hidden.

**Architecture:** `WorkoutTimerEngine` already ticks on a wall-clock basis (`accumulated`/`resumeEpoch`), but `SessionRunView` renders the countdown via `Text(fmtTimer(state.remainingInSegment))`, a plain `Text` bound to `@Published` state that only repaints when the app's own render cycle fires. In Always-On Display mode, watchOS throttles that render cycle to roughly once a minute, so a plain bound `Text` visibly freezes. The fix has two parts:
1. `WorkoutTimerEngine` starts publishing a `segmentEndDate: Date?` — the wall-clock instant the current segment ends, recomputed each tick while running, `nil` otherwise.
2. `SessionRunView` reads `@Environment(\.isLuminanceReduced)` and, when true, renders a minimal view using `Text(timerInterval:)` bound to `Date.now...segmentEndDate`. `Text(timerInterval:)` is drawn by the system's low-power text renderer and keeps counting down on its own even while the app's view body isn't re-evaluated — this is the standard watchOS technique for AOD-correct countdowns (the same mechanism already used for this app's Live Activity countdown, per the phone-side Dynamic Island work).

**Tech Stack:** Swift, SwiftUI, XCTest (existing `ClearHiiTTests` target).

## Global Constraints

- Deployment target is watchOS 10.0 (`ios/ClearHiiT.xcodeproj/project.pbxproj`) — `Text(timerInterval:)` and `Date.now` both require watchOS 9.0+/iOS 16+, so no `#available` guard is needed.
- No new files are created by this plan — every task modifies an existing file already registered in the relevant Xcode targets, so no `project.pbxproj` edits are required.
- Match the existing phase-color palette (`phaseColor` dict in `SessionRunView.swift`) for the normal (non-AOD) view; do not touch it. The AOD view intentionally uses `.primary`/`.secondary` instead of the vivid custom RGB colors, per Apple's Always-On Display guidance to avoid fixed saturated colors that don't dim gracefully — this is a deliberate scope decision for this plan, not an oversight.
- `SessionRunView`'s existing behavior for `.idle`, `.finished`, and countdown-before-start states is unchanged by this plan — Always-On Display only affects the `runningView` (running/paused) branch.

---

### Task 1: Expose a live segment end date from WorkoutTimerEngine

**Files:**
- Modify: `ios/Shared/WorkoutTimerEngine.swift`
- Test: `ios/ClearHiiTTests/WorkoutTimerEngineTests.swift`

**Interfaces:**
- Produces: `TimerState.segmentEndDate: Date?` — non-nil exactly when `status == .running`, equal to `now() + remainingInSegment` at the moment it was last computed. `nil` when idle, paused, or finished. Task 2 consumes this field directly.

- [ ] **Step 1: Write the failing tests**

Add these four tests to the end of `WorkoutTimerEngineTests.swift` (inside the `final class WorkoutTimerEngineTests: XCTestCase { ... }` body, after `test_start_atElapsed_pastTotalDuration_finishesImmediately`):

```swift
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `xcodebuild test -workspace ios/ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination 'platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)' -only-testing:ClearHiiTTests/WorkoutTimerEngineTests`

Expected: FAIL — `value of type 'TimerState' has no member 'segmentEndDate'` (compile error), since the field doesn't exist yet.

- [ ] **Step 3: Implement `segmentEndDate`**

In `ios/Shared/WorkoutTimerEngine.swift`, add the field to `TimerState`:

```swift
struct TimerState: Equatable {
  enum Status: Equatable { case idle, running, paused, finished }
  var status: Status = .idle
  var elapsed: Double = 0
  var currentIndex: Int = -1
  var remainingInSegment: Double = 0
  var remainingTotal: Double = 0
  var segmentEndDate: Date? = nil
}
```

In `pause()`, clear it explicitly (mirrors "paused = no live countdown, show the frozen `remainingInSegment` instead"):

```swift
  func pause() {
    guard state.status == .running else { return }
    accumulated = computeElapsed()
    state.status = .paused
    state.segmentEndDate = nil
    timer?.invalidate()
    timer = nil
    onStatusChange?(.paused)
  }
```

In `tick()`, set it to `nil` in the "finished" branch (alongside the other resets):

```swift
    guard let seg = segments.first(where: { elapsed >= $0.startAt && elapsed < $0.endAt }) else {
      if state.status != .finished {
        let prev = lastIndex >= 0 ? segments.first(where: { $0.index == lastIndex }) : nil
        state.status = .finished
        timer?.invalidate()
        timer = nil
        onTransition?(prev, nil)
        onStatusChange?(.finished)
        onFinish?()
      }
      state.elapsed = elapsed
      state.currentIndex = -1
      state.remainingInSegment = 0
      state.remainingTotal = 0
      state.segmentEndDate = nil
      lastIndex = -1
      return
    }
```

And compute it at the end of `tick()`'s main branch:

```swift
    state.elapsed = elapsed
    state.currentIndex = seg.index
    state.remainingInSegment = seg.endAt - elapsed
    state.remainingTotal = total - elapsed
    state.segmentEndDate = state.status == .running ? now().addingTimeInterval(state.remainingInSegment) : nil
  }
```

The `state.status == .running` guard is what keeps this correct even though `tick()` is never actually invoked while paused today (the driving `Timer` is invalidated on `pause()`) — it makes that invariant explicit in code rather than relying on call-site discipline.

- [ ] **Step 4: Run tests to verify they pass**

Run: `xcodebuild test -workspace ios/ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination 'platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)' -only-testing:ClearHiiTTests/WorkoutTimerEngineTests'`

Expected: PASS, all tests in the file (including the 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add ios/Shared/WorkoutTimerEngine.swift ios/ClearHiiTTests/WorkoutTimerEngineTests.swift
git commit -m "feat: publish a live segment end date from WorkoutTimerEngine"
```

---

### Task 2: Render a minimal Always-On Display view in SessionRunView

**Files:**
- Modify: `ios/ClearHiiTWatch Watch App/SessionRunView.swift`

**Interfaces:**
- Consumes: `TimerState.segmentEndDate: Date?` (from Task 1).

**Note on testing:** This task is pure SwiftUI view composition — the project has no snapshot/ViewInspector infrastructure to unit-test rendered output, so there is no automated test for this task. Instead, verify by (a) confirming the watch app target still builds clean, and (b) Task 3's manual on-device/simulator check, which is the only way to actually observe `isLuminanceReduced` rendering.

- [ ] **Step 1: Add the environment value and an Always-On rendering branch**

In `ios/ClearHiiTWatch Watch App/SessionRunView.swift`, add the environment property alongside the existing `@Environment(\.dismiss)`:

```swift
  @Environment(\.dismiss) private var dismiss
  @Environment(\.isLuminanceReduced) private var isLuminanceReduced
```

Replace the `runningView` function's body so it branches on `isLuminanceReduced` before reaching the existing `TabView`:

```swift
  private func runningView(state: TimerState, segment: Segment?) -> some View {
    func togglePause() {
      switch state.status {
      case .running: engineHolder.pause()
      case .paused: engineHolder.resume()
      case .idle, .finished: break
      }
    }

    if isLuminanceReduced {
      return AnyView(alwaysOnView(state: state, segment: segment))
    }

    return AnyView(TabView(selection: $runningPage) {
      HStack(spacing: 16) {
        Button(action: togglePause) {
          Image(systemName: state.status == .running ? "pause.fill" : "play.fill")
            .font(.title3)
            .foregroundStyle(controlGlyph)
            .frame(width: 50, height: 50)
            .background(controlAccent)
            .clipShape(Circle())
        }
        .buttonStyle(.plain)

        Button {
          engineHolder.engine.skip()
        } label: {
          Image(systemName: "forward.end.fill")
            .font(.title3)
            .foregroundStyle(controlSubText)
            .frame(width: 44, height: 44)
            .background(controlGhostBg)
            .clipShape(Circle())
            .overlay(Circle().stroke(controlHairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
      }
      .padding()
      .tag(RunningPage.controls)

      VStack(spacing: 8) {
        if state.status == .paused {
          Image(systemName: "pause.circle.fill")
            .font(.title3)
            .foregroundStyle(controlSubText)
        }

        Text(segment?.activityLabel ?? segment.map { phaseWord[$0.phase] ?? "" } ?? "")
          .font(.system(size: 22, weight: .bold, design: .rounded))
          .foregroundStyle(segment.flatMap { phaseColor[$0.phase] } ?? .primary)
          .multilineTextAlignment(.center)

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
        } else if session.isSpinning, let resistance = segment?.resistance, let power = segment?.power {
          Text(fmtTimer(state.remainingInSegment))
            .font(.system(size: 50, weight: .bold, design: .rounded))
            .monospacedDigit()

          HStack(alignment: .lastTextBaseline, spacing: 4) {
            Text("R\(Int(resistance))")
              .font(.system(size: 24, weight: .semibold, design: .rounded))
              .monospacedDigit()
            Text("·")
              .foregroundStyle(.secondary)
            Text("\(Int(power))W")
              .font(.system(size: 24, weight: .semibold, design: .rounded))
              .monospacedDigit()
          }
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
                ForEach(Array(upNext.enumerated()), id: \.offset) { index, name in
                  Text(index == 0 ? "Nxt: \(name)" : name)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                }
              }
            }
            .frame(maxHeight: 50)
          }
        }
      }
      .padding()
      .tag(RunningPage.timer)
    }
    .tabViewStyle(.page)
    .overlay {
      // Always present regardless of which page is showing, so Double Tap
      // pauses/resumes from either the controls or timer page.
      // handGestureShortcut requires watchOS 11 (deployment target is 10.0).
      if #available(watchOS 11.0, *) {
        Button(action: togglePause) { EmptyView() }
          .handGestureShortcut(.primaryAction)
          .opacity(0)
          .allowsHitTesting(false)
      }
    })
  }

  /// Always-On Display rendering: just the interval name and a countdown that
  /// keeps ticking on its own. `Text(timerInterval:)` is drawn by the system's
  /// low-power text renderer, so it stays accurate even though watchOS
  /// throttles this view's own re-render cycle to roughly once a minute while
  /// the wrist is lowered — a plain `Text(fmtTimer(...))` bound to
  /// `@Published` state would visibly freeze. Controls, the up-next list, and
  /// treadmill/spin metrics are omitted: none are interactive or essential
  /// while the wrist is down, per Apple's Always-On Display guidance to
  /// minimize what's drawn.
  private func alwaysOnView(state: TimerState, segment: Segment?) -> some View {
    VStack(spacing: 8) {
      Text(segment?.activityLabel ?? segment.map { phaseWord[$0.phase] ?? "" } ?? "")
        .font(.system(size: 20, weight: .semibold, design: .rounded))
        .foregroundStyle(.primary)
        .multilineTextAlignment(.center)

      if state.status == .running, let endDate = state.segmentEndDate {
        Text(timerInterval: Date.now...endDate, countsDown: true)
          .font(.system(size: 40, weight: .bold, design: .rounded))
          .foregroundStyle(.primary)
          .monospacedDigit()
      } else {
        Text(fmtTimer(state.remainingInSegment))
          .font(.system(size: 40, weight: .bold, design: .rounded))
          .foregroundStyle(.secondary)
          .monospacedDigit()
      }
    }
    .padding()
  }
```

This is a pure reformatting of the existing `runningView` body into an `if/return` plus one new `alwaysOnView` method — no other line changes. The `AnyView` wrap is required because the two branches (`alwaysOnView` vs. the existing `TabView`) are different concrete types.

- [ ] **Step 2: Verify the watch target builds**

Run: `xcodebuild build -workspace ios/ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination 'platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)'`

Expected: `BUILD SUCCEEDED`.

- [ ] **Step 3: Run the full watch test suite to confirm no regression**

Run: `xcodebuild test -workspace ios/ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination 'platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)'`

Expected: all existing tests still pass (this task touches no logic they cover, but confirms the build-for-test config is clean).

- [ ] **Step 4: Commit**

```bash
git add "ios/ClearHiiTWatch Watch App/SessionRunView.swift"
git commit -m "feat: render a minimal Always-On Display view during a running session"
```

---

### Task 3: Manual verification of Always-On Display rendering (human-only)

This step cannot be automated — it requires visually observing `isLuminanceReduced` rendering, which XCTest cannot do. Unlike the live-handoff plan's Task 7, this does **not** require a physical device: Xcode's Environment Overrides panel can force `isLuminanceReduced` on a running watchOS Simulator session.

- [ ] **Step 1:** Run the watch scheme on an Apple Watch Simulator (e.g. `Apple Watch Series 10 (46mm)`) from Xcode, and start a session (any mode) so it reaches the running/paused view.
- [ ] **Step 2:** In Xcode's debug bar (while the app is running), open **Environment Overrides** (the pane icon that looks like a monitor/circle, next to the debug console) and toggle **Luminance Reduced** on.
      - If this Simulator/Xcode version doesn't expose that toggle, fall back to a physical Apple Watch: start a session, then lower your wrist until the display dims to Always-On mode.
- [ ] **Step 3:** Confirm: the controls page and up-next/treadmill/spin extras disappear, leaving only the interval name and a countdown.
- [ ] **Step 4:** Confirm: with the override still on, wait at least 90 seconds without touching anything. Confirm the countdown value has visibly changed (not frozen) when you look again — this is the actual regression Task 1/2 fix.
- [ ] **Step 5:** Toggle Luminance Reduced off. Confirm the view returns to the normal running view (controls page swipeable, full color, up-next list back for circuit mode) with no visual glitch.
- [ ] **Step 6:** Pause the session, toggle Luminance Reduced on. Confirm the AOD view shows the frozen remaining time (not a countdown) and doesn't crash or show a blank value.
- [ ] **Step 7:** Report pass/fail per step back to the controller; any failure needs a follow-up fix task before this plan is considered done.

## Notes

- Baseline before starting: confirm `WorkoutTimerEngineTests` is green (`xcodebuild test -workspace ios/ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination 'platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)'`) so any new failure after Task 1/2 is attributable to this plan.
- This plan is the second half of the v3 split agreed earlier (live session handoff first, always-on display refinements second). The live-handoff plan (`docs/superpowers/plans/2026-07-30-watch-live-handoff.md`) is already merged into this branch.
