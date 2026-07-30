# Watch Complications / Smart Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Human-in-the-loop notice:** Task 3, Step 1 requires interactive use of the Xcode GUI (target creation wizard + Signing & Capabilities tab, twice). This cannot be automated by an AI agent driving a terminal. A human must perform that step, then hand control back for the remaining CLI-driven steps.

**Goal:** Ship the last unimplemented piece of the watch app's v2 phase (per `docs/HIIT_Timer_watchOS_Feature_Architecture.md.docx`, line 99): a watch face complication / Smart Stack widget that shows the most recently run session and, on tap, jumps straight into its 3-2-1 countdown — no need to open the app and pick from the Sessions list first.

**Architecture:** A new `RecentSessionStore` (in `ios/Shared`, App Group-backed `UserDefaults`) records `{id, name, ranAt}` every time a session starts running on the watch. A new WidgetKit extension target reads that same store from its own process and renders `.accessoryCircular`/`.accessoryRectangular` widgets. Tapping either opens `hiitwatch://run?id=<id>`, which `ContentView` catches via `.onOpenURL`, looks the session up via the existing `WorkoutStore.fetchSession(id:)`, and presents `SessionRunView(session:autoStart:true)` — a new flag that skips the "Start" button and drives straight into the countdown.

**Tech Stack:** WidgetKit (`TimelineProvider`, `StaticConfiguration`, accessory widget families), Swift, no third-party dependencies. Reuses the existing `group.com.georgefromgib.hiittimer` App Group (already declared in `ios/ClearHiiT/ClearHiiT.entitlements`, unused until now).

## Global Constraints

- watchOS deployment target stays `10.0` (existing `ClearHiiTWatch Watch App` target — do not lower or raise it). `.accessoryCircular`/`.accessoryRectangular` widget families and `WidgetCenter.reloadTimelines` are both available since watchOS 9, so no `#available` guards are needed for this plan's code.
- App Group identifier: reuse `group.com.georgefromgib.hiittimer` (already present in `ios/ClearHiiT/ClearHiiT.entitlements`) for the Watch App target and the new widget extension target. Do not invent a second App Group.
- Deep link URL format is fixed: `hiitwatch://run?id=<sessionId>` (scheme `hiitwatch`, host `run`, query item `id`). Task 2 defines the parser, Task 3's widget must build URLs matching exactly this shape via `URLComponents`, not manual string interpolation.
- `ios/Shared` is a manually-listed `project.pbxproj` group (unlike `ios/ClearHiiTWatch Watch App` and `ios/ClearHiiTTests`, which are Xcode 16 file-system-synchronized groups that pick up new files automatically). Every new `ios/Shared/*.swift` file in this plan must be registered by hand in `project.pbxproj`, scoped to exactly `ClearHiiTWatch Watch App` and `ClearHiiTTests` — never the phone `ClearHiiT` target (matches the existing fix in commit `bb7b1b6`, "scope WorkoutSessionRecording.swift to the watch and test targets only").
- `RecentSessionStore` takes primitive `id`/`name` strings, not a `SessionDTO`, specifically so `ios/Shared/RecentSessionStore.swift` has zero dependency on `WorkoutModels.swift` — the widget extension target (Task 3) only ever needs to include this one small file from `Shared`, not the whole model layer.
- Do not add a `ConfigurationAppIntent` / user-configurable widget. This is a single fixed widget (last-run session) — no configuration surface is in scope.
- Do not implement crash/force-quit recovery, retry logic for a failed `WidgetCenter.reloadTimelines` call, or any UI for browsing *past* recent sessions (only the single most-recent one). Out of scope, matches Simplicity First.

---

### Task 1: `RecentSessionStore` — record and read the last-run session

**Files:**
- Create: `ios/Shared/RecentSessionStore.swift`
- Test: `ios/ClearHiiTTests/RecentSessionStoreTests.swift`
- Modify: `ios/ClearHiiT.xcodeproj/project.pbxproj` (register the new file into `ClearHiiTWatch Watch App` and `ClearHiiTTests` targets)

**Interfaces:**
- Consumes: nothing.
- Produces: `RecentSession` (`id: String`, `name: String`, `ranAt: Date`, `Codable`, `Equatable`), `RecentSessionStore` with `init(defaults: UserDefaults = ...)`, `func record(id: String, name: String, now: Date = Date())`, `func fetch() -> RecentSession?`, and the top-level constant `let recentSessionWidgetKind = "RecentSessionComplication"`. Task 2 calls `record`, Task 3 calls `fetch` and reuses `recentSessionWidgetKind`.

