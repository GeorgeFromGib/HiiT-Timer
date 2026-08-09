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
  let status: String // "running", "paused", or a one-shot terminal "finished"
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

/// True if `updatedAt` is strictly newer than the last update this device has
/// already accepted from the same raw transport stream. WatchConnectivity
/// delivers `updateApplicationContext` and `sendMessage` as two independent
/// channels with different latency — an older broadcast queued on the slower
/// channel can arrive after a newer one already came through the faster one.
/// Rejecting out-of-order deliveries here, at the point of receipt, stops a
/// stale broadcast from ever reaching UI state — a downstream ordering guard
/// alone isn't enough, since two same-tick deliveries can collapse into a
/// single React/SwiftUI state update before it gets a chance to compare them.
func isNewerLiveSessionUpdate(updatedAt: Date, lastAccepted: Date?) -> Bool {
  guard let lastAccepted else { return true }
  return updatedAt > lastAccepted
}

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
