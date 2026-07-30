# Watch Live Session Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a session is running on the phone and the wearer opens the watch app, offer to resume that exact session — same segment, same time remaining — on the watch, per `docs/HIIT_Timer_watchOS_Feature_Architecture.md.docx` §3.1's "optional live handoff" and the v3 phasing line in §5.

**Architecture:** The phone broadcasts a small `{sessionId, name, elapsed, status, updatedAt}` snapshot via `WCSession.updateApplicationContext` every time its running/paused session's state changes meaningfully. `updateApplicationContext` (not `sendMessage`) is deliberately chosen — see Global Constraints. The watch reads that snapshot on activation via a `WCSessionDelegate` wrapper; if it's fresh and the wearer opens the app, `ContentView` offers a "Resume from iPhone?" prompt. Accepting fetches the session from the existing `WorkoutStore.shared.fetchSession(id:)` and presents `SessionRunView` with a new `resumeElapsed` parameter that seeds `WorkoutTimerEngine` directly at that wall-clock offset — skipping the 3-2-1 countdown, landing exactly where the phone was. `elapsed` (raw wall-clock seconds into the session) is broadcast rather than a segment index/remaining-time pair, because it's structure-agnostic: `WorkoutTimerEngine`'s own segment lookup (by `elapsed >= seg.startAt && elapsed < seg.endAt`) reconstructs the correct segment on the watch without either device needing to agree on segment indexing.

**Tech Stack:** WatchConnectivity (`WCSession`, `WCSessionDelegate`), Swift, SwiftUI, XCTest, React Native native module bridge (mirrors the existing `WorkoutSync` module), Jest/TypeScript.

## Global Constraints

