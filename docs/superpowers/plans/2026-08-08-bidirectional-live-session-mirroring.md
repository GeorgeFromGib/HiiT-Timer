# Bidirectional Live Session Mirroring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A session started on either the phone or the watch auto-launches into the running view on the *other* device immediately (no confirmation prompt), and pause/resume/skip/finish taken on either device mirror to the other within a couple of seconds while both apps are open.

**Architecture:** This extends the existing one-way "resume on open" handoff (`docs/superpowers/plans/2026-07-30-watch-live-handoff.md`, phone → watch only, manual confirmation dialog) into a symmetric, automatic, two-way channel. Every outbound broadcast (on both platforms) sends the same `{sessionId, name, elapsed, status, updatedAt}` shape two ways at once: `WCSession.updateApplicationContext` (persisted, delivered on next activation — the existing catch-up path, unchanged) *and* `WCSession.sendMessage` when reachable (interactive, near-instant, silently dropped if the counterpart isn't reachable — safe because the applicationContext send never fails to persist the same state). A single pure reconciliation rule — `nextLiveSessionAction` (Swift) / `nextLiveSessionAction` (TypeScript, identical logic) — decides, for any incoming update, whether to `ignore` it (stale, or older than the last one already applied), `applyToCurrent` (same session already showing — fold in the status/elapsed), or `launchNew` (different or no session showing — auto-launch it). "Most recent action wins" falls out of this rule directly: an incoming update is only acted on if its `updatedAt` is newer than the last one this device applied.

Feedback loops are avoided differently per platform because of how each broadcasts: on watch, outbound sends live only at explicit call sites (button taps, a 2s heartbeat while running) and `applyIncomingLiveState` always calls the raw `WorkoutTimerEngine` methods directly — never the broadcasting wrapper — so there is nothing to loop. On JS, the existing outbound broadcast is a single `useEffect` keyed on `[status, elapsed]`, so applying a remote update (which itself changes `status`/`elapsed`) would normally re-fire it; a one-shot `isApplyingRemoteRef` guard flag suppresses exactly the one broadcast that would otherwise echo an applied remote change back to its sender.

**Tech Stack:** WatchConnectivity (`WCSession`, `WCSessionDelegate`), `RCTEventEmitter` (new — first native→JS event emitter in this codebase), Swift, SwiftUI, XCTest, TypeScript, Jest.

## Global Constraints

- watchOS deployment target stays `10.0` (existing project setting — do not change).
- `xcodebuild test` destination on this machine is `platform=iOS Simulator,name=iPhone 17`; `xcodebuild build` for the watch scheme uses `platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)`; the phone scheme builds with `xcodebuild build -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17'`.
- Baseline test counts going into this plan (verified by running the suites before starting): **78 XCTests** (`ClearHiiTTests`, all passing) and **553 Jest tests** (37 suites, all passing).
- Every file this plan touches already exists and is already registered in `ios/ClearHiiT.xcodeproj/project.pbxproj` — **no new files are created and no `project.pbxproj` edits are needed anywhere in this plan.**
- Match existing code style: 2-space indentation, no comments unless documenting a non-obvious constraint.
- **Scope boundary, flagged deliberately:** only `status` (running/paused) and `elapsed` position mirror across devices. Segment-structure edits made mid-run (`+5s`/`+10s` extend, `+1 round`) stay local to whichever device made them — mirroring workout *structure* changes would require broadcasting the full segment array and reconciling two independently-edited segment lists, which is out of scope here. If the segments drift between devices, `elapsed`/`status` mirroring still works (each device's own `WorkoutTimerEngine`/`useTimerEngine` looks up its own segment at the shared elapsed), it just may land on a different phase locally after an extend. Revisit if this turns out to matter in practice.
- **Scope boundary:** HealthKit recording stays fully independent per device — this plan does not touch `WorkoutSessionCoordinator`/`HealthKitWorkoutManager`. Each device keeps recording its own copy regardless of mirroring, same as today.
- **Transport, both platforms:** every outbound broadcast calls `updateApplicationContext` (always) and, when `WCSession.default.isReachable`, also `sendMessage` with the identical payload (best-effort, errors ignored — the applicationContext call already guarantees eventual delivery, so a dropped `sendMessage` only costs latency, never correctness).
- No i18n needed — this plan removes the watch's existing "Resume from iPhone?" `confirmationDialog` entirely (replaced by silent auto-launch) and adds no new user-facing strings on either platform.

---

### Task 1: `LiveSessionState.swift` — the shared reconciliation rule

**Files:**
- Modify: `ios/Shared/LiveSessionState.swift`
- Modify: `ios/ClearHiiTTests/LiveSessionStateTests.swift`

**Interfaces:**
- Consumes: nothing new (builds on the existing `LiveSessionState`, `isLiveSessionFresh`, `resumeElapsed` in this file).
- Produces: `enum LiveSessionAction: Equatable { case ignore; case applyToCurrent(elapsed: Double, status: String); case launchNew(sessionId: String, resumeElapsed: Double) }`, `func nextLiveSessionAction(currentSessionId: String?, lastAppliedUpdatedAt: Date?, incoming: LiveSessionState, now: Date) -> LiveSessionAction`. Task 10's `EngineHolder` and Task 11's `ContentView` consume both.

- [ ] **Step 1: Write the failing tests**

Add to `ios/ClearHiiTTests/LiveSessionStateTests.swift`, inside the `LiveSessionStateTests` class, after the existing tests:

```swift

  func test_nextLiveSessionAction_staleIncoming_isIgnored() {
    let incoming = LiveSessionState(sessionId: "1", name: "Tabata", elapsed: 20, status: "running", updatedAt: Date(timeIntervalSince1970: 1000))
    let now = Date(timeIntervalSince1970: 1000 + liveSessionMaxAge + 1)
    let action = nextLiveSessionAction(currentSessionId: nil, lastAppliedUpdatedAt: nil, incoming: incoming, now: now)
    XCTAssertEqual(action, .ignore)
  }

  func test_nextLiveSessionAction_notNewerThanLastApplied_isIgnored() {
    let incoming = LiveSessionState(sessionId: "1", name: "Tabata", elapsed: 20, status: "running", updatedAt: Date(timeIntervalSince1970: 1000))
    let action = nextLiveSessionAction(currentSessionId: nil, lastAppliedUpdatedAt: Date(timeIntervalSince1970: 1000), incoming: incoming, now: Date(timeIntervalSince1970: 1001))
    XCTAssertEqual(action, .ignore)
  }

  func test_nextLiveSessionAction_noCurrentSession_launchesNew() {
    let incoming = LiveSessionState(sessionId: "1", name: "Tabata", elapsed: 20, status: "paused", updatedAt: Date(timeIntervalSince1970: 1000))
    let action = nextLiveSessionAction(currentSessionId: nil, lastAppliedUpdatedAt: nil, incoming: incoming, now: Date(timeIntervalSince1970: 1000))
    XCTAssertEqual(action, .launchNew(sessionId: "1", resumeElapsed: 20))
  }

  func test_nextLiveSessionAction_differentCurrentSession_launchesNew() {
    let incoming = LiveSessionState(sessionId: "2", name: "Sprint", elapsed: 5, status: "paused", updatedAt: Date(timeIntervalSince1970: 1000))
    let action = nextLiveSessionAction(currentSessionId: "1", lastAppliedUpdatedAt: nil, incoming: incoming, now: Date(timeIntervalSince1970: 1000))
    XCTAssertEqual(action, .launchNew(sessionId: "2", resumeElapsed: 5))
  }

  func test_nextLiveSessionAction_sameCurrentSession_appliesToCurrent() {
    let incoming = LiveSessionState(sessionId: "1", name: "Tabata", elapsed: 20, status: "running", updatedAt: Date(timeIntervalSince1970: 1000))
    let now = Date(timeIntervalSince1970: 1004)
    let action = nextLiveSessionAction(currentSessionId: "1", lastAppliedUpdatedAt: nil, incoming: incoming, now: now)
    XCTAssertEqual(action, .applyToCurrent(elapsed: 24, status: "running"))
  }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/LiveSessionStateTests 2>&1 | tail -30`
Expected: build failure — `cannot find 'LiveSessionAction' in scope` / `cannot find 'nextLiveSessionAction' in scope`.

- [ ] **Step 3: Write the implementation**

Append to `ios/Shared/LiveSessionState.swift`:

```swift

enum LiveSessionAction: Equatable {
  case ignore
  case applyToCurrent(elapsed: Double, status: String)
  case launchNew(sessionId: String, resumeElapsed: Double)
}

/// Central reconciliation rule shared by both "nothing is showing, should I
/// auto-launch?" (watch's ContentView / phone's App.tsx, currentSessionId
/// nil) and "already showing this live session, should I fold in a
/// status/elapsed update from the other device?" (SessionRunView's
/// EngineHolder, currentSessionId set) call sites. The identical rule is
/// ported to TypeScript in src/lib/liveSessionSync.ts for the phone JS side.
/// Most-recent-timestamp-wins: an incoming update is only acted on if it's
/// newer than the last one this device already applied, so two devices
/// trading heartbeats never fight over which state is current.
func nextLiveSessionAction(
  currentSessionId: String?,
  lastAppliedUpdatedAt: Date?,
  incoming: LiveSessionState,
  now: Date
) -> LiveSessionAction {
  guard isLiveSessionFresh(incoming, now: now) else { return .ignore }
  if let lastAppliedUpdatedAt, incoming.updatedAt <= lastAppliedUpdatedAt { return .ignore }
  let elapsed = resumeElapsed(for: incoming, now: now)
  if let currentSessionId, currentSessionId == incoming.sessionId {
    return .applyToCurrent(elapsed: elapsed, status: incoming.status)
  }
  return .launchNew(sessionId: incoming.sessionId, resumeElapsed: elapsed)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/LiveSessionStateTests 2>&1 | tail -30`
Expected: `** TEST SUCCEEDED **`, 12/12 tests passing (7 existing + 5 new).

- [ ] **Step 5: Commit**

```bash
git add ios/Shared/LiveSessionState.swift ios/ClearHiiTTests/LiveSessionStateTests.swift
git commit -m "feat: add nextLiveSessionAction reconciliation rule for bidirectional mirroring"
```

---

### Task 2: `WorkoutTimerEngine.applyRemoteElapsed(_:)` — reconcile elapsed without touching status

**Files:**
- Modify: `ios/Shared/WorkoutTimerEngine.swift`
- Modify: `ios/ClearHiiTTests/WorkoutTimerEngineTests.swift`

**Interfaces:**
- Consumes: nothing new.
- Produces: `WorkoutTimerEngine.applyRemoteElapsed(_ elapsed: Double)`. Task 10's `EngineHolder.applyIncomingLiveState` consumes this.

- [ ] **Step 1: Write the failing tests**

Add to `ios/ClearHiiTTests/WorkoutTimerEngineTests.swift`, inside the `WorkoutTimerEngineTests` class:

```swift

  func test_applyRemoteElapsed_whileRunning_jumpsElapsedAndKeepsRunning() {
    var now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    engine.start()
    now = Date(timeIntervalSince1970: 1005)
    engine.applyRemoteElapsed(20) // inside the "work" segment (index 1, 10...30)
    XCTAssertEqual(engine.state.status, .running)
    XCTAssertEqual(engine.state.currentIndex, 1)
    XCTAssertEqual(engine.state.elapsed, 20, accuracy: 0.001)
  }

  func test_applyRemoteElapsed_whilePaused_setsElapsedWithoutResuming() {
    let now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    engine.start()
    engine.pause()
    engine.applyRemoteElapsed(5)
    XCTAssertEqual(engine.state.status, .paused)
    XCTAssertEqual(engine.state.elapsed, 5, accuracy: 0.001)
  }

  func test_applyRemoteElapsed_whileIdle_isNoOp() {
    let now = Date(timeIntervalSince1970: 1000)
    let engine = WorkoutTimerEngine(segments: makeSegments(), now: { now })
    engine.applyRemoteElapsed(5)
    XCTAssertEqual(engine.state.status, .idle)
    XCTAssertEqual(engine.state.elapsed, 0, accuracy: 0.001)
  }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/WorkoutTimerEngineTests 2>&1 | tail -30`
Expected: build failure — `value of type 'WorkoutTimerEngine' has no member 'applyRemoteElapsed'`.

- [ ] **Step 3: Write the implementation**

In `ios/Shared/WorkoutTimerEngine.swift`, replace:

```swift
  func skip() {
```

with:

```swift
  /// Jumps elapsed to a value reported by the other device (e.g. a remote
  /// skip) without changing running/paused status — that's applied
  /// separately via pause()/resume() so a status-only update doesn't also
  /// yank elapsed. No-ops when idle/finished, matching skip()'s guard.
  func applyRemoteElapsed(_ elapsed: Double) {
    guard state.status == .running || state.status == .paused else { return }
    accumulated = elapsed
    resumeEpoch = now()
    tick()
  }

  func skip() {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests/WorkoutTimerEngineTests 2>&1 | tail -30`
Expected: `** TEST SUCCEEDED **`, 19/19 tests passing (16 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add ios/Shared/WorkoutTimerEngine.swift ios/ClearHiiTTests/WorkoutTimerEngineTests.swift
git commit -m "feat: add WorkoutTimerEngine.applyRemoteElapsed for cross-device sync"
```

---

### Task 3: Phone native module — receive updates, add interactive send

**Files:**
- Modify: `ios/ClearHiiT/LiveSessionSyncModule.swift`
- Modify: `ios/ClearHiiT/LiveSessionSyncModule.m`

**Interfaces:**
- Consumes: nothing new.
- Produces: a `"LiveSessionUpdate"` JS event (body: the same `{sessionId, name, elapsed, status, updatedAt}` dict, or `{}` on clear) emitted whenever the watch broadcasts. `updateLiveSession` now also sends interactively when reachable. Task 4's `src/lib/liveSessionSync.ts` (`subscribeToLiveSessionUpdates`) consumes the event.

No unit tests — `WCSession`/`RCTEventEmitter` glue isn't unit-testable without a real device/simulator pair, matching the existing precedent for this module. Verified by a successful phone-target build.

- [ ] **Step 1: Rewrite `LiveSessionSyncModule.swift`**

Replace the full contents of `ios/ClearHiiT/LiveSessionSyncModule.swift`:

```swift
// ios/ClearHiiT/LiveSessionSyncModule.swift
import Foundation
import WatchConnectivity

@objc(LiveSessionSync)
class LiveSessionSync: RCTEventEmitter, WCSessionDelegate {
  private static var didActivate = false
  private var hasListeners = false

  override func supportedEvents() -> [String]! {
    ["LiveSessionUpdate"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

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
    if WCSession.default.isReachable {
      WCSession.default.sendMessage(context, replyHandler: nil, errorHandler: nil)
    }
  }

  @objc
  func clearLiveSession() {
    ensureActivated()
    guard WCSession.isSupported() else { return }
    try? WCSession.default.updateApplicationContext([:])
  }

  private func forwardToJS(_ payload: [String: Any]) {
    guard hasListeners else { return }
    DispatchQueue.main.async { [weak self] in
      self?.sendEvent(withName: "LiveSessionUpdate", body: payload)
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: (any Error)?) {}
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) {
    WCSession.default.activate()
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    forwardToJS(applicationContext)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    forwardToJS(message)
  }

  @objc
  override static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
```

- [ ] **Step 2: Update the bridging file**

Replace the full contents of `ios/ClearHiiT/LiveSessionSyncModule.m`:

```objc
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(LiveSessionSync, RCTEventEmitter)

RCT_EXTERN_METHOD(updateLiveSession:(NSString *)sessionId name:(NSString *)name elapsed:(double)elapsed status:(NSString *)status)

RCT_EXTERN_METHOD(clearLiveSession)

@end
```

- [ ] **Step 3: Build the phone scheme to verify it compiles**

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' 2>&1 | tail -30`
Expected: `** BUILD SUCCEEDED **`. If it fails with `'requiresMainQueueSetup' overrides ... without 'override'`-type errors, adjust the `override` keyword placement on `requiresMainQueueSetup` to match what the compiler reports rather than removing the method — `RCTEventEmitter` requires it be present either way.

- [ ] **Step 4: Commit**

```bash
git add ios/ClearHiiT/LiveSessionSyncModule.swift ios/ClearHiiT/LiveSessionSyncModule.m
git commit -m "feat: receive watch-originated live session updates on the phone"
```

---

### Task 4: `liveSessionSync.ts` — reconciliation rule, event parsing, subscription (TDD)

**Files:**
- Modify: `src/lib/liveSessionSync.ts`
- Modify: `src/lib/__tests__/liveSessionSync.test.ts`

**Interfaces:**
- Consumes: the `"LiveSessionUpdate"` native event (Task 3).
- Produces: `interface LiveSessionState { sessionId: string; name: string; elapsed: number; status: 'running' | 'paused'; updatedAt: number }`, `type LiveSessionAction = { type: 'ignore' } | { type: 'applyToCurrent'; elapsed: number; status: 'running' | 'paused' } | { type: 'launchNew'; sessionId: string; resumeElapsed: number }`, `resumeElapsedFor(state, nowMs): number`, `isLiveSessionFresh(state, nowMs): boolean`, `nextLiveSessionAction(currentSessionId, lastAppliedUpdatedAt, incoming, nowMs): LiveSessionAction`, `parseLiveSessionState(event: unknown): LiveSessionState | null`, `subscribeToLiveSessionUpdates(callback: (state: LiveSessionState | null) => void): () => void`. Task 7's `App.tsx` and Task 8's `WorkoutScreen.tsx` consume all of these.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/liveSessionSync.test.ts`:

```typescript

import {
  type LiveSessionState,
  resumeElapsedFor,
  isLiveSessionFresh,
  nextLiveSessionAction,
  parseLiveSessionState,
  subscribeToLiveSessionUpdates,
  LIVE_SESSION_MAX_AGE_MS,
} from '../liveSessionSync';

describe('resumeElapsedFor', () => {
  it('adds the wall-clock gap while running', () => {
    const state: LiveSessionState = { sessionId: '1', name: 'Tabata', elapsed: 20, status: 'running', updatedAt: 1000 };
    expect(resumeElapsedFor(state, 1_008_000)).toBeCloseTo(28, 3);
  });

  it('ignores the wall-clock gap while paused', () => {
    const state: LiveSessionState = { sessionId: '1', name: 'Tabata', elapsed: 20, status: 'paused', updatedAt: 1000 };
    expect(resumeElapsedFor(state, 1_008_000)).toBe(20);
  });
});

describe('isLiveSessionFresh', () => {
  it('is true within the max age', () => {
    const state: LiveSessionState = { sessionId: '1', name: 'Tabata', elapsed: 20, status: 'paused', updatedAt: 1000 };
    expect(isLiveSessionFresh(state, 1000 * 1000 + LIVE_SESSION_MAX_AGE_MS - 1)).toBe(true);
  });

  it('is false beyond the max age', () => {
    const state: LiveSessionState = { sessionId: '1', name: 'Tabata', elapsed: 20, status: 'paused', updatedAt: 1000 };
    expect(isLiveSessionFresh(state, 1000 * 1000 + LIVE_SESSION_MAX_AGE_MS + 1)).toBe(false);
  });
});

describe('nextLiveSessionAction', () => {
  const base: LiveSessionState = { sessionId: '1', name: 'Tabata', elapsed: 20, status: 'running', updatedAt: 1000 };

  it('ignores a stale incoming update', () => {
    const action = nextLiveSessionAction(null, null, base, 1000 * 1000 + LIVE_SESSION_MAX_AGE_MS + 1);
    expect(action).toEqual({ type: 'ignore' });
  });

  it('ignores an update no newer than the last applied one', () => {
    const action = nextLiveSessionAction(null, 1000, base, 1_001_000);
    expect(action).toEqual({ type: 'ignore' });
  });

  it('launches a new session when nothing is currently showing', () => {
    const paused = { ...base, status: 'paused' as const };
    const action = nextLiveSessionAction(null, null, paused, 1_000_000);
    expect(action).toEqual({ type: 'launchNew', sessionId: '1', resumeElapsed: 20 });
  });

  it('launches a new session when a different session is currently showing', () => {
    const action = nextLiveSessionAction('2', null, base, 1_000_000);
    expect(action).toEqual({ type: 'launchNew', sessionId: '1', resumeElapsed: 20 });
  });

  it('applies to the current session when the ids match', () => {
    const action = nextLiveSessionAction('1', null, base, 1_004_000);
    expect(action).toEqual({ type: 'applyToCurrent', elapsed: 24, status: 'running' });
  });
});

describe('parseLiveSessionState', () => {
  it('parses a valid event', () => {
    const event = { sessionId: '1', name: 'Tabata', elapsed: 20, status: 'running', updatedAt: 1000 };
    expect(parseLiveSessionState(event)).toEqual(event);
  });

  it('returns null for a cleared/empty context', () => {
    expect(parseLiveSessionState({})).toBeNull();
  });

  it('returns null for an invalid status value', () => {
    const event = { sessionId: '1', name: 'Tabata', elapsed: 20, status: 'bogus', updatedAt: 1000 };
    expect(parseLiveSessionState(event)).toBeNull();
  });
});

describe('subscribeToLiveSessionUpdates', () => {
  it('returns a no-op unsubscribe when the native module is unavailable', () => {
    NativeModules.LiveSessionSync = undefined;
    const unsubscribe = subscribeToLiveSessionUpdates(jest.fn());
    expect(() => unsubscribe()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/__tests__/liveSessionSync.test.ts 2>&1 | tail -30`
Expected: FAIL — `nextLiveSessionAction is not a function` (and similar for the other new exports).

- [ ] **Step 3: Write the implementation**

Replace the full contents of `src/lib/liveSessionSync.ts`:

```typescript
import { NativeEventEmitter, NativeModules } from 'react-native';

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
 * otherwise at most once per `minIntervalMs` while running — a steady
 * periodic heartbeat that keeps the broadcast's `updatedAt` fresh (so
 * isLiveSessionFresh doesn't expire a still-running session) and corrects
 * drift for a freshly-opened counterpart.
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

/** Snapshot of the other device's live session, as broadcast over WatchConnectivity. */
export interface LiveSessionState {
  sessionId: string;
  name: string;
  elapsed: number;
  status: 'running' | 'paused';
  updatedAt: number; // epoch seconds — matches native Date().timeIntervalSince1970
}

export type LiveSessionAction =
  | { type: 'ignore' }
  | { type: 'applyToCurrent'; elapsed: number; status: 'running' | 'paused' }
  | { type: 'launchNew'; sessionId: string; resumeElapsed: number };

export const LIVE_SESSION_MAX_AGE_MS = 120_000;

/** Where this device should resume: the reported elapsed, plus whatever
 * wall-clock time has passed since if the other device was still running —
 * never trust a stored counter, recompute from wall clock. A paused session
 * hasn't moved, so no gap is added. Mirrors ios/Shared/LiveSessionState.swift's
 * resumeElapsed(for:now:). */
export function resumeElapsedFor(state: LiveSessionState, nowMs: number): number {
  if (state.status !== 'running') return state.elapsed;
  return state.elapsed + (nowMs - state.updatedAt * 1000) / 1000;
}

export function isLiveSessionFresh(state: LiveSessionState, nowMs: number): boolean {
  return nowMs - state.updatedAt * 1000 < LIVE_SESSION_MAX_AGE_MS;
}

/**
 * Central reconciliation rule — identical logic to Swift's
 * nextLiveSessionAction in ios/Shared/LiveSessionState.swift. See that
 * file's doc comment for the full rationale.
 */
export function nextLiveSessionAction(
  currentSessionId: string | null,
  lastAppliedUpdatedAt: number | null,
  incoming: LiveSessionState,
  nowMs: number,
): LiveSessionAction {
  if (!isLiveSessionFresh(incoming, nowMs)) return { type: 'ignore' };
  if (lastAppliedUpdatedAt !== null && incoming.updatedAt <= lastAppliedUpdatedAt) return { type: 'ignore' };
  const elapsed = resumeElapsedFor(incoming, nowMs);
  if (currentSessionId !== null && currentSessionId === incoming.sessionId) {
    return { type: 'applyToCurrent', elapsed, status: incoming.status };
  }
  return { type: 'launchNew', sessionId: incoming.sessionId, resumeElapsed: elapsed };
}

export function parseLiveSessionState(event: unknown): LiveSessionState | null {
  if (typeof event !== 'object' || event === null) return null;
  const e = event as Record<string, unknown>;
  if (
    typeof e.sessionId !== 'string' ||
    typeof e.name !== 'string' ||
    typeof e.elapsed !== 'number' ||
    (e.status !== 'running' && e.status !== 'paused') ||
    typeof e.updatedAt !== 'number'
  ) {
    return null;
  }
  return { sessionId: e.sessionId, name: e.name, elapsed: e.elapsed, status: e.status, updatedAt: e.updatedAt };
}

/**
 * Subscribes to live session updates broadcast by the watch. Fires with
 * `null` when the watch clears its broadcast (session finished/abandoned
 * there) as well as whenever an unparseable event arrives, so callers can
 * treat both the same way — nothing live to act on.
 */
export function subscribeToLiveSessionUpdates(
  callback: (state: LiveSessionState | null) => void,
): () => void {
  if (!NativeModules.LiveSessionSync) return () => {};
  const emitter = new NativeEventEmitter(NativeModules.LiveSessionSync);
  const subscription = emitter.addListener('LiveSessionUpdate', (event: unknown) => {
    callback(parseLiveSessionState(event));
  });
  return () => subscription.remove();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/__tests__/liveSessionSync.test.ts 2>&1 | tail -30`
Expected: `Tests: 21 passed, 21 total` (8 existing + 13 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/liveSessionSync.ts src/lib/__tests__/liveSessionSync.test.ts
git commit -m "feat: add live session reconciliation rule and inbound subscription to liveSessionSync"
```

---

### Task 5: `useTimerEngine.ts` — resume mid-segment, apply a remote elapsed jump (TDD)

**Files:**
- Modify: `src/hooks/useTimerEngine.ts`
- Modify: `src/hooks/__tests__/useTimerEngine.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `start(atElapsed?: number)` (default `0`, so every existing zero-arg call site keeps compiling unchanged), `applyRemoteElapsed(elapsed: number): void` added to the returned object. Task 6's `useWorkoutSession` consumes both.

- [ ] **Step 1: Write the failing tests**

Append to `src/hooks/__tests__/useTimerEngine.test.ts`, inside the `describe('useTimerEngine', ...)` block (after the existing tests, before the closing `});`):

```typescript

  it('start(atElapsed) resumes mid-segment', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));
    await act(async () => result.current.start(12));
    expect(result.current.state.status).toBe('running');
    expect(result.current.state.currentIndex).toBe(1);
    expect(result.current.state.elapsed).toBe(12);
    expect(result.current.state.remainingInSegment).toBe(6);
  });

  it('applyRemoteElapsed jumps elapsed while running without changing status', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));
    await act(async () => result.current.start());
    await act(async () => result.current.applyRemoteElapsed(15));
    expect(result.current.state.status).toBe('running');
    expect(result.current.state.currentIndex).toBe(1);
    expect(result.current.state.elapsed).toBe(15);
  });

  it('applyRemoteElapsed while idle is a no-op', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() => useTimerEngine(segments, {}));
    await act(async () => result.current.applyRemoteElapsed(5));
    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.elapsed).toBe(0);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/hooks/__tests__/useTimerEngine.test.ts 2>&1 | tail -30`
Expected: FAIL — `result.current.applyRemoteElapsed is not a function`.

- [ ] **Step 3: Write the implementation**

In `src/hooks/useTimerEngine.ts`, replace:

```typescript
  const start = useCallback(() => {
    accumulatedRef.current = 0;
    resumeEpochRef.current = Date.now();
    statusRef.current = 'running';
    lastIndexRef.current = -1;
    clearBeats();
    startLoop();
  }, [startLoop]);
```

with:

```typescript
  const start = useCallback((atElapsed = 0) => {
    accumulatedRef.current = atElapsed;
    resumeEpochRef.current = Date.now();
    statusRef.current = 'running';
    lastIndexRef.current = -1;
    clearBeats();
    startLoop();
  }, [startLoop]);

  /** Jumps elapsed to a value reported by the other device (e.g. a remote
   * skip) without changing running/paused status. No-ops when idle/finished. */
  const applyRemoteElapsed = useCallback((elapsed: number) => {
    if (statusRef.current !== 'running' && statusRef.current !== 'paused') return;
    accumulatedRef.current = elapsed;
    resumeEpochRef.current = Date.now();
    tick();
  }, [tick]);
```

Then, still in `src/hooks/useTimerEngine.ts`, replace:

```typescript
  return { state, start, pause, resume, reset, skip, skipBack, extend, replaceSegments, getSegments, sync: tick };
```

with:

```typescript
  return { state, start, pause, resume, reset, skip, skipBack, extend, replaceSegments, getSegments, sync: tick, applyRemoteElapsed };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/hooks/__tests__/useTimerEngine.test.ts 2>&1 | tail -30`
Expected: all tests in the file pass, 3 more than before this task.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTimerEngine.ts src/hooks/__tests__/useTimerEngine.test.ts
git commit -m "feat: support resuming mid-segment and applying a remote elapsed jump in useTimerEngine"
```

---

### Task 6: `useWorkoutSession.ts` — seed an initial resume, apply incoming live state (TDD)

**Files:**
- Modify: `src/hooks/useWorkoutSession.ts`
- Modify: `src/hooks/__tests__/useWorkoutSession.test.ts`

**Interfaces:**
- Consumes: `start(atElapsed?)`, `applyRemoteElapsed(elapsed)` (Task 5).
- Produces: a 5th parameter `initialResume?: { elapsed: number; status: 'running' | 'paused' }` (starts the engine already running/paused at that elapsed, skipping the 3-2-1 pre-start countdown), and `applyIncomingLiveState(status: 'running' | 'paused', elapsed: number): void` added to the `WorkoutSession` interface. Task 8's `WorkoutScreen.tsx` consumes both.

- [ ] **Step 1: Write the failing tests**

Append to `src/hooks/__tests__/useWorkoutSession.test.ts`, inside the `describe('useWorkoutSession', ...)` block (after the existing tests, before the closing `});`):

```typescript

  it('accepts an initialResume and starts already running at that elapsed, skipping the pre-start countdown', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() =>
      useWorkoutSession(segments, DEFAULT_SETTINGS, undefined, false, { elapsed: 12, status: 'running' }));
    expect(result.current.status).toBe('running');
    expect(result.current.elapsed).toBe(12);
    expect(result.current.currentIndex).toBe(1);
  });

  it('accepts an initialResume with status paused and starts paused at that elapsed', async () => {
    const segments = twoSegments();
    const { result } = await renderHook(() =>
      useWorkoutSession(segments, DEFAULT_SETTINGS, undefined, false, { elapsed: 4, status: 'paused' }));
    expect(result.current.status).toBe('paused');
    expect(result.current.elapsed).toBe(4);
  });

  describe('applyIncomingLiveState', () => {
    it('pauses locally when told the remote is now paused', async () => {
      const segments = twoSegments();
      const { result } = await renderHook(() => useWorkoutSession(segments));
      await startWorkout(result);

      await act(async () => result.current.applyIncomingLiveState('paused', result.current.elapsed));
      expect(result.current.status).toBe('paused');
    });

    it('resumes locally when told the remote is now running', async () => {
      const segments = twoSegments();
      const { result } = await renderHook(() => useWorkoutSession(segments));
      await startWorkout(result);
      await act(async () => result.current.handlePlayPause()); // pause
      expect(result.current.status).toBe('paused');

      await act(async () => result.current.applyIncomingLiveState('running', result.current.elapsed));
      expect(result.current.status).toBe('running');
    });

    it('jumps elapsed to match a remote skip while running', async () => {
      const segments = twoSegments();
      const { result } = await renderHook(() => useWorkoutSession(segments));
      await startWorkout(result);

      await act(async () => result.current.applyIncomingLiveState('running', 15));
      expect(result.current.status).toBe('running');
      expect(result.current.elapsed).toBe(15);
      expect(result.current.currentIndex).toBe(1);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/hooks/__tests__/useWorkoutSession.test.ts 2>&1 | tail -30`
Expected: FAIL — `result.current.applyIncomingLiveState is not a function` (and a TS error on the 5th argument once Step 3 hasn't run yet).

- [ ] **Step 3: Write the implementation**

In `src/hooks/useWorkoutSession.ts`, replace:

```typescript
export function useWorkoutSession(
  segments: Segment[],
  settings: Settings = DEFAULT_SETTINGS,
  onCountdownBeat?: () => void,
  enableMidpointCue = false,
): WorkoutSession {
```

with:

```typescript
export function useWorkoutSession(
  segments: Segment[],
  settings: Settings = DEFAULT_SETTINGS,
  onCountdownBeat?: () => void,
  enableMidpointCue = false,
  initialResume?: { elapsed: number; status: 'running' | 'paused' },
): WorkoutSession {
```

Then replace:

```typescript
  const {
    state, start, pause, resume, reset: engineReset,
    skip: engineSkip, skipBack: engineSkipBack, extend: engineExtend,
    replaceSegments, getSegments,
  } = useTimerEngine(segments, {
```

with:

```typescript
  const {
    state, start, pause, resume, reset: engineReset,
    skip: engineSkip, skipBack: engineSkipBack, extend: engineExtend,
    replaceSegments, getSegments, applyRemoteElapsed,
  } = useTimerEngine(segments, {
```

Then replace:

```typescript
  const countdown = usePreStartCountdown({
    onTick: () => cues.onPreStartTick(),
    onComplete: () => { cues.startKeepAlive(); start(); },
  });
```

with:

```typescript
  const countdown = usePreStartCountdown({
    onTick: () => cues.onPreStartTick(),
    onComplete: () => { cues.startKeepAlive(); start(); },
  });

  const hasAutoResumedRef = useRef(false);
  useEffect(() => {
    if (!initialResume || hasAutoResumedRef.current) return;
    hasAutoResumedRef.current = true;
    cues.startKeepAlive();
    start(initialResume.elapsed);
    if (initialResume.status === 'paused') pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyIncomingLiveState = useCallback((incomingStatus: 'running' | 'paused', incomingElapsed: number) => {
    if (state.status !== 'running' && state.status !== 'paused') return;
    if (incomingStatus === 'paused' && state.status === 'running') pause();
    else if (incomingStatus === 'running' && state.status === 'paused') resume();
    if (incomingStatus === 'paused' || Math.abs(state.elapsed - incomingElapsed) > 2) {
      applyRemoteElapsed(incomingElapsed);
    }
  }, [state.status, state.elapsed, pause, resume, applyRemoteElapsed]);
```

Then replace:

```typescript
  return {
    status: countdown.count !== null ? 'preStart' : state.status,
    preStartCount: countdown.count,
    elapsed: state.elapsed,
    currentIndex: state.currentIndex,
    remainingInSegment: state.remainingInSegment,
    remainingTotal: state.remainingTotal,
    congratsMsg,
    stats,
    handlePlayPause,
    reset,
    skip,
    skipBack,
    extend,
    addRound,
  };
}
```

with:

```typescript
  return {
    status: countdown.count !== null ? 'preStart' : state.status,
    preStartCount: countdown.count,
    elapsed: state.elapsed,
    currentIndex: state.currentIndex,
    remainingInSegment: state.remainingInSegment,
    remainingTotal: state.remainingTotal,
    congratsMsg,
    stats,
    handlePlayPause,
    reset,
    skip,
    skipBack,
    extend,
    addRound,
    applyIncomingLiveState,
  };
}
```

Finally, add `applyIncomingLiveState: (status: 'running' | 'paused', elapsed: number) => void;` to the `WorkoutSession` interface, right after `addRound: (segsToInsert: Segment[]) => Segment[];`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/hooks/__tests__/useWorkoutSession.test.ts 2>&1 | tail -30`
Expected: all tests in the file pass, 5 more than before this task.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useWorkoutSession.ts src/hooks/__tests__/useWorkoutSession.test.ts
git commit -m "feat: support seeding an initial resume and applying incoming live state in useWorkoutSession"
```

---

### Task 7: `navigation.ts` + `App.tsx` — subscribe, reconcile, auto-navigate

**Files:**
- Modify: `src/navigation.ts`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `subscribeToLiveSessionUpdates`, `nextLiveSessionAction`, `type LiveSessionState` (Task 4); `loadSessions` (pre-existing, `src/lib/sessions.ts`).
- Produces: `Route`'s `'Workout'` variant gains `initialResumeElapsed?: number; initialStatus?: 'running' | 'paused'`. `App.tsx` passes `initialResumeElapsed`, `initialStatus`, `incomingLiveSession`, and `onLiveSessionDismiss` props into `WorkoutScreen`. Task 8's `WorkoutScreen.tsx` consumes all four.

No new unit test — App.tsx has no existing test precedent (no `App.test.tsx` in this repo) and this is pure navigation-orchestration glue over already-tested pure functions (Task 4) and an RN native event subscription. Verified by typecheck and the Task 12 regression pass.

- [ ] **Step 1: Extend the `Workout` route**

In `src/navigation.ts`, replace:

```typescript
  | { name: 'Workout'; session: Session }
```

with:

```typescript
  | { name: 'Workout'; session: Session; initialResumeElapsed?: number; initialStatus?: 'running' | 'paused' }
```

- [ ] **Step 2: Add imports**

In `App.tsx`, replace:

```typescript
import { useEffect, useState, type ReactNode } from 'react';
```

with:

```typescript
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
```

Then replace:

```typescript
import { checkForUpdate } from './src/lib/versionCheck';
```

with:

```typescript
import { checkForUpdate } from './src/lib/versionCheck';
import { loadSessions } from './src/lib/sessions';
import { subscribeToLiveSessionUpdates, nextLiveSessionAction, type LiveSessionState } from './src/lib/liveSessionSync';
```

- [ ] **Step 3: Subscribe, reconcile, and auto-navigate**

In `App.tsx`, replace:

```typescript
  const { route, navigate, goBack, resetTo } = useNavigationStack({ name: 'Sessions' });
  const { settings, loading: settingsLoading, updateSettings } = useSettingsState();
  const premiumState = usePremiumState();
```

with:

```typescript
  const { route, navigate, goBack, resetTo } = useNavigationStack({ name: 'Sessions' });
  const { settings, loading: settingsLoading, updateSettings } = useSettingsState();
  const premiumState = usePremiumState();

  const [liveSessionState, setLiveSessionState] = useState<LiveSessionState | null>(null);
  const lastAppliedLiveUpdatedAtRef = useRef<number | null>(null);
  const mutedSessionIdRef = useRef<string | null>(null);
  const mutedUpdatedAtRef = useRef<number | null>(null);

  useEffect(() => subscribeToLiveSessionUpdates(setLiveSessionState), []);

  useEffect(() => {
    if (!liveSessionState) return;
    const currentSessionId = route.name === 'Workout' ? route.session.id : null;
    if (currentSessionId === liveSessionState.sessionId) return; // WorkoutScreen applies this directly
    if (
      liveSessionState.sessionId === mutedSessionIdRef.current &&
      mutedUpdatedAtRef.current !== null &&
      liveSessionState.updatedAt <= mutedUpdatedAtRef.current
    ) return;
    const action = nextLiveSessionAction(currentSessionId, lastAppliedLiveUpdatedAtRef.current, liveSessionState, Date.now());
    if (action.type !== 'launchNew') return;
    lastAppliedLiveUpdatedAtRef.current = liveSessionState.updatedAt;
    loadSessions().then(({ sessions }) => {
      const session = sessions.find(s => s.id === action.sessionId);
      if (session) navigate({ name: 'Workout', session, initialResumeElapsed: action.resumeElapsed, initialStatus: liveSessionState.status });
    });
  }, [liveSessionState, route, navigate]);

  const handleLiveSessionDismiss = useCallback((sessionId: string) => {
    mutedSessionIdRef.current = sessionId;
    mutedUpdatedAtRef.current = liveSessionState?.sessionId === sessionId ? liveSessionState.updatedAt : null;
  }, [liveSessionState]);
```

- [ ] **Step 4: Pass the new props to `WorkoutScreen`**

In `App.tsx`, replace:

```typescript
      {route.name === 'Workout' && (
        <RouteScreen><WorkoutScreen session={route.session} onBack={goBack} /></RouteScreen>
      )}
```

with:

```typescript
      {route.name === 'Workout' && (
        <RouteScreen>
          <WorkoutScreen
            session={route.session}
            onBack={goBack}
            initialResumeElapsed={route.initialResumeElapsed}
            initialStatus={route.initialStatus}
            incomingLiveSession={liveSessionState?.sessionId === route.session.id ? liveSessionState : null}
            onLiveSessionDismiss={handleLiveSessionDismiss}
          />
        </RouteScreen>
      )}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -30`
Expected: errors referencing the new `WorkoutScreen` props (fixed in Task 8) — confirm no *other* errors in `App.tsx`/`navigation.ts` itself.

- [ ] **Step 6: Commit**

```bash
git add src/navigation.ts App.tsx
git commit -m "feat: auto-navigate to a watch-started session and pass live updates into WorkoutScreen"
```

---

### Task 8: `WorkoutScreen.tsx` — resume seeding, apply incoming updates, immediate skip broadcast

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx`

**Interfaces:**
- Consumes: `resumeElapsedFor`, `type LiveSessionState` (Task 4); `applyIncomingLiveState`, `initialResume` param (Task 6); `initialResumeElapsed`, `initialStatus`, `incomingLiveSession`, `onLiveSessionDismiss` props (Task 7).
- Produces: nothing further consumed within this plan — this is the end of the phone-side wiring.

No new unit test — matches the existing no-screen-test precedent, same as the original live-handoff plan's Task 6. Verified by typecheck, the full regression suite, and the manual checklist in Task 13.

- [ ] **Step 1: Update the import and component signature**

In `src/screens/WorkoutScreen.tsx`, replace:

```typescript
import { updateLiveSession, clearLiveSession, shouldBroadcastLiveSession } from '../lib/liveSessionSync';

const EXTEND_OPTIONS = [5, 10] as const;

export default function WorkoutScreen({ session, onBack }: { session: Session; onBack: () => void }) {
```

with:

```typescript
import {
  updateLiveSession, clearLiveSession, shouldBroadcastLiveSession, resumeElapsedFor,
  type LiveSessionState,
} from '../lib/liveSessionSync';

const EXTEND_OPTIONS = [5, 10] as const;

export default function WorkoutScreen({
  session, onBack, initialResumeElapsed, initialStatus, incomingLiveSession, onLiveSessionDismiss,
}: {
  session: Session;
  onBack: () => void;
  initialResumeElapsed?: number;
  initialStatus?: 'running' | 'paused';
  incomingLiveSession?: LiveSessionState | null;
  onLiveSessionDismiss?: (sessionId: string) => void;
}) {
```

- [ ] **Step 2: Thread the initial resume into `useWorkoutSession`**

Replace:

```typescript
  const {
    status,
    preStartCount,
    elapsed,
    currentIndex,
    remainingInSegment,
    remainingTotal,
    congratsMsg,
    stats,
    handlePlayPause,
    reset: resetEngine,
    skip,
    skipBack,
    extend,
    addRound,
  } = useWorkoutSession(segments, settings, () => {
    if (!settings.countdownFlash) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashing(true);
    flashTimerRef.current = setTimeout(() => setFlashing(false), 250);
  });
```

with:

```typescript
  const initialResume = useMemo(
    () => (initialResumeElapsed !== undefined
      ? { elapsed: initialResumeElapsed, status: initialStatus ?? 'running' as const }
      : undefined),
    [initialResumeElapsed, initialStatus],
  );

  const {
    status,
    preStartCount,
    elapsed,
    currentIndex,
    remainingInSegment,
    remainingTotal,
    congratsMsg,
    stats,
    handlePlayPause,
    reset: resetEngine,
    skip,
    skipBack,
    extend,
    addRound,
    applyIncomingLiveState,
  } = useWorkoutSession(segments, settings, () => {
    if (!settings.countdownFlash) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashing(true);
    flashTimerRef.current = setTimeout(() => setFlashing(false), 250);
  }, false, initialResume);
```

- [ ] **Step 3: Mute on manual exit**

Replace:

```typescript
  const handleBackPress = useCallback(() => {
    if (status === 'running' || status === 'paused') {
      appAlert(
        'warning',
        t('alerts.exitWorkoutTitle'),
        t('alerts.exitWorkoutMessage'),
        [
          {
            text: t('alerts.continueWorkout'),
            onPress: () => {},
            style: 'cancel',
          },
          {
            text: t('alerts.terminate'),
            onPress: onBack,
            style: 'destructive',
          },
        ]
      );
    } else {
      onBack();
    }
  }, [status, onBack, t]);
```

with:

```typescript
  const handleBackPress = useCallback(() => {
    if (status === 'running' || status === 'paused') {
      appAlert(
        'warning',
        t('alerts.exitWorkoutTitle'),
        t('alerts.exitWorkoutMessage'),
        [
          {
            text: t('alerts.continueWorkout'),
            onPress: () => {},
            style: 'cancel',
          },
          {
            text: t('alerts.terminate'),
            onPress: () => { onLiveSessionDismiss?.(session.id); onBack(); },
            style: 'destructive',
          },
        ]
      );
    } else {
      onBack();
    }
  }, [status, onBack, t, onLiveSessionDismiss, session.id]);
```

- [ ] **Step 4: Apply incoming updates, guard the outbound broadcast, and broadcast skips immediately**

Replace:

```typescript
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

with:

```typescript
  const isApplyingRemoteRef = useRef(false);
  const lastAppliedRemoteUpdatedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!incomingLiveSession || incomingLiveSession.sessionId !== session.id) return;
    if (
      lastAppliedRemoteUpdatedAtRef.current !== null &&
      incomingLiveSession.updatedAt <= lastAppliedRemoteUpdatedAtRef.current
    ) return;
    lastAppliedRemoteUpdatedAtRef.current = incomingLiveSession.updatedAt;
    isApplyingRemoteRef.current = true;
    applyIncomingLiveState(incomingLiveSession.status, resumeElapsedFor(incomingLiveSession, Date.now()));
  }, [incomingLiveSession, session.id, applyIncomingLiveState]);

  const lastLiveSyncRef = useRef<number | null>(null);
  const lastLiveStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (isApplyingRemoteRef.current) { isApplyingRemoteRef.current = false; return; }
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

  const handleSkip = useCallback(() => {
    skip();
    lastLiveStatusRef.current = null; // forces the effect above to broadcast immediately, not on the next 2s heartbeat
  }, [skip]);

  const handleSkipBack = useCallback(() => {
    skipBack();
    lastLiveStatusRef.current = null;
  }, [skipBack]);
```

- [ ] **Step 5: Use the wrapped skip handlers in the controls row**

Replace:

```typescript
        {isPlaying ? (
          <GhostBtn onPress={skipBack}>
```

with:

```typescript
        {isPlaying ? (
          <GhostBtn onPress={handleSkipBack}>
```

Then replace:

```typescript
        <GhostBtn onPress={skip} disabled={isIdle || isPreStart}>
```

with:

```typescript
        <GhostBtn onPress={handleSkip} disabled={isIdle || isPreStart}>
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -30`
Expected: no errors.

- [ ] **Step 7: Run the full Jest suite for regressions**

Run: `npx jest 2>&1 | tail -15`
Expected: `Tests: 574 passed, 574 total` (553 baseline + 13 Task 4 + 3 Task 5 + 5 Task 6).

- [ ] **Step 8: Commit**

```bash
git add src/screens/WorkoutScreen.tsx
git commit -m "feat: apply incoming live session updates and broadcast skips immediately in WorkoutScreen"
```

---

### Task 9: `WatchSessionReceiver.swift` — send from the watch, receive interactive messages

**Files:**
- Modify: `ios/ClearHiiTWatch Watch App/WatchSessionReceiver.swift`

**Interfaces:**
- Consumes: nothing new.
- Produces: `WatchSessionReceiver.sendLiveSession(sessionId:name:elapsed:status:)`, `WatchSessionReceiver.clearLiveSession()`. Task 10's `EngineHolder` consumes both.

No unit tests — `WCSession` glue isn't unit-testable, matching existing precedent. Verified by the watch build in Task 10.

- [ ] **Step 1: Add outbound sending and inbound message handling**

Replace the full contents of `ios/ClearHiiTWatch Watch App/WatchSessionReceiver.swift`:

```swift
// ios/ClearHiiTWatch Watch App/WatchSessionReceiver.swift
import Combine
import Foundation
import WatchConnectivity

/// Wraps WCSession on the watch side: publishes the phone's most recently
/// broadcast live-session state (if any) so ContentView/SessionRunView can
/// react to it, and sends the watch's own live-session updates back to the
/// phone. Reads receivedApplicationContext on activation (covers "watch app
/// opened after the phone already broadcast, watch wasn't reachable at the
/// time") as well as live updates while both apps happen to be open.
final class WatchSessionReceiver: NSObject, ObservableObject, WCSessionDelegate {
  static let shared = WatchSessionReceiver()

  @Published private(set) var liveSession: LiveSessionState?

  private override init() {
    super.init()
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func sendLiveSession(sessionId: String, name: String, elapsed: Double, status: String) {
    guard WCSession.isSupported() else { return }
    let context: [String: Any] = [
      "sessionId": sessionId,
      "name": name,
      "elapsed": elapsed,
      "status": status,
      "updatedAt": Date().timeIntervalSince1970,
    ]
    try? WCSession.default.updateApplicationContext(context)
    if WCSession.default.isReachable {
      WCSession.default.sendMessage(context, replyHandler: nil, errorHandler: nil)
    }
  }

  func clearLiveSession() {
    guard WCSession.isSupported() else { return }
    try? WCSession.default.updateApplicationContext([:])
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

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    DispatchQueue.main.async {
      self.liveSession = liveSessionState(fromApplicationContext: message)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add "ios/ClearHiiTWatch Watch App/WatchSessionReceiver.swift"
git commit -m "feat: send live session updates from the watch and receive interactive messages"
```

---

### Task 10: `SessionRunView.swift` / `EngineHolder` — broadcast local actions, apply incoming updates

**Files:**
- Modify: `ios/ClearHiiTWatch Watch App/SessionRunView.swift`

**Interfaces:**
- Consumes: `WatchSessionReceiver.sendLiveSession`/`.clearLiveSession` (Task 9); `nextLiveSessionAction`, `LiveSessionAction` (Task 1); `WorkoutTimerEngine.applyRemoteElapsed` (Task 2).
- Produces: `EngineHolder.reconcileIncoming(_:sessionId:now:)`, `SessionRunView.init(..., onDismiss:)`. Task 11's `ContentView` consumes `onDismiss`.

No TDD — SwiftUI/WCSession wiring isn't unit-testable, matching the existing precedent (Task 3 of the original live-handoff plan). Verified by a successful watch build, then the manual checklist in Task 13.

- [ ] **Step 1: Add `onDismiss` and observe `WatchSessionReceiver`**

Replace:

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
  @Environment(\.isLuminanceReduced) private var isLuminanceReduced

  init(session: SessionDTO, autoStart: Bool = false, resumeElapsed: Double? = nil) {
    self.session = session
    self.autoStart = autoStart
    self.resumeElapsed = resumeElapsed
    _engineHolder = StateObject(wrappedValue: EngineHolder(session: session, segments: segmentsForSession(session)))
  }
```

with:

```swift
struct SessionRunView: View {
  let session: SessionDTO
  var autoStart: Bool = false
  var resumeElapsed: Double? = nil
  var onDismiss: (() -> Void)? = nil

  @StateObject private var engineHolder: EngineHolder
  @StateObject private var connectivity = WatchSessionReceiver.shared
  @State private var countdown: Int?
  @State private var countdownTask: Task<Void, Never>?
  @State private var runningPage: RunningPage = .timer
  @State private var hasAutoStarted = false
  @Environment(\.dismiss) private var dismiss
  @Environment(\.isLuminanceReduced) private var isLuminanceReduced

  init(session: SessionDTO, autoStart: Bool = false, resumeElapsed: Double? = nil, onDismiss: (() -> Void)? = nil) {
    self.session = session
    self.autoStart = autoStart
    self.resumeElapsed = resumeElapsed
    self.onDismiss = onDismiss
    _engineHolder = StateObject(wrappedValue: EngineHolder(session: session, segments: segmentsForSession(session)))
  }
```

- [ ] **Step 2: React to incoming updates, and call `onDismiss` on teardown**

Replace:

```swift
    .onDisappear {
      countdownTask?.cancel()
      engineHolder.discardIfUnfinished()
    }
  }
```

with:

```swift
    .onDisappear {
      countdownTask?.cancel()
      engineHolder.discardIfUnfinished()
      onDismiss?()
    }
    .onChange(of: connectivity.liveSession) { _, newValue in
      guard let live = newValue else { return }
      engineHolder.reconcileIncoming(live, sessionId: session.id, now: Date())
    }
  }
```

- [ ] **Step 3: Broadcast on the button/tap call sites**

Replace:

```swift
    func togglePause() {
      switch state.status {
      case .running: engineHolder.pause()
      case .paused: engineHolder.resume()
      case .idle, .finished: break
      }
    }
```

with:

```swift
    func togglePause() {
      switch state.status {
      case .running: engineHolder.pause()
      case .paused: engineHolder.resume()
      case .idle, .finished: break
      }
    }

    func skipAndBroadcast() {
      engineHolder.engine.skip()
      engineHolder.broadcastLiveState()
    }
```

Then replace:

```swift
        Button {
          engineHolder.engine.skip()
        } label: {
```

with:

```swift
        Button {
          skipAndBroadcast()
        } label: {
```

- [ ] **Step 4: Add broadcasting, a heartbeat, and incoming-state reconciliation to `EngineHolder`**

Replace:

```swift
private final class EngineHolder: ObservableObject {
  let engine: WorkoutTimerEngine
  let segments: [Segment]
  @Published private(set) var currentSegment: Segment?
  @Published private(set) var liveStats = WorkoutLiveStats()
  let congratsMessage: String = congratsMessages.randomElement() ?? ""
  private var cancellable: AnyCancellable?
  private let workoutSession: WorkoutSessionCoordinator
  private let session: SessionDTO
  private let recentSessionStore = RecentSessionStore()
```

with:

```swift
private final class EngineHolder: ObservableObject {
  let engine: WorkoutTimerEngine
  let segments: [Segment]
  @Published private(set) var currentSegment: Segment?
  @Published private(set) var liveStats = WorkoutLiveStats()
  let congratsMessage: String = congratsMessages.randomElement() ?? ""
  private var cancellable: AnyCancellable?
  private let workoutSession: WorkoutSessionCoordinator
  private let session: SessionDTO
  private let recentSessionStore = RecentSessionStore()
  private let connectivity = WatchSessionReceiver.shared
  private var heartbeatTimer: Timer?
  private var lastAppliedRemoteUpdatedAt: Date?
```

Then replace:

```swift
  func start(atElapsed: Double = 0) {
    recentSessionStore.record(id: session.id, name: session.name)
    engine.start(atElapsed: atElapsed)
  }

  func pause() {
    engine.pause()
  }

  func resume() {
    engine.resume()
  }

  func discardIfUnfinished() {
    workoutSession.discardIfUnfinished()
  }
}
```

with:

```swift
  func start(atElapsed: Double = 0) {
    recentSessionStore.record(id: session.id, name: session.name)
    engine.start(atElapsed: atElapsed)
    broadcastLiveState()
    startHeartbeat()
  }

  func pause() {
    engine.pause()
    broadcastLiveState()
  }

  func resume() {
    engine.resume()
    broadcastLiveState()
  }

  func broadcastLiveState() {
    guard engine.state.status == .running || engine.state.status == .paused else { return }
    let status = engine.state.status == .running ? "running" : "paused"
    connectivity.sendLiveSession(sessionId: session.id, name: session.name, elapsed: engine.state.elapsed, status: status)
  }

  private func startHeartbeat() {
    heartbeatTimer?.invalidate()
    heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
      self?.broadcastLiveState()
    }
  }

  /// Applies a status/elapsed update reported by the other device. Calls
  /// the raw engine methods directly (not the broadcasting wrappers above)
  /// so applying a remote change never re-broadcasts it back — the only
  /// outbound triggers are local button taps and the heartbeat timer.
  func applyIncomingLiveState(elapsed: Double, status: String, updatedAt: Date) {
    lastAppliedRemoteUpdatedAt = updatedAt
    switch status {
    case "running":
      if engine.state.status == .paused { engine.resume() }
      if abs(engine.state.elapsed - elapsed) > 2 { engine.applyRemoteElapsed(elapsed) }
    case "paused":
      if engine.state.status == .running { engine.pause() }
      engine.applyRemoteElapsed(elapsed)
    default:
      break
    }
  }

  func reconcileIncoming(_ live: LiveSessionState, sessionId: String, now: Date) {
    let action = nextLiveSessionAction(currentSessionId: sessionId, lastAppliedUpdatedAt: lastAppliedRemoteUpdatedAt, incoming: live, now: now)
    if case let .applyToCurrent(elapsed, status) = action {
      applyIncomingLiveState(elapsed: elapsed, status: status, updatedAt: live.updatedAt)
    }
  }

  func discardIfUnfinished() {
    heartbeatTimer?.invalidate()
    heartbeatTimer = nil
    connectivity.clearLiveSession()
    workoutSession.discardIfUnfinished()
  }
}
```

- [ ] **Step 5: Build the watch scheme to verify it compiles**

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination "platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)" 2>&1 | tail -30`
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 6: Commit**

```bash
git add "ios/ClearHiiTWatch Watch App/SessionRunView.swift"
git commit -m "feat: broadcast local session actions and apply incoming live state on the watch"
```

---

### Task 11: `ContentView.swift` — auto-launch instead of a confirmation prompt

**Files:**
- Modify: `ios/ClearHiiTWatch Watch App/ContentView.swift`

**Interfaces:**
- Consumes: `nextLiveSessionAction`, `LiveSessionAction` (Task 1); `SessionRunView.init(..., onDismiss:)` (Task 10).
- Produces: nothing further consumed within this plan — this is the watch-side auto-launch entry point.

No TDD — SwiftUI wiring, matching precedent. Verified by a successful watch build, then the manual checklist in Task 13.

- [ ] **Step 1: Replace the confirmation dialog with silent auto-launch**

Replace the full contents of `ios/ClearHiiTWatch Watch App/ContentView.swift`:

```swift
import SwiftUI
import WidgetKit

struct ContentView: View {
  @State private var deepLinkedSession: SessionDTO?
  @State private var deepLinkedResumeElapsed: Double?
  @StateObject private var connectivity = WatchSessionReceiver.shared
  @State private var mutedSessionId: String?
  @State private var mutedAsOf: Date?

  var body: some View {
    NavigationStack {
      SessionListView()
    }
    .fullScreenCover(item: $deepLinkedSession) { session in
      SessionRunView(
        session: session,
        autoStart: deepLinkedResumeElapsed == nil,
        resumeElapsed: deepLinkedResumeElapsed,
        onDismiss: {
          mutedSessionId = session.id
          mutedAsOf = connectivity.liveSession?.updatedAt
        }
      )
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
      checkForLiveSession()
    }
    .onChange(of: connectivity.liveSession) { _, _ in
      checkForLiveSession()
    }
  }

  private func checkForLiveSession() {
    guard deepLinkedSession == nil, let live = connectivity.liveSession,
          let session = WorkoutStore.shared.fetchSession(id: live.sessionId) else { return }
    if live.sessionId == mutedSessionId, let mutedAsOf, live.updatedAt <= mutedAsOf { return }
    let action = nextLiveSessionAction(currentSessionId: nil, lastAppliedUpdatedAt: nil, incoming: live, now: Date())
    guard case let .launchNew(_, resumeElapsed) = action else { return }
    deepLinkedResumeElapsed = resumeElapsed
    deepLinkedSession = session
  }
}

#Preview {
  ContentView()
}
```

- [ ] **Step 2: Build the watch scheme to verify it compiles**

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination "platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)" 2>&1 | tail -30`
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 3: Commit**

```bash
git add "ios/ClearHiiTWatch Watch App/ContentView.swift"
git commit -m "feat: auto-launch the phone's live session on the watch instead of prompting"
```

---

### Task 12: Full regression across both platforms

**Files:** none — verification only.

- [ ] **Step 1: Run the full Jest suite**

Run: `npx jest 2>&1 | tail -15`
Expected: `Tests: 574 passed, 574 total`, `Test Suites: 37 passed, 37 total`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -30`
Expected: no errors.

- [ ] **Step 3: Run the full XCTest suite**

Run: `cd ios && xcodebuild test -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:ClearHiiTTests 2>&1 | tail -15`
Expected: `** TEST SUCCEEDED **`, 86/86 tests passing (78 baseline + 5 Task 1 + 3 Task 2).

- [ ] **Step 4: Build both native targets**

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination 'platform=iOS Simulator,name=iPhone 17' 2>&1 | tail -15`
Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination "platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)" 2>&1 | tail -15`
Expected: `** BUILD SUCCEEDED **` for both.

No commit — this task only verifies work already committed in Tasks 1–11.

---

### Task 13 (manual, human only): End-to-end verification on real devices

This sandbox has no way to pair a phone and watch simulator or drive WatchConnectivity (no macOS Accessibility permission, no physical devices) — a human needs to confirm the full bidirectional flow actually works:

1. Build and run both `ClearHiiT` (phone) and `ClearHiiTWatch Watch App` on paired devices (a real device pair is more reliable for WatchConnectivity than the simulator).
2. **Phone → watch auto-launch:** start a session on the phone. Confirm the watch, if its app is open (or opened shortly after), jumps straight into the running view at the correct segment/elapsed — no "Resume?" prompt, no 3-2-1 countdown.
3. **Watch → phone auto-launch:** from the phone's Sessions list, start a *different* session on the watch instead. Confirm the phone auto-navigates into `WorkoutScreen` for that session, running, at the correct elapsed.
4. **Live pause mirroring:** with a session running and mirrored on both devices, pause on the phone. Confirm the watch reflects paused within ~2 seconds. Resume on the watch; confirm the phone reflects running within ~2 seconds.
5. **Live skip mirroring:** with a session running on both, tap skip on the watch. Confirm the phone's segment/elapsed jumps to match within ~2 seconds (should be near-instant, not waiting for the periodic heartbeat).
6. **No feedback loop:** during steps 4–5, confirm neither device's UI flickers, jumps backward, or oscillates — each mirrored change should settle once, not ping-pong.
7. **Manual dismiss is respected:** start a session on the phone, let the watch auto-launch it, then swipe/dismiss the watch's `SessionRunView` while the phone keeps running. Confirm the watch does *not* immediately re-launch the same session. Then let the phone session run a while longer (past a heartbeat) and confirm it still doesn't re-launch on the watch (mute holds) — but starting a genuinely *new* session afterwards still auto-launches normally.
8. **Staleness cutoff still works:** let a phone session run past 120 seconds without the watch app open, then open it. Confirm it still auto-launches correctly (resume math should account for the elapsed gap) — this exercises the same `resumeElapsed`/`isLiveSessionFresh` path as the original handoff plan, now reused by the reconciler.
9. **Finish clears both sides:** finish a session fully on either device. Confirm the *other* device's live session clears (no stale auto-launch shortly after).
10. **Non-handoff flows unaffected:** confirm starting a session directly on the watch via `SessionListView`, and the "last workout" complication deep link (`hiitwatch://run?id=...`), both still show the 3-2-1 countdown as before.
11. **HealthKit unaffected:** confirm HealthKit still records correctly for both a watch-resumed session and a phone-resumed session (this plan doesn't touch `WorkoutSessionCoordinator`, but is worth a spot check since watch-side mirroring now reaches `WorkoutTimerEngine` through a new code path).