- [ ] **Step 1: Write the failing tests**

Create `ios/ClearHiiTTests/RecentSessionStoreTests.swift`:

```swift
import XCTest

final class RecentSessionStoreTests: XCTestCase {
  private var defaults: UserDefaults!
  private var store: RecentSessionStore!

  override func setUp() {
    super.setUp()
    defaults = UserDefaults(suiteName: "RecentSessionStoreTests")
    defaults.removePersistentDomain(forName: "RecentSessionStoreTests")
    store = RecentSessionStore(defaults: defaults)
  }

  override func tearDown() {
    defaults.removePersistentDomain(forName: "RecentSessionStoreTests")
    super.tearDown()
  }

  func test_fetch_returnsNilWhenNothingRecorded() {
    XCTAssertNil(store.fetch())
  }

  func test_recordThenFetch_roundTripsIdNameAndTimestamp() {
    let now = Date(timeIntervalSince1970: 1_700_000_000)
    store.record(id: "1", name: "Tabata", now: now)

    let recent = store.fetch()
    XCTAssertEqual(recent?.id, "1")
    XCTAssertEqual(recent?.name, "Tabata")
    XCTAssertEqual(recent?.ranAt, now)
  }

  func test_record_overwritesPreviousRecentSession() {
    store.record(id: "1", name: "First", now: Date(timeIntervalSince1970: 1))
    store.record(id: "2", name: "Second", now: Date(timeIntervalSince1970: 2))

    XCTAssertEqual(store.fetch()?.id, "2")
  }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/RecentSessionStoreTests 2>&1 | tail -30`
