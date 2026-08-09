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
