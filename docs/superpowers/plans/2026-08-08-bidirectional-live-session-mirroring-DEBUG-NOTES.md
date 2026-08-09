# Bidirectional Live Session Mirroring — Manual Verification Debug Notes

Branch: `bi-direction` (off `release-1.2.0`). Companion to the STATUS.md doc, which tracks checklist progress — this file records what was actually found and fixed during device testing.

## Branch consolidation

The implementation worktree (`worktree-bidirectional-live-mirroring`) was merged into a new branch `bi-direction` (fast-forward, no conflicts — `release-1.2.0` hadn't moved since the feature branch was cut), then the worktree and its branch were removed. `git log` on `bi-direction` is now the only source of truth; the SDD ledger (`.superpowers/sdd/progress.md`) was gitignored scratch and no longer exists.

## Step 2 — phone → watch auto-launch: not a bug

Reported symptom: starting a session on the phone only auto-launched on the watch when both apps were foregrounded.

Root cause investigation: watchOS suspends backgrounded apps, so a backgrounded watch can't receive live `WCSessionDelegate` callbacks — this is a platform constraint, not something the code controls. Confirmed the fallback path works as designed: opening the watch app after backgrounding correctly catches up via `WatchSessionReceiver.activationDidCompleteWith` reading `session.receivedApplicationContext`. Matches the plan's own Task 13 wording ("if its app is open, **or opened shortly after**").

**Verdict:** working as designed, no fix needed.

## Step 5 — live skip mirroring: bug found and fixed

Reported symptom: skip mirrors correctly except when skipping out of the cooldown (last) segment — the session finishes on the watch but the phone keeps showing it as running.

**Root cause:** `EngineHolder.broadcastLiveState()` (`ios/ClearHiiTWatch Watch App/SessionRunView.swift`) guards on `engine.state.status == .running || .paused` and returns early otherwise. `skipAndBroadcast()` calls `engine.skip()` then `broadcastLiveState()` — when skip pushes the engine straight to `.finished` (last segment), the guard blocks the broadcast entirely. Nothing is ever sent to the phone, not even a final elapsed update, let alone a clear. This is asymmetric with the phone's own `WorkoutScreen.tsx`, which already calls `clearLiveSession()` whenever its own status leaves running/paused — the watch had no equivalent call anywhere.

**Fix (commit `5911948`):** `engine.onFinish` now invalidates the heartbeat timer and calls `connectivity.clearLiveSession()`, matching the phone's existing finish behavior.

**Scope decision (user confirmed "minimal fix"):** this only clears the watch's stale broadcast — it does not make the phone auto-terminate its own running screen. Neither platform's inbound handler currently reacts to a peer's broadcast clearing by force-finishing its own session; the wire protocol's `status` field is also typed `'running' | 'paused'` only, with no `'finished'` value. Full finish-mirroring (peer auto-completes: stops its timer, shows its own congrats screen, stops its own HealthKit recording) was explicitly deferred as a separate, larger feature — flagged here so it isn't confused with a completed requirement of the current plan, whose own Goal statement lists "finish" as something that should mirror.

**Needs re-test on device** to confirm the fix resolves the reported symptom (not yet re-verified after commit `5911948`).

## Step 7/9 area — watch → phone terminate: bug found and fixed

Reported symptom: explicitly terminating a workout on the watch did not end it on the phone (the reverse direction of the step-7 fix in commit `66d3980`).

**Root cause:** the watch had no explicit "Terminate" action at all — unlike the phone, which shows a confirmation `Alert` before backing out that broadcasts a one-shot `status: 'terminated'`. The watch's only way to leave a running session was swipe-to-dismiss, which routes through `.onDisappear` → `EngineHolder.discardIfUnfinished()` → a plain `clearLiveSession()`. That plain clear is deliberately ignored by peers (it's the step-7 "accidental dismiss must not kill the peer" protection), so there was no watch action distinguishable from an accidental dismiss — commit `66d3980` only wired the explicit-terminate broadcast on the phone side, never added a watch-side equivalent.

**Fix (commit `71771c0`):** added an explicit End button (red "x") to the watch's running-controls page and a `confirmationDialog` ("End Workout" / "Continue"), mirroring the phone's Alert. Confirming calls a new `EngineHolder.terminate()` which broadcasts `status: 'terminated'` before the view dismisses — the same one-shot signal the phone already sends and both platforms already know how to receive (receiving side was already bidirectional and untouched).

**Verified on device.**

## Watch duplicate session screen: bug found and fixed

Reported symptom: the watch sometimes showed a session with a system "x" dismiss (modal cover), and tapping it just revealed the *same* running session again underneath, now with a back chevron (pushed navigation) — i.e. two stacked `SessionRunView` instances for the same session.

**Root cause:** `ContentView.checkForLiveSession()` always passed `currentSessionId: nil` to `nextLiveSessionAction`, so it had no way to know a session was already on-screen via a plain `NavigationLink` push from `SessionListView`. When the phone's ~2s heartbeat echoed the watch's own broadcast back, `nextLiveSessionAction` saw no matching current session and returned `.launchNew`, so `ContentView` presented a second `SessionRunView` as a `fullScreenCover` on top of the one already pushed and running.