Expected: build failure — `Cannot find 'RecentSessionStore' in scope` (or similar, since the type doesn't exist yet).

- [ ] **Step 3: Write `RecentSessionStore`**

Create `ios/Shared/RecentSessionStore.swift`:

```swift
// ios/Shared/RecentSessionStore.swift
import Foundation
import WidgetKit

/// Widget kind identifier shared between the app (which reloads this widget's
/// timeline after recording a session) and the widget extension (which
/// registers itself under this kind) — keeping it here, in the one file both
/// targets include, keeps the two from ever drifting apart.
let recentSessionWidgetKind = "RecentSessionComplication"

private let appGroupSuiteName = "group.com.georgefromgib.hiittimer"
private let recentSessionDefaultsKey = "watch.recentSession"

struct RecentSession: Codable, Equatable {
  let id: String
  let name: String
  let ranAt: Date
}

/// Records the most recently started watch session to an App Group-shared
/// UserDefaults suite, so the RecentSessionComplication widget extension (a
/// separate process) can read it and offer a one-tap restart. Falls back to
/// `.standard` if the App Group container isn't reachable (e.g. before the
/// entitlement is wired up in Task 3) rather than crashing.
struct RecentSessionStore {
  private let defaults: UserDefaults

  init(defaults: UserDefaults = UserDefaults(suiteName: appGroupSuiteName) ?? .standard) {
    self.defaults = defaults
  }

  func record(id: String, name: String, now: Date = Date()) {
    let recent = RecentSession(id: id, name: name, ranAt: now)
    guard let data = try? JSONEncoder().encode(recent) else { return }
    defaults.set(data, forKey: recentSessionDefaultsKey)
    WidgetCenter.shared.reloadTimelines(ofKind: recentSessionWidgetKind)
  }

  func fetch() -> RecentSession? {
    guard let data = defaults.data(forKey: recentSessionDefaultsKey) else { return nil }
    return try? JSONDecoder().decode(RecentSession.self, from: data)
  }
}
```

- [ ] **Step 4: Register the new file in the Xcode project**

`ios/Shared` files must be members of exactly `ClearHiiTWatch Watch App` and `ClearHiiTTests` (not the phone `ClearHiiT` target) — matches how `WorkoutSessionRecording.swift` is registered in `project.pbxproj` after commit `bb7b1b6`.

In `ios/ClearHiiT.xcodeproj/project.pbxproj`, replace:

```
		5930942B2A47F64F92DA8F87 /* WorkoutSessionRecording.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */; };
		5AAAF0DFFB85A1407BEF24A9 /* WorkoutSessionRecording.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */; };
```

with:

```
		5930942B2A47F64F92DA8F87 /* WorkoutSessionRecording.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */; };
		5AAAF0DFFB85A1407BEF24A9 /* WorkoutSessionRecording.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */; };
		89C80048B3974DC09C91EDD3 /* RecentSessionStore.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16819D9A253946278285B595 /* RecentSessionStore.swift */; };
		30F9311A2DBF4E85B5B7ED8E /* RecentSessionStore.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16819D9A253946278285B595 /* RecentSessionStore.swift */; };
```

Then, in the same file, replace:

```
		5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = WorkoutSessionRecording.swift; path = Shared/WorkoutSessionRecording.swift; sourceTree = "<group>"; };
```

with:

```
		5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = WorkoutSessionRecording.swift; path = Shared/WorkoutSessionRecording.swift; sourceTree = "<group>"; };
		16819D9A253946278285B595 /* RecentSessionStore.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = RecentSessionStore.swift; path = Shared/RecentSessionStore.swift; sourceTree = "<group>"; };
```

Then, still in the same file, replace (the top-level group's children list):

```
				5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */,
				5E21ECB830114F6A003B942C /* WorkoutModel.xcdatamodeld */,
```

with:

```
				5532829AB9C9ADA32A0E474F /* WorkoutSessionRecording.swift */,
				16819D9A253946278285B595 /* RecentSessionStore.swift */,
				5E21ECB830114F6A003B942C /* WorkoutModel.xcdatamodeld */,
```

Finally, add the new build-file IDs to the two targets' `PBXSourcesBuildPhase` blocks. Replace:

```
				5E21ECD130116142003B942C /* SegmentBuilder.swift in Sources */,
				5930942B2A47F64F92DA8F87 /* WorkoutSessionRecording.swift in Sources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		5E59C9A2300FC71E00C04775 /* Sources */ = {
```

with:

```
				5E21ECD130116142003B942C /* SegmentBuilder.swift in Sources */,
				5930942B2A47F64F92DA8F87 /* WorkoutSessionRecording.swift in Sources */,
				89C80048B3974DC09C91EDD3 /* RecentSessionStore.swift in Sources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		5E59C9A2300FC71E00C04775 /* Sources */ = {
```

Replace:

```
				5E21ECCF3011611D003B942C /* SegmentBuilder.swift in Sources */,
				5AAAF0DFFB85A1407BEF24A9 /* WorkoutSessionRecording.swift in Sources */,
				5E21ECBD30114F6B003B942C /* WorkoutStore.swift in Sources */,
```

with:

```
				5E21ECCF3011611D003B942C /* SegmentBuilder.swift in Sources */,
				5AAAF0DFFB85A1407BEF24A9 /* WorkoutSessionRecording.swift in Sources */,
				30F9311A2DBF4E85B5B7ED8E /* RecentSessionStore.swift in Sources */,
				5E21ECBD30114F6B003B942C /* WorkoutStore.swift in Sources */,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/RecentSessionStoreTests 2>&1 | tail -30`
Expected: `** TEST SUCCEEDED **`, 3/3 tests passing.

- [ ] **Step 6: Run the full test suite for regressions**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests 2>&1 | tail -15`
Expected: `** TEST SUCCEEDED **`, 56/56 tests passing (53 existing + 3 new).

- [ ] **Step 7: Commit**

```bash
git add ios/Shared/RecentSessionStore.swift ios/ClearHiiTTests/RecentSessionStoreTests.swift ios/ClearHiiT.xcodeproj/project.pbxproj
git commit -m "feat: add RecentSessionStore for the last-run-session complication"
```

---

### Task 2: Deep-link auto-start — record on start, jump straight to the countdown

**Files:**
- Create: `ios/Shared/DeepLink.swift`
- Test: `ios/ClearHiiTTests/DeepLinkTests.swift`
- Modify: `ios/ClearHiiT.xcodeproj/project.pbxproj` (register `DeepLink.swift` into `ClearHiiTWatch Watch App` and `ClearHiiTTests`, same pattern as Task 1 Step 4)
- Modify: `ios/Shared/WorkoutModels.swift` (add `Identifiable` conformance to `SessionDTO`)
- Modify: `ios/ClearHiiTWatch Watch App/SessionRunView.swift` (add `autoStart`, record on start)
- Modify: `ios/ClearHiiTWatch Watch App/ContentView.swift` (catch the deep link, present the session)
- Modify: `ios/ClearHiiTWatch Watch App/Info.plist` (register the `hiitwatch` URL scheme)

**Interfaces:**
- Consumes: `RecentSessionStore` (Task 1) — `EngineHolder.start()` calls `record(id:name:)`.
- Produces: `func sessionId(fromDeepLinkURL url: URL) -> String?`, `SessionRunView.init(session:autoStart:)` (default `autoStart: false`, so all existing call sites are unaffected), `WorkoutStore.fetchSession(id:)` is now reachable from a deep link via `ContentView`.

- [ ] **Step 1: Write the failing tests**

Create `ios/ClearHiiTTests/DeepLinkTests.swift`:

```swift
import XCTest

final class DeepLinkTests: XCTestCase {
  func test_sessionId_parsesValidRunURL() {
    let url = URL(string: "hiitwatch://run?id=abc123")!
    XCTAssertEqual(sessionId(fromDeepLinkURL: url), "abc123")
  }

  func test_sessionId_nilForWrongScheme() {
    let url = URL(string: "https://run?id=abc123")!
    XCTAssertNil(sessionId(fromDeepLinkURL: url))
  }

  func test_sessionId_nilForWrongHost() {
    let url = URL(string: "hiitwatch://open?id=abc123")!
    XCTAssertNil(sessionId(fromDeepLinkURL: url))
  }

  func test_sessionId_nilWhenIdMissing() {
    let url = URL(string: "hiitwatch://run")!
    XCTAssertNil(sessionId(fromDeepLinkURL: url))
  }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/DeepLinkTests 2>&1 | tail -30`
Expected: build failure — `Cannot find 'sessionId' in scope`.

- [ ] **Step 3: Write the parser**

Create `ios/Shared/DeepLink.swift`:

```swift
// ios/Shared/DeepLink.swift
import Foundation

/// Parses the "start this session" deep link the RecentSessionComplication
/// widget's tap target opens, e.g. hiitwatch://run?id=abc123. Returns nil for
/// any other scheme/host, or a missing id, so the caller can silently ignore it.
func sessionId(fromDeepLinkURL url: URL) -> String? {
  guard url.scheme == "hiitwatch", url.host == "run" else { return nil }
  return URLComponents(url: url, resolvingAgainstBaseURL: false)?
    .queryItems?
    .first(where: { $0.name == "id" })?
    .value
}
```

- [ ] **Step 4: Register the new file in the Xcode project**

Same pattern as Task 1 Step 4. In `ios/ClearHiiT.xcodeproj/project.pbxproj`, replace:

```
		89C80048B3974DC09C91EDD3 /* RecentSessionStore.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16819D9A253946278285B595 /* RecentSessionStore.swift */; };
		30F9311A2DBF4E85B5B7ED8E /* RecentSessionStore.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16819D9A253946278285B595 /* RecentSessionStore.swift */; };
```

with:

```
		89C80048B3974DC09C91EDD3 /* RecentSessionStore.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16819D9A253946278285B595 /* RecentSessionStore.swift */; };
		30F9311A2DBF4E85B5B7ED8E /* RecentSessionStore.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16819D9A253946278285B595 /* RecentSessionStore.swift */; };
		4B8C5877C0DB4A20B13D6672 /* DeepLink.swift in Sources */ = {isa = PBXBuildFile; fileRef = 60CCE433F70F4E54A7E917F2 /* DeepLink.swift */; };
		0ADE5215E96F488D9CCEB900 /* DeepLink.swift in Sources */ = {isa = PBXBuildFile; fileRef = 60CCE433F70F4E54A7E917F2 /* DeepLink.swift */; };