- watchOS deployment target stays `10.0` (existing project setting — do not change).
- `xcodebuild test` destination on this machine is `platform=iOS Simulator,name=iPhone 17`; `xcodebuild build` for the watch scheme uses `platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)`; this plan also builds the phone scheme with `xcodebuild build -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17'` since it's the first watch-feature plan to touch the phone's native (Swift) layer.
- Match existing code style: 2-space indentation, no comments unless documenting a non-obvious constraint.
- **Deviation from the architecture doc's literal wording, flagged deliberately:** §3.1 names `WCSession`'s interactive `sendMessage` for live handoff. This plan uses `updateApplicationContext` instead. Reason: the trigger for this feature (per product decision) is "the wearer opens the watch app, possibly minutes after starting the phone session" — a *pull* on activation, not a live *push* to an already-open watch UI. `sendMessage` requires the receiving side to be reachable at send time and is dropped if not; `updateApplicationContext` is retained by WatchConnectivity and delivered on the next activation regardless of whether the watch was reachable when the phone updated it, which is exactly this feature's shape.
- **Phone → watch only, no reverse channel — accepted gap.** When the wearer resumes on the watch, the phone's own running session is untouched; it keeps ticking and keeps broadcasting its own state independently. Building a watch → phone "I took over, stop yourself" message would need a second WCSessionDelegate leg (watch sends, phone receives via an RN event emitter) and is out of scope for this plan. Per the architecture doc, this handoff is explicitly "optional," not the primary way sessions are expected to run, so the two clocks briefly diverging is an acceptable v3.0 limitation — revisit if it turns out to matter in practice.
- No new capability/entitlement is required. WatchConnectivity, unlike CloudKit, needs no App Group or container identifier — just `import WatchConnectivity` on both targets. HealthKit is used elsewhere in this codebase (`HealthKitWorkoutManager.swift`) via plain `import HealthKit` with no explicit `PBXFrameworksBuildPhase` entry; this plan assumes `WatchConnectivity` auto-links the same way. If a task's build step fails with an undefined-symbol/framework-not-found error, add an explicit `WatchConnectivity.framework` entry to the affected target's Frameworks phase before proceeding — flag it in the task's commit message if so.
- No i18n needed for the watch-side resume-prompt text — matches existing precedent (`SessionDoneView`, `congratsMessages` in `SessionRunView.swift` are English-only; the watch has no i18n system).
- `ios/Shared` and `ios/ClearHiiT` (the phone target's own directory) are **both** manually-listed `project.pbxproj` groups — confirmed by `WorkoutSyncModule.swift`/`.m` (which live in `ios/ClearHiiT/`) already being hand-registered there, the same way `ios/Shared/RecentSessionStore.swift` is. `ios/ClearHiiTWatch Watch App` and `ios/ClearHiiTTests` are Xcode 16 file-system-synchronized groups — new files placed directly inside those folders are picked up automatically, no `project.pbxproj` edit needed.
- Baseline test counts going into this plan (verified by running the suites before starting): **60 XCTests** (`ClearHiiTTests`, all passing) and **544 Jest tests** (36 suites, all passing).

---

### Task 1: `LiveSessionState` — decode the phone's broadcast, compute resume point, check staleness

**Files:**
- Create: `ios/Shared/LiveSessionState.swift`
- Create: `ios/ClearHiiTTests/LiveSessionStateTests.swift`
- Modify: `ios/ClearHiiT.xcodeproj/project.pbxproj` (register the new file into `ClearHiiTWatch Watch App` and `ClearHiiTTests` — never the phone `ClearHiiT` target, matching the `ios/Shared` scoping rule above)

**Interfaces:**
- Consumes: nothing.
- Produces: `LiveSessionState` (`sessionId: String`, `name: String`, `elapsed: Double`, `status: String`, `updatedAt: Date`, `Codable`, `Equatable`), `func liveSessionState(fromApplicationContext: [String: Any]) -> LiveSessionState?`, `func resumeElapsed(for: LiveSessionState, now: Date) -> Double`, `let liveSessionMaxAge: TimeInterval`, `func isLiveSessionFresh(_ state: LiveSessionState, now: Date) -> Bool`. Task 3's `WatchSessionReceiver`/`ContentView` consume all of these.

- [ ] **Step 1: Write the failing tests**

Create `ios/ClearHiiTTests/LiveSessionStateTests.swift`:

```swift
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/LiveSessionStateTests 2>&1 | tail -30`
Expected: build failure — `cannot find 'liveSessionState' in scope` (or similar; none of these symbols exist yet).

- [ ] **Step 3: Write `LiveSessionState.swift`**

Create `ios/Shared/LiveSessionState.swift`:

```swift
// ios/Shared/LiveSessionState.swift
import Foundation

/// Snapshot of the phone's currently-running session, broadcast via
/// WCSession's applicationContext so the watch can offer to resume it when
/// the wearer opens the watch app (architecture doc §3.1, "optional live
/// handoff"). `elapsed` is wall-clock seconds into the session as of
/// `updatedAt` — not a segment index/remaining-time pair — because raw
/// elapsed time is structure-agnostic: WorkoutTimerEngine's own segment
/// lookup reconstructs the right segment from it without either device
/// needing to agree on segment indexing.
struct LiveSessionState: Codable, Equatable {
  let sessionId: String
  let name: String
  let elapsed: Double
  let status: String // "running" or "paused"
  let updatedAt: Date
}

func liveSessionState(fromApplicationContext context: [String: Any]) -> LiveSessionState? {
  guard let sessionId = context["sessionId"] as? String,
        let name = context["name"] as? String,
        let elapsed = context["elapsed"] as? Double,
        let status = context["status"] as? String,
        let updatedAtTimestamp = context["updatedAt"] as? Double else { return nil }
  return LiveSessionState(
    sessionId: sessionId,
    name: name,
    elapsed: elapsed,
    status: status,
    updatedAt: Date(timeIntervalSince1970: updatedAtTimestamp)
  )
}

/// Where the watch should resume: the phone's last-reported elapsed time,
/// plus whatever wall-clock time has passed since if the phone was still
/// running (never trust a stored counter — recompute from wall clock, the
/// same rule WorkoutTimerEngine itself follows). A paused session hasn't
/// moved, so no gap is added.
func resumeElapsed(for state: LiveSessionState, now: Date) -> Double {
  guard state.status == "running" else { return state.elapsed }
  return state.elapsed + now.timeIntervalSince(state.updatedAt)
}

/// A resume offer older than this is treated as ended or abandoned (e.g.
/// the phone was killed before it could clear its broadcast) rather than
/// offered as a silent, possibly very stale, resume.
let liveSessionMaxAge: TimeInterval = 120

func isLiveSessionFresh(_ state: LiveSessionState, now: Date) -> Bool {
  now.timeIntervalSince(state.updatedAt) < liveSessionMaxAge
}
```

- [ ] **Step 4: Register the new file in the Xcode project**

In `ios/ClearHiiT.xcodeproj/project.pbxproj`, replace:

```
		5AAAF0DFFB85A1407BEF24A9 /* WorkoutSessionRecording.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */; };
```

with:

```
		5AAAF0DFFB85A1407BEF24A9 /* WorkoutSessionRecording.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */; };
		E1A2B3C4D5E64F708192A3B4 /* LiveSessionState.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7C6B5A4938271605F4E3D2C1 /* LiveSessionState.swift */; };
		F2B3C4D5E6F708192A3B4C5D /* LiveSessionState.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7C6B5A4938271605F4E3D2C1 /* LiveSessionState.swift */; };
```

Then replace:

```
		5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = WorkoutSessionRecording.swift; path = Shared/WorkoutSessionRecording.swift; sourceTree = "<group>"; };
```

with:

```
		5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = WorkoutSessionRecording.swift; path = Shared/WorkoutSessionRecording.swift; sourceTree = "<group>"; };
		7C6B5A4938271605F4E3D2C1 /* LiveSessionState.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = LiveSessionState.swift; path = Shared/LiveSessionState.swift; sourceTree = "<group>"; };
```

Then replace (the "ClearHiiT" group's children list):

```
				5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */,
```

with:

```
				5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */,
				7C6B5A4938271605F4E3D2C1 /* LiveSessionState.swift */,
```

Then replace (the `ClearHiiTTests` target's Sources build phase):

```
				4B8C5877C0DB4A20B13D6672 /* DeepLink.swift in Sources */,
```

with:

```
				4B8C5877C0DB4A20B13D6672 /* DeepLink.swift in Sources */,
				E1A2B3C4D5E64F708192A3B4 /* LiveSessionState.swift in Sources */,
```

Then replace (the `ClearHiiTWatch Watch App` target's Sources build phase):

```
				0ADE5215E96F488D9CCEB900 /* DeepLink.swift in Sources */,
```

with:

```
				0ADE5215E96F488D9CCEB900 /* DeepLink.swift in Sources */,
				F2B3C4D5E6F708192A3B4C5D /* LiveSessionState.swift in Sources */,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/LiveSessionStateTests 2>&1 | tail -30`
Expected: `** TEST SUCCEEDED **`, 7/7 tests passing.

- [ ] **Step 6: Commit**

```bash
git add ios/Shared/LiveSessionState.swift ios/ClearHiiTTests/LiveSessionStateTests.swift ios/ClearHiiT.xcodeproj/project.pbxproj
git commit -m "feat: add LiveSessionState decode/resume/staleness helpers for watch handoff"
```

---

### Task 2: `WorkoutTimerEngine.start(atElapsed:)` — resume mid-segment

**Files:**
- Modify: `ios/Shared/WorkoutTimerEngine.swift`
- Modify: `ios/ClearHiiTTests/WorkoutTimerEngineTests.swift`

**Interfaces:**
- Consumes: nothing new.
- Produces: `WorkoutTimerEngine.start(atElapsed: Double = 0)` — the default value means every existing zero-arg `engine.start()` call site keeps compiling unchanged. Task 3's `SessionRunView`/`EngineHolder` consume the new parameter.

- [ ] **Step 1: Write the failing tests**

In `ios/ClearHiiTTests/WorkoutTimerEngineTests.swift`, add the following test methods inside the `WorkoutTimerEngineTests` class, after `test_onTransition_firesOnceWithFromAndToSegments`:

```swift

  func test_start_atElapsed_resumesMidSegment() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    engine.start(atElapsed: 15) // 15s in, inside the "work" segment (index 1, 10...30)
    XCTAssertEqual(engine.state.status, .running)
    XCTAssertEqual(engine.state.currentIndex, 1)
    XCTAssertEqual(engine.state.elapsed, 15, accuracy: 0.001)
    XCTAssertEqual(engine.state.remainingInSegment, 15, accuracy: 0.001)
  }

  func test_start_atElapsed_pastTotalDuration_finishesImmediately() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    var finishCount = 0
    engine.onFinish = { finishCount += 1 }
    engine.start(atElapsed: 999)
    XCTAssertEqual(engine.state.status, .finished)
    XCTAssertEqual(finishCount, 1)
  }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/WorkoutTimerEngineTests 2>&1 | tail -30`
Expected: build failure — `extra argument 'atElapsed' in call` (the parameter doesn't exist yet).

- [ ] **Step 3: Write the implementation**

In `ios/Shared/WorkoutTimerEngine.swift`, replace:

```swift
  func start() {
    accumulated = 0
    resumeEpoch = now()
    lastIndex = -1
    state.status = .running
    onStatusChange?(.running)
    scheduleTimer()
    tick()
  }
```

with:

```swift
  func start(atElapsed: Double = 0) {
    accumulated = atElapsed
    resumeEpoch = now()
    lastIndex = -1
    state.status = .running
    onStatusChange?(.running)
    scheduleTimer()
    tick()
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/WorkoutTimerEngineTests 2>&1 | tail -30`
Expected: `** TEST SUCCEEDED **`, 12/12 tests passing.

- [ ] **Step 5: Commit**

```bash
git add ios/Shared/WorkoutTimerEngine.swift ios/ClearHiiTTests/WorkoutTimerEngineTests.swift
git commit -m "feat: support resuming WorkoutTimerEngine mid-segment via start(atElapsed:)"
```

---

### Task 3: Watch side — receive the broadcast, offer to resume, seed the engine

**Files:**
- Create: `ios/ClearHiiTWatch Watch App/WatchSessionReceiver.swift` (file-system-synchronized group — no `project.pbxproj` edit needed)
- Modify: `ios/ClearHiiTWatch Watch App/SessionRunView.swift`
- Modify: `ios/ClearHiiTWatch Watch App/ContentView.swift`

**Interfaces:**
- Consumes: `LiveSessionState`, `liveSessionState(fromApplicationContext:)`, `resumeElapsed(for:now:)`, `isLiveSessionFresh(_:now:)` (Task 1); `WorkoutTimerEngine.start(atElapsed:)` (Task 2); `WorkoutStore.shared.fetchSession(id:)`, `segmentsForSession`, `sessionId(fromDeepLinkURL:)` (all pre-existing).
- Produces: `SessionRunView.init(session:autoStart:resumeElapsed:)`, `WatchSessionReceiver.shared.liveSession: LiveSessionState?` — the visible feature surface; nothing later in this plan consumes these.

No TDD here — `WCSession` and SwiftUI view wiring aren't unit-testable without a real device/simulator pair. This task is verified by a successful build, then the manual checklist in Task 6.

- [ ] **Step 1: Add `WatchSessionReceiver`**

Create `ios/ClearHiiTWatch Watch App/WatchSessionReceiver.swift`:

```swift
// ios/ClearHiiTWatch Watch App/WatchSessionReceiver.swift
import Foundation
import WatchConnectivity

/// Wraps WCSession on the watch side, publishing the phone's most recently
/// broadcast live-session state (if any) so ContentView can offer to resume
/// it. Reads receivedApplicationContext on activation (covers "watch app
/// opened after the phone already broadcast, watch wasn't reachable at the
/// time") as well as on live updates while both apps happen to be open.
final class WatchSessionReceiver: NSObject, ObservableObject, WCSessionDelegate {
  static let shared = WatchSessionReceiver()

  @Published private(set) var liveSession: LiveSessionState?

  private override init() {
    super.init()
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: (any Error)?) {
    DispatchQueue.main.async {
      self.liveSession = liveSessionState(fromApplicationContext: session.receivedApplicationContext)
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    DispatchQueue.main.async {
      self.liveSession = liveSessionState(fromApplicationContext: applicationContext)
    }
  }
}
```

- [ ] **Step 2: Add `resumeElapsed` support to `SessionRunView`**

In `ios/ClearHiiTWatch Watch App/SessionRunView.swift`, replace:

```swift
struct SessionRunView: View {
  let session: SessionDTO
  var autoStart: Bool = false

  @StateObject private var engineHolder: EngineHolder
  @State private var countdown: Int?
  @State private var countdownTask: Task<Void, Never>?
  @State private var runningPage: RunningPage = .timer
  @State private var hasAutoStarted = false
  @Environment(\.dismiss) private var dismiss

  init(session: SessionDTO, autoStart: Bool = false) {
    self.session = session
    self.autoStart = autoStart
    _engineHolder = StateObject(wrappedValue: EngineHolder(session: session, segments: segmentsForSession(session)))
  }
```

with:

```swift
struct SessionRunView: View {
  let session: SessionDTO
  var autoStart: Bool = false
  var resumeElapsed: Double? = nil

  @StateObject private var engineHolder: EngineHolder
  @State private var countdown: Int?
  @State private var countdownTask: Task<Void, Never>?
  @State private var runningPage: RunningPage = .timer
  @State private var hasAutoStarted = false
  @Environment(\.dismiss) private var dismiss

  init(session: SessionDTO, autoStart: Bool = false, resumeElapsed: Double? = nil) {
    self.session = session
    self.autoStart = autoStart
    self.resumeElapsed = resumeElapsed
    _engineHolder = StateObject(wrappedValue: EngineHolder(session: session, segments: segmentsForSession(session)))
  }
```

Then, still in `SessionRunView.swift`, replace:

```swift
    .onAppear {
      if autoStart && !hasAutoStarted {
        hasAutoStarted = true
        beginCountdown()
      }
    }
```

with:

```swift
    .onAppear {
      guard !hasAutoStarted else { return }
      hasAutoStarted = true
      if let resumeElapsed {
        engineHolder.start(atElapsed: resumeElapsed)
      } else if autoStart {
        beginCountdown()
      }
    }
```

Finally, still in the same file, replace:

```swift
  func start() {
    recentSessionStore.record(id: session.id, name: session.name)
    engine.start()
  }
```

with:

```swift
  func start(atElapsed: Double = 0) {
    recentSessionStore.record(id: session.id, name: session.name)
    engine.start(atElapsed: atElapsed)
  }
```

(A live-handoff resume skips the 3-2-1 `beginCountdown()` entirely and jumps straight to `runningView` — re-running a countdown over time that's already elapsed on the phone would eat into the wearer's remaining segment time and feel wrong for a mid-workout resume.)

- [ ] **Step 3: Wire the resume offer into `ContentView`**

Replace the full contents of `ios/ClearHiiTWatch Watch App/ContentView.swift`:

```swift
import SwiftUI
import WidgetKit

struct ContentView: View {
  @State private var deepLinkedSession: SessionDTO?
  @State private var deepLinkedResumeElapsed: Double?
  @StateObject private var connectivity = WatchSessionReceiver.shared
  @State private var resumeOffer: LiveSessionState?

  var body: some View {
    NavigationStack {
      SessionListView()
    }
    .fullScreenCover(item: $deepLinkedSession) { session in
      SessionRunView(session: session, autoStart: deepLinkedResumeElapsed == nil, resumeElapsed: deepLinkedResumeElapsed)
    }
    .onOpenURL { url in
      guard let id = sessionId(fromDeepLinkURL: url),
            let session = WorkoutStore.shared.fetchSession(id: id) else { return }
      deepLinkedResumeElapsed = nil
      deepLinkedSession = session
    }
    .onAppear {
      // Ensures the complication reflects the latest installed code/content
      // rather than a stale cached render from before this launch.
      WidgetCenter.shared.reloadTimelines(ofKind: recentSessionWidgetKind)
      checkForResumableSession()
    }
    .confirmationDialog(
      "Resume \"\(resumeOffer?.name ?? "")\" from iPhone?",
      isPresented: Binding(get: { resumeOffer != nil }, set: { if !$0 { resumeOffer = nil } }),
      presenting: resumeOffer
    ) { offer in
      Button("Resume") {
        guard let session = WorkoutStore.shared.fetchSession(id: offer.sessionId) else {
          resumeOffer = nil
          return
        }
        deepLinkedResumeElapsed = resumeElapsed(for: offer, now: Date())
        deepLinkedSession = session
        resumeOffer = nil
      }
      Button("Dismiss", role: .cancel) { resumeOffer = nil }
    }
  }

  private func checkForResumableSession() {
    guard resumeOffer == nil, deepLinkedSession == nil,
          let live = connectivity.liveSession, isLiveSessionFresh(live, now: Date()) else { return }
    resumeOffer = live
  }
}

#Preview {
  ContentView()
}
```

- [ ] **Step 4: Build the watch scheme to verify it compiles**

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination "platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)" 2>&1 | tail -30`
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests 2>&1 | tail -15`
Expected: `** TEST SUCCEEDED **`, 69/69 tests passing (60 baseline + 7 from Task 1's `LiveSessionStateTests` + 2 from Task 2's `WorkoutTimerEngineTests` additions — this task adds no new XCTests itself).

- [ ] **Step 6: Commit**

```bash
git add "ios/ClearHiiTWatch Watch App/WatchSessionReceiver.swift" "ios/ClearHiiTWatch Watch App/SessionRunView.swift" "ios/ClearHiiTWatch Watch App/ContentView.swift"
git commit -m "feat: offer to resume the phone's live session when the watch app opens"
```

---

### Task 4: Phone-side native `LiveSessionSync` module

**Files:**
- Create: `ios/ClearHiiT/LiveSessionSyncModule.swift`
- Create: `ios/ClearHiiT/LiveSessionSyncModule.m`
- Modify: `ios/ClearHiiT.xcodeproj/project.pbxproj` (register both files into the `ClearHiiT` phone target only, mirroring exactly how `WorkoutSyncModule.swift`/`.m` are registered)

**Interfaces:**
- Consumes: nothing.
- Produces: the JS-callable native methods `NativeModules.LiveSessionSync.updateLiveSession(sessionId: string, name: string, elapsed: number, status: string)` and `NativeModules.LiveSessionSync.clearLiveSession()`. Task 5's `src/lib/liveSessionSync.ts` consumes these exact method names.

No unit tests — `WorkoutSyncModule.swift`/`.m` (the existing, structurally identical native bridge module) has none either; this is thin `RCTBridgeModule` glue verified by a successful phone-target build.

- [ ] **Step 1: Write `LiveSessionSyncModule.swift`**

Create `ios/ClearHiiT/LiveSessionSyncModule.swift`:

```swift
// ios/ClearHiiT/LiveSessionSyncModule.swift
import Foundation
import WatchConnectivity

@objc(LiveSessionSync)
class LiveSessionSync: NSObject, WCSessionDelegate {
  private static var didActivate = false

  private func ensureActivated() {
    guard WCSession.isSupported(), !LiveSessionSync.didActivate else { return }
    LiveSessionSync.didActivate = true
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  @objc
  func updateLiveSession(_ sessionId: String, name: String, elapsed: Double, status: String) {
    ensureActivated()
    guard WCSession.isSupported() else { return }
    let context: [String: Any] = [
      "sessionId": sessionId,
      "name": name,
      "elapsed": elapsed,
      "status": status,
      "updatedAt": Date().timeIntervalSince1970,
    ]
    try? WCSession.default.updateApplicationContext(context)
  }

  @objc
  func clearLiveSession() {
    ensureActivated()
    guard WCSession.isSupported() else { return }
    try? WCSession.default.updateApplicationContext([:])
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: (any Error)?) {}
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) {
    WCSession.default.activate()
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
```

- [ ] **Step 2: Write `LiveSessionSyncModule.m`**

Create `ios/ClearHiiT/LiveSessionSyncModule.m`:

```objc
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LiveSessionSync, NSObject)

RCT_EXTERN_METHOD(updateLiveSession:(NSString *)sessionId name:(NSString *)name elapsed:(double)elapsed status:(NSString *)status)

RCT_EXTERN_METHOD(clearLiveSession)

@end
```

- [ ] **Step 3: Register both files in the Xcode project (phone target only)**

In `ios/ClearHiiT.xcodeproj/project.pbxproj`, replace:

```
		5E59C9B8300FD7F300C04775 /* WorkoutSyncModule.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5E59C9B6300FD7F300C04775 /* WorkoutSyncModule.swift */; };
```

with:

```
		5E59C9B8300FD7F300C04775 /* WorkoutSyncModule.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5E59C9B6300FD7F300C04775 /* WorkoutSyncModule.swift */; };
		A1B2C3D4E5F60718293A4B5C /* LiveSessionSyncModule.m in Sources */ = {isa = PBXBuildFile; fileRef = 9D8C7B6A5948372615E4D3C2 /* LiveSessionSyncModule.m */; };
		B2C3D4E5F60718293A4B5C6D /* LiveSessionSyncModule.swift in Sources */ = {isa = PBXBuildFile; fileRef = 3E2D1C0B9A8978675645F3E2 /* LiveSessionSyncModule.swift */; };
```

Then replace:

```
		5E59C9B6300FD7F300C04775 /* WorkoutSyncModule.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = WorkoutSyncModule.swift; path = ClearHiiT/WorkoutSyncModule.swift; sourceTree = "<group>"; };
```

with:

```
		5E59C9B6300FD7F300C04775 /* WorkoutSyncModule.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = WorkoutSyncModule.swift; path = ClearHiiT/WorkoutSyncModule.swift; sourceTree = "<group>"; };
		9D8C7B6A5948372615E4D3C2 /* LiveSessionSyncModule.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; name = LiveSessionSyncModule.m; path = ClearHiiT/LiveSessionSyncModule.m; sourceTree = "<group>"; };
		3E2D1C0B9A8978675645F3E2 /* LiveSessionSyncModule.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = LiveSessionSyncModule.swift; path = ClearHiiT/LiveSessionSyncModule.swift; sourceTree = "<group>"; };
```

Then replace (the "ClearHiiT" group's children list):

```
				5E59C9B6300FD7F300C04775 /* WorkoutSyncModule.swift */,
```

with:

```
				5E59C9B6300FD7F300C04775 /* WorkoutSyncModule.swift */,
				9D8C7B6A5948372615E4D3C2 /* LiveSessionSyncModule.m */,
				3E2D1C0B9A8978675645F3E2 /* LiveSessionSyncModule.swift */,
```

Then replace (the `ClearHiiT` phone target's Sources build phase):

```
				5E59C9B8300FD7F300C04775 /* WorkoutSyncModule.swift in Sources */,
```

with:

```
				5E59C9B8300FD7F300C04775 /* WorkoutSyncModule.swift in Sources */,
				A1B2C3D4E5F60718293A4B5C /* LiveSessionSyncModule.m in Sources */,
				B2C3D4E5F60718293A4B5C6D /* LiveSessionSyncModule.swift in Sources */,
```

- [ ] **Step 4: Build the phone scheme to verify it compiles**

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' 2>&1 | tail -30`
Expected: `** BUILD SUCCEEDED **`. If it fails with an undefined-symbol or framework-not-found error mentioning WatchConnectivity, add an explicit `WatchConnectivity.framework` entry to the `ClearHiiT` target's Frameworks build phase (same pattern as the existing `WidgetKit.framework`/`SwiftUI.framework` entries) before re-running.

- [ ] **Step 5: Commit**

```bash
git add ios/ClearHiiT/LiveSessionSyncModule.swift ios/ClearHiiT/LiveSessionSyncModule.m ios/ClearHiiT.xcodeproj/project.pbxproj
git commit -m "feat: add LiveSessionSync native module bridging WCSession to JS"
```

---

### Task 5: Phone JS bridge — `src/lib/liveSessionSync.ts` (TDD)

**Files:**
- Create: `src/lib/liveSessionSync.ts`
- Create: `src/lib/__tests__/liveSessionSync.test.ts`

**Interfaces:**
- Consumes: `NativeModules.LiveSessionSync.updateLiveSession`/`.clearLiveSession` (Task 4).
- Produces: `updateLiveSession(sessionId: string, name: string, elapsed: number, status: 'running' | 'paused'): void`, `clearLiveSession(): void`, `shouldBroadcastLiveSession(prevStatus: string | null, nextStatus: string, lastSentAt: number | null, now: number, minIntervalMs?: number): boolean`. Task 6's `WorkoutScreen.tsx` consumes all three.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/liveSessionSync.test.ts`:

```typescript
import { NativeModules } from 'react-native';
import { updateLiveSession, clearLiveSession, shouldBroadcastLiveSession } from '../liveSessionSync';

describe('updateLiveSession', () => {
  it('calls the native LiveSessionSync.updateLiveSession method with the given fields', () => {
    const updateMock = jest.fn();
    NativeModules.LiveSessionSync = { updateLiveSession: updateMock };

    updateLiveSession('s1', 'Tabata', 42.5, 'running');

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith('s1', 'Tabata', 42.5, 'running');
  });

  it('does not throw when the native module is unavailable', () => {
    NativeModules.LiveSessionSync = undefined;

    expect(() => updateLiveSession('s1', 'Tabata', 42.5, 'running')).not.toThrow();
  });
});

describe('clearLiveSession', () => {
  it('calls the native LiveSessionSync.clearLiveSession method', () => {
    const clearMock = jest.fn();
    NativeModules.LiveSessionSync = { clearLiveSession: clearMock };

    clearLiveSession();

    expect(clearMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the native module is unavailable', () => {
    NativeModules.LiveSessionSync = undefined;

    expect(() => clearLiveSession()).not.toThrow();
  });
});

describe('shouldBroadcastLiveSession', () => {
  it('is true on a status change regardless of timing', () => {
    expect(shouldBroadcastLiveSession('running', 'paused', 1_000, 1_000)).toBe(true);
  });

  it('is true the first time (lastSentAt is null)', () => {
    expect(shouldBroadcastLiveSession(null, 'running', null, 1_000)).toBe(true);
  });

  it('is false when the status is unchanged and under the minimum interval', () => {
    expect(shouldBroadcastLiveSession('running', 'running', 1_000, 1_500, 2_000)).toBe(false);
  });

  it('is true when the status is unchanged but the minimum interval has elapsed', () => {
    expect(shouldBroadcastLiveSession('running', 'running', 1_000, 3_001, 2_000)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/__tests__/liveSessionSync.test.ts 2>&1 | tail -30`
Expected: FAIL — `Cannot find module '../liveSessionSync'`.

- [ ] **Step 3: Write `liveSessionSync.ts`**

Create `src/lib/liveSessionSync.ts`:

```typescript
import { NativeModules } from 'react-native';

export function updateLiveSession(
  sessionId: string,
  name: string,
  elapsed: number,
  status: 'running' | 'paused',
): void {
  try {
    // Look up NativeModules.LiveSessionSync at call time, not via a
    // destructured module-scope binding — mirrors workoutSync.ts's rationale:
    // the native module can register after this file loads, and tests
    // reassign NativeModules.LiveSessionSync at runtime.
    NativeModules.LiveSessionSync?.updateLiveSession(sessionId, name, elapsed, status);
  } catch (e) {
    console.warn('liveSessionSync: updateLiveSession failed', e);
  }
}

export function clearLiveSession(): void {
  try {
    NativeModules.LiveSessionSync?.clearLiveSession();
  } catch (e) {
    console.warn('liveSessionSync: clearLiveSession failed', e);
  }
}

/**
 * Throttles how often WorkoutScreen pushes to WatchConnectivity: always on
 * a status change (so pause/resume/finish reach the watch immediately),
 * otherwise at most once per `minIntervalMs` while running — the watch only
 * ever reads applicationContext once, on open, so a sub-second broadcast
 * cadence buys nothing and just burns battery/radio.
 */
export function shouldBroadcastLiveSession(
  prevStatus: string | null,
  nextStatus: string,
  lastSentAt: number | null,
  now: number,
  minIntervalMs = 2000,
): boolean {
  if (prevStatus !== nextStatus) return true;
  if (lastSentAt === null) return true;
  return now - lastSentAt >= minIntervalMs;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/__tests__/liveSessionSync.test.ts 2>&1 | tail -30`
Expected: `Tests: 8 passed, 8 total`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/liveSessionSync.ts src/lib/__tests__/liveSessionSync.test.ts
git commit -m "feat: add liveSessionSync JS bridge with broadcast throttling"
```

---

### Task 6: Wire broadcasting into `WorkoutScreen`

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx`

**Interfaces:**
- Consumes: `updateLiveSession`, `clearLiveSession`, `shouldBroadcastLiveSession` (Task 5); the pre-existing `status`, `elapsed` (from `useWorkoutSession`) and `session.id`/`session.name` (prop) already in scope in `WorkoutScreen`.
- Produces: nothing further consumed within this plan — this is the end of the phone → watch broadcast chain.

No new unit test — this codebase has no screen-level test precedent (no `src/screens/__tests__` directory exists for any screen), so this task's glue is verified by typecheck, the full regression suite, and the manual on-device checklist in Task 7.

- [ ] **Step 1: Add imports**

In `src/screens/WorkoutScreen.tsx`, replace:

```typescript
import { checkAndRequestReview } from '../lib/reviewState';
```

with:

```typescript
import { checkAndRequestReview } from '../lib/reviewState';
import { updateLiveSession, clearLiveSession, shouldBroadcastLiveSession } from '../lib/liveSessionSync';
```

- [ ] **Step 2: Broadcast on status/elapsed changes, clear on finish/unmount**

In `src/screens/WorkoutScreen.tsx`, replace:

```typescript
  const progressAnim = useRef(new Animated.Value(1)).current;
  const [flashing, setFlashing] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); }, []);
```

with:

```typescript
  const progressAnim = useRef(new Animated.Value(1)).current;
  const [flashing, setFlashing] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); }, []);

  const lastLiveSyncRef = useRef<number | null>(null);
  const lastLiveStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (status === 'running' || status === 'paused') {
      const now = Date.now();
      if (shouldBroadcastLiveSession(lastLiveStatusRef.current, status, lastLiveSyncRef.current, now)) {
        updateLiveSession(session.id, session.name, elapsed, status);
        lastLiveSyncRef.current = now;
        lastLiveStatusRef.current = status;
      }
    } else if (lastLiveStatusRef.current !== null) {
      clearLiveSession();
      lastLiveStatusRef.current = null;
      lastLiveSyncRef.current = null;
    }
  }, [status, elapsed, session.id, session.name]);

  useEffect(() => () => clearLiveSession(), []);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -30`
Expected: no errors.

- [ ] **Step 4: Run the full Jest suite for regressions**

Run: `npx jest 2>&1 | tail -15`
Expected: `Tests: 552 passed, 552 total` (544 baseline + 8 from Task 5).

- [ ] **Step 5: Commit**

```bash
git add src/screens/WorkoutScreen.tsx
git commit -m "feat: broadcast the running session's live state to the watch"
```

---

### Task 7 (manual, human only): End-to-end verification on real devices

This sandbox has no way to pair a phone and watch simulator or drive WatchConnectivity (no macOS Accessibility permission, no physical devices) — a human needs to confirm the full handoff actually works:

1. Build and run both `ClearHiiT` (phone) and `ClearHiiTWatch Watch App` on paired devices or simulators (a real device pair is more reliable for WatchConnectivity than the simulator).
2. Start any session on the phone (`WorkoutScreen`), let it run for ~10 seconds.
3. Open the watch app. Confirm a "Resume '\<name\>' from iPhone?" dialog appears.
4. Tap Resume. Confirm the watch jumps straight into the running view at roughly the correct segment and remaining time — no 3-2-1 countdown.
5. Pause on the phone, wait a couple of seconds, then open the watch app again (force-quit and relaunch it to simulate "opened later"). Confirm the offered resume point reflects the paused elapsed time, not advanced further.
6. Let the phone's session run past 120 seconds without opening the watch app, then open it. Confirm no resume prompt appears (staleness cutoff).
7. Finish a session fully on the phone, then open the watch app. Confirm no resume prompt appears (the phone should have called `clearLiveSession()` on finish).
8. Confirm normal, non-handoff flows are unaffected: starting a session directly on the watch via `SessionListView`, and the existing "last workout" complication deep link (`hiitwatch://run?id=...`) both still show the 3-2-1 countdown as before (only the live-handoff path skips it).
9. Confirm HealthKit still records correctly for a watch-resumed session (unaffected by this plan, but worth a spot check since it's a previously-unreachable code path for `WorkoutSessionCoordinator`).