**Fix (commit `ce165f4`):** added `WatchSessionReceiver.activeSessionId`, set/cleared from `SessionRunView`'s `onAppear`/`onDisappear` regardless of presentation style (push or cover), and threaded through as `currentSessionId` in `ContentView.checkForLiveSession()` — so the echoed heartbeat now correctly resolves to `.applyToCurrent` (a no-op for `ContentView`) instead of `.launchNew`.

**Verified on device.**

## Requirement change: any watch exit now ends the peer (was: explicit-only)

User decided (superseding the original step-7 "accidental dismiss must not kill the peer" requirement, watch-side only) that **any** way of leaving a running/paused watch session — back chevron, swipe, cover dismiss, or the End Workout confirmation — should end the phone's mirrored session too, not just an explicit confirmed terminate.

**Fix (commit `ce165f4`):** `EngineHolder.discardIfUnfinished()` (called from `onDisappear` on every exit path) now broadcasts `status: 'terminated'` whenever the engine is `.running`/`.paused`, replacing the previous plain `clearLiveSession()`. The explicit `terminate()` method added in the prior commit (`71771c0`) was removed as redundant — the confirmation dialog's "End Workout" button now just calls `dismiss()`, and `discardIfUnfinished()` handles the broadcast uniformly for every exit path.

Note: this changes only the **watch's** dismiss behavior. The phone's own accidental-dismiss protection (muting via `onLiveSessionDismiss`/`mutedSessionIdRef`) is untouched — a phone-side plain back/swipe still does not end the watch's session.

**Verified on device**; step 7's phone→watch direction still holds unchanged.

## Phone: stale terminal broadcast hijacks a freshly-started session

Reported symptom: on the phone, some sessions jump straight back to the list immediately after pressing the workout button to start them.

**Root cause:** `App.tsx`'s `liveSessionState` caches the last live-session broadcast received indefinitely — nothing ever forgets it. `WorkoutScreen`'s incoming-update `useEffect` runs at least once on mount regardless of whether `incomingLiveSession` is a genuinely new arrival or just whatever was already cached before the screen opened. `'terminated'`/`'finished'` are one-shot broadcasts with no follow-up clear (by design, so they're distinguishable from a manual dismiss), so starting the same session id fresh soon after the watch had terminated/finished a prior run of it replayed that stale broadcast on mount and immediately called `onBack()` (or force-applied `'finished'`). Confirmed by the user: happened specifically with sessions last run on the watch — consistent with the watch now sending `'terminated'` far more often after the previous two fixes.

The watch doesn't share this defect: `SessionRunView`'s `onChange(of: connectivity.liveSession)` only fires on an actual value *transition*, never on whatever's already published at mount — so a stale cached broadcast there is inert on mount, unlike React's `useEffect` which always runs at least once regardless of whether the value is "new."

**Fix (commit `ea559f7`):** seed `lastAppliedRemoteUpdatedAtRef` from whatever `incomingLiveSession` already is at mount time, so the effect only reacts to updates that arrive strictly after this screen opened — mirroring the watch's `onChange` semantics. The legitimate auto-launch/handoff case is unaffected: `initialStatus`/`initialResumeElapsed` route params already fully seed the local engine's starting state independently of this effect.

**Verified on device.**

## Terminated session auto-relaunches on both devices right after ending

Reported symptom: terminating a session on the watch correctly ends it on both devices, but then it re-enters the session on its own, resuming right where it left off.

**Root cause:** both platforms' auto-launch effect (`App.tsx`'s top-level `liveSessionState` effect; `ContentView.checkForLiveSession` on watch) only ever guarded against relaunching a `'finished'` broadcast — `'terminated'` had no equivalent guard. Sequence: the terminate broadcast arrives → the currently-open `WorkoutScreen`/`SessionRunView` correctly backs out first (its own incoming-effect/`onChange` handles `'terminated'` by leaving the screen) → that changes the route/nav state → on the very next render, the *same* still-cached `'terminated'` broadcast no longer matches "current session" (since the screen just left) → the auto-launch effect (which only excluded `'finished'`) reads this as `.launchNew` and re-navigates straight back into the just-terminated session, resuming at its last elapsed — on both devices, since both share the identical asymmetric guard.

**Fix (commit `137bb57`):** extended both guards (`App.tsx` line ~83, `ContentView.swift` line ~43) to treat `'terminated'` the same as `'finished'` — never auto-launch on either terminal status.

**Verified on device.**

## Open follow-up (not yet scheduled)

- Full finish-mirroring across devices, if wanted: requires widening `LiveSessionState.status` (both Swift and TS) to carry a `finished` value (or a separate signal), and adding inbound handling on both platforms (`WorkoutScreen.tsx`'s incoming effect, watch's `SessionRunView.onChange(of: connectivity.liveSession)`) to actually finish the local session when told the peer did.