```

Then replace:

```
		16819D9A253946278285B595 /* RecentSessionStore.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = RecentSessionStore.swift; path = Shared/RecentSessionStore.swift; sourceTree = "<group>"; };
```

with:

```
		16819D9A253946278285B595 /* RecentSessionStore.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = RecentSessionStore.swift; path = Shared/RecentSessionStore.swift; sourceTree = "<group>"; };
		60CCE433F70F4E54A7E917F2 /* DeepLink.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = DeepLink.swift; path = Shared/DeepLink.swift; sourceTree = "<group>"; };
```

Then replace (the top-level group's children list):

```
				16819D9A253946278285B595 /* RecentSessionStore.swift */,
				5E21ECB830114F6A003B942C /* WorkoutModel.xcdatamodeld */,
```

with:

```
				16819D9A253946278285B595 /* RecentSessionStore.swift */,
				60CCE433F70F4E54A7E917F2 /* DeepLink.swift */,
				5E21ECB830114F6A003B942C /* WorkoutModel.xcdatamodeld */,
```

Finally, replace:

```
				89C80048B3974DC09C91EDD3 /* RecentSessionStore.swift in Sources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		5E59C9A2300FC71E00C04775 /* Sources */ = {
```

with:

```
				89C80048B3974DC09C91EDD3 /* RecentSessionStore.swift in Sources */,
				4B8C5877C0DB4A20B13D6672 /* DeepLink.swift in Sources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		5E59C9A2300FC71E00C04775 /* Sources */ = {
```

Replace:

```
				30F9311A2DBF4E85B5B7ED8E /* RecentSessionStore.swift in Sources */,
				5E21ECBD30114F6B003B942C /* WorkoutStore.swift in Sources */,
```

with:

```
				30F9311A2DBF4E85B5B7ED8E /* RecentSessionStore.swift in Sources */,
				0ADE5215E96F488D9CCEB900 /* DeepLink.swift in Sources */,
				5E21ECBD30114F6B003B942C /* WorkoutStore.swift in Sources */,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/DeepLinkTests 2>&1 | tail -30`
Expected: `** TEST SUCCEEDED **`, 4/4 tests passing.

- [ ] **Step 6: Add `Identifiable` to `SessionDTO`**

In `ios/Shared/WorkoutModels.swift`, `SessionDTO` already has an `id: String` field. Add, right after the closing brace of the `SessionDTO` struct:

```swift
extension SessionDTO: Identifiable {}
```

- [ ] **Step 7: Wire `autoStart` and the recorder into `SessionRunView.swift`**

In `ios/ClearHiiTWatch Watch App/SessionRunView.swift`, replace:

```swift
struct SessionRunView: View {
  let session: SessionDTO

  @StateObject private var engineHolder: EngineHolder
  @State private var countdown: Int?
  @State private var countdownTask: Task<Void, Never>?
  @State private var runningPage: RunningPage = .timer
  @Environment(\.dismiss) private var dismiss

  init(session: SessionDTO) {
    self.session = session
    _engineHolder = StateObject(wrappedValue: EngineHolder(session: session, segments: segmentsForSession(session)))
  }

  var body: some View {
    let state = engineHolder.engine.state
    let segment = engineHolder.currentSegment

    Group {
      if state.status == .finished {
        SessionDoneView(congratsMessage: engineHolder.congratsMessage, onDone: { dismiss() })
      } else if let countdown {
        CountdownView(count: countdown)
      } else if state.status == .idle {
        readyView
      } else {
        runningView(state: state, segment: segment)
      }
    }
    .onDisappear {
      countdownTask?.cancel()
      engineHolder.discardIfUnfinished()
    }
  }
```

with:

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

  var body: some View {
    let state = engineHolder.engine.state
    let segment = engineHolder.currentSegment

    Group {
      if state.status == .finished {
        SessionDoneView(congratsMessage: engineHolder.congratsMessage, onDone: { dismiss() })
      } else if let countdown {
        CountdownView(count: countdown)
      } else if state.status == .idle {
        readyView
      } else {
        runningView(state: state, segment: segment)
      }
    }
    .onAppear {
      if autoStart && !hasAutoStarted {
        hasAutoStarted = true
        beginCountdown()
      }
    }
    .onDisappear {
      countdownTask?.cancel()
      engineHolder.discardIfUnfinished()
    }
  }
```

(`readyView` still renders for one frame before `beginCountdown()` flips to the countdown when `autoStart` is true — an accepted single-frame flash, not worth extra state to suppress.)

Then, still in `SessionRunView.swift`, replace:

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
    self.workoutSession = WorkoutSessionCoordinator(
      recorder: HealthKitWorkoutManager(),
      activityType: hkActivityType(for: session),
      engine: engine
    )
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
  private let session: SessionDTO
  private let recentSessionStore = RecentSessionStore()

  init(session: SessionDTO, segments: [Segment]) {
    let engine = WorkoutTimerEngine(segments: segments)
    self.engine = engine
    self.segments = segments
    self.currentSegment = segments.first
    self.session = session
    self.workoutSession = WorkoutSessionCoordinator(
      recorder: HealthKitWorkoutManager(),
      activityType: hkActivityType(for: session),
      engine: engine
    )
```

Finally, in the same file, replace:

```swift
  func start() {
    engine.start()
  }
```

with:

```swift
  func start() {
    recentSessionStore.record(id: session.id, name: session.name)
    engine.start()
  }
```

- [ ] **Step 8: Wire the deep link into `ContentView.swift`**

Replace the full contents of `ios/ClearHiiTWatch Watch App/ContentView.swift`:

```swift
import SwiftUI

struct ContentView: View {
  @State private var deepLinkedSession: SessionDTO?

  var body: some View {
    NavigationStack {
      SessionListView()
    }
    .fullScreenCover(item: $deepLinkedSession) { session in
      SessionRunView(session: session, autoStart: true)
    }
    .onOpenURL { url in
      guard let id = sessionId(fromDeepLinkURL: url),
            let session = WorkoutStore.shared.fetchSession(id: id) else { return }
      deepLinkedSession = session
    }
  }
}

#Preview {
  ContentView()
}
```

- [ ] **Step 9: Register the `hiitwatch` URL scheme**

In `ios/ClearHiiTWatch Watch App/Info.plist`, replace:

```xml
	<key>NSHealthShareUsageDescription</key>
```

with:

```xml
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>hiitwatch</string>
			</array>
		</dict>
	</array>
	<key>NSHealthShareUsageDescription</key>
```

- [ ] **Step 10: Build the watch scheme**

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination "platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)" 2>&1 | tail -20`
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 11: Run the full test suite for regressions**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests 2>&1 | tail -15`
Expected: `** TEST SUCCEEDED **`, 60/60 tests passing (56 from Task 1 + 4 new).

- [ ] **Step 12: Commit**

```bash
git add ios/Shared/DeepLink.swift ios/ClearHiiTTests/DeepLinkTests.swift ios/Shared/WorkoutModels.swift "ios/ClearHiiTWatch Watch App/SessionRunView.swift" "ios/ClearHiiTWatch Watch App/ContentView.swift" "ios/ClearHiiTWatch Watch App/Info.plist" ios/ClearHiiT.xcodeproj/project.pbxproj
git commit -m "feat: deep-link a session straight into its countdown, record last-run on start"
```

---

### Task 3: The `RecentSessionComplication` widget extension

**Files:**
- Create (via Xcode wizard, Step 1): `ClearHiiTWatchComplication/ClearHiiTWatchComplicationBundle.swift`, `ClearHiiTWatchComplication/ClearHiiTWatchComplication.swift`, `ClearHiiTWatchComplication/Info.plist`, `ClearHiiTWatchComplication/Assets.xcassets`
- Modify: `ios/ClearHiiTWatch Watch App/ClearHiiTWatch Watch App.entitlements` (add the App Group)
- Modify: the new target's entitlements file (add the same App Group)
- Modify: `ClearHiiTWatchComplication/ClearHiiTWatchComplication.swift` (replace the Xcode-generated placeholder with the real widget)

**Interfaces:**
- Consumes: `RecentSessionStore.fetch()`, `RecentSession`, `recentSessionWidgetKind` (Task 1); the `hiitwatch://run?id=<id>` URL format (Task 2's `Global Constraints` contract).
- Produces: the installed `RecentSessionComplication` widget itself — nothing further in this plan consumes it.

- [ ] **Step 1 (human): Create the widget extension target and wire up the App Group**

1. In Xcode, select the `ClearHiiT` project in the navigator → the `+` button at the bottom of the target list → **watchOS → Widget Extension**.
2. Product Name: `ClearHiiTWatchComplication` (exact spelling matters — later steps assume this).
3. Team: `KM666T7T27` (same as the other targets).
4. **Uncheck** "Include Configuration App Intent" (this is a static widget, no user configuration).
5. "Embed in Application": `ClearHiiTWatch Watch App`.
6. Click Finish, and when Xcode asks to activate the new scheme, click Activate.
7. Select the new `ClearHiiTWatchComplication` target → **Signing & Capabilities** tab → **+ Capability** → **App Groups** → check `group.com.georgefromgib.hiittimer` (it should already be listed since the phone target declares it; if not listed, click `+` and add it manually with that exact identifier).
8. Select the `ClearHiiTWatch Watch App` target → **Signing & Capabilities** tab → **+ Capability** → **App Groups** → check `group.com.georgefromgib.hiittimer` the same way (this target has no App Group yet).
9. In the Project Navigator, select `ios/Shared/RecentSessionStore.swift` → open the File Inspector (right-hand panel) → under "Target Membership", check `ClearHiiTWatchComplication` (it should already be checked for `ClearHiiTWatch Watch App` and `ClearHiiTTests` from Task 1).

Hand control back once these 9 steps are done.

- [ ] **Step 2: Verify the entitlements files were updated**

Run: `cat "ios/ClearHiiTWatch Watch App/ClearHiiTWatch Watch App.entitlements"` and `cat ios/ClearHiiTWatchComplication/ClearHiiTWatchComplication.entitlements` (path may differ slightly — check the actual file Xcode created in Step 1).
Expected: both files now contain a `com.apple.security.application-groups` array with `group.com.georgefromgib.hiittimer`.

- [ ] **Step 3: Replace the placeholder widget with the real one**

Xcode's wizard generates `ClearHiiTWatchComplication/ClearHiiTWatchComplication.swift` with template `AppIntentTimelineProvider`/`SimpleEntry` boilerplate. Replace the entire contents of that file with:

```swift
// ClearHiiTWatchComplication/ClearHiiTWatchComplication.swift
import WidgetKit
import SwiftUI

struct RecentSessionEntry: TimelineEntry {
  let date: Date
  let recentSession: RecentSession?
}

struct RecentSessionProvider: TimelineProvider {
  func placeholder(in context: Context) -> RecentSessionEntry {
    RecentSessionEntry(date: Date(), recentSession: RecentSession(id: "placeholder", name: "Tabata", ranAt: Date()))
  }

  func getSnapshot(in context: Context, completion: @escaping (RecentSessionEntry) -> Void) {
    completion(RecentSessionEntry(date: Date(), recentSession: RecentSessionStore().fetch()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<RecentSessionEntry>) -> Void) {
    let entry = RecentSessionEntry(date: Date(), recentSession: RecentSessionStore().fetch())
    completion(Timeline(entries: [entry], policy: .never))
  }
}

struct RecentSessionWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: RecentSessionEntry

  var body: some View {
    switch family {
    case .accessoryCircular:
      Image(systemName: "play.fill")
        .font(.title3)
        .widgetURL(deepLinkURL)
    default:
      HStack(spacing: 4) {
        Image(systemName: "play.fill")
        Text(entry.recentSession?.name ?? "Start a workout")
          .lineLimit(1)
      }
      .widgetURL(deepLinkURL)
    }
  }

  private var deepLinkURL: URL? {
    guard let id = entry.recentSession?.id else { return nil }
    var components = URLComponents()
    components.scheme = "hiitwatch"
    components.host = "run"
    components.queryItems = [URLQueryItem(name: "id", value: id)]
    return components.url
  }
}

struct ClearHiiTWatchComplication: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: recentSessionWidgetKind, provider: RecentSessionProvider()) { entry in
      RecentSessionWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Last Workout")
    .description("One-tap restart for your most recently run session.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular])
  }
}
```

Replace the entire contents of `ClearHiiTWatchComplication/ClearHiiTWatchComplicationBundle.swift` with:

```swift
// ClearHiiTWatchComplication/ClearHiiTWatchComplicationBundle.swift
import WidgetKit
import SwiftUI

@main
struct ClearHiiTWatchComplicationBundle: WidgetBundle {
  var body: some Widget {
    ClearHiiTWatchComplication()
  }
}
```

- [ ] **Step 4: Build the watch app scheme (embeds the widget extension)**

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination "platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)" 2>&1 | tail -30`
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Run the full test suite for regressions**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests 2>&1 | tail -15`
Expected: `** TEST SUCCEEDED **`, 60/60 tests passing (unchanged from Task 2 — this task adds no new pure-logic tests, only WidgetKit UI/glue code).

- [ ] **Step 6: Manual on-device verification (human-only, Step 8-style checklist)**

Not attempted by subagents — requires a physical watch with the complication added to a watch face or Smart Stack:
1. Run any session to completion (or just start one) so `RecentSessionStore` has data.
2. Add the "Last Workout" complication to a watch face, or check the Smart Stack.
3. Confirm it shows the session name just run.
4. Tap it — confirm the watch app opens directly into the 3-2-1 countdown for that session, not the Sessions list.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add RecentSessionComplication watch face / Smart Stack widget"
```
