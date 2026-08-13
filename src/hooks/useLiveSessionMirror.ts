import { useCallback, useEffect, useRef } from 'react';
import {
  updateLiveSession, clearLiveSession, shouldBroadcastLiveSession, nextLiveSessionAction,
  type LiveSessionState,
} from '../lib/liveSessionSync';
import { type WorkoutStatus } from './useWorkoutSession';

export interface LiveSessionMirror {
  // Resets the outbound throttle so the next status change broadcasts immediately
  // instead of waiting for the next heartbeat — used after skip/skip-back, which
  // change elapsed without going through the pause/resume status transition that
  // would otherwise trigger an immediate broadcast on its own.
  forceNextBroadcast: () => void;
}

/**
 * Mirrors this device's workout session against an incoming live-session broadcast
 * from the other device (watch <-> phone): applies remote status/elapsed updates to
 * this device, and broadcasts this device's own changes outward. Routes incoming
 * updates through the same nextLiveSessionAction reconciliation rule App.tsx uses to
 * decide whether to launch a session, so staleness/dedup are handled identically.
 */
export function useLiveSessionMirror(
  sessionId: string,
  sessionName: string,
  incomingLiveSession: LiveSessionState | null | undefined,
  status: WorkoutStatus,
  elapsed: number,
  applyIncomingLiveState: (status: 'running' | 'paused' | 'finished', elapsed: number) => void,
  onBack: () => void,
): LiveSessionMirror {
  // Snapshot (not a blanket flag) of the exact (status, elapsed) just applied from
  // a remote update — the outbound effect below only suppresses a broadcast that
  // would be an exact echo of it, so a genuine local action (e.g. a pause) that
  // happens to land right after an unrelated no-op heartbeat still broadcasts
  // instead of being mistaken for the echo and silently dropped.
  const appliedRemoteSnapshotRef = useRef<{ status: 'running' | 'paused' | 'finished'; elapsed: number } | null>(null);
  // Seeded from whatever incomingLiveSession already is at mount (e.g. a stale
  // 'terminated'/'finished' broadcast left over from a previous run of this
  // same session id) so the effect below only reacts to updates that arrive
  // AFTER this screen opened, not to a leftover snapshot mistaken for a live
  // peer mirroring a freshly-started local run.
  const lastAppliedRemoteUpdatedAtRef = useRef<number | null>(
    incomingLiveSession && incomingLiveSession.sessionId === sessionId ? incomingLiveSession.updatedAt : null
  );
  // Tracks whether the peer was actively mirroring THIS session as of the
  // last update, so a later clear can be told apart from "no peer has ever
  // broadcast anything" (the common, no-watch-involved case) — only the
  // former means the peer just closed out and is worth following back.
  const hadIncomingRef = useRef(!!(incomingLiveSession && incomingLiveSession.sessionId === sessionId));
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    if (!incomingLiveSession || incomingLiveSession.sessionId !== sessionId) {
      // The peer's own "Done" tap clears its broadcast outright rather than
      // sending a sessionId-scoped update (it has nothing left to report).
      // If this device is already sitting on its own finished screen,
      // follow the peer back instead of waiting for a separate local tap.
      if (hadIncomingRef.current && statusRef.current === 'finished') onBack();
      hadIncomingRef.current = false;
      return;
    }
    hadIncomingRef.current = true;
    const action = nextLiveSessionAction(sessionId, lastAppliedRemoteUpdatedAtRef.current, incomingLiveSession, Date.now());
    if (action.type !== 'applyToCurrent') return;
    lastAppliedRemoteUpdatedAtRef.current = incomingLiveSession.updatedAt;
    if (action.status === 'terminated') {
      // The peer explicitly ended this session — leave the screen instead of
      // ticking away a workout that no longer exists anywhere else.
      onBack();
      return;
    }
    appliedRemoteSnapshotRef.current = { status: action.status, elapsed: action.elapsed };
    applyIncomingLiveState(action.status, action.elapsed);
  }, [incomingLiveSession, sessionId, applyIncomingLiveState, onBack]);

  const lastLiveSyncRef = useRef<number | null>(null);
  const lastLiveStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const appliedSnapshot = appliedRemoteSnapshotRef.current;
    appliedRemoteSnapshotRef.current = null;
    if (
      appliedSnapshot &&
      appliedSnapshot.status === status &&
      Math.abs(appliedSnapshot.elapsed - elapsed) < 0.01
    ) return;
    if (status === 'running' || status === 'paused') {
      const now = Date.now();
      if (shouldBroadcastLiveSession(lastLiveStatusRef.current, status, lastLiveSyncRef.current, now)) {
        updateLiveSession(sessionId, sessionName, elapsed, status);
        lastLiveSyncRef.current = now;
        lastLiveStatusRef.current = status;
      }
    } else if (status === 'finished') {
      // One-shot terminal broadcast (not a clear) so the other device can
      // tell a real finish apart from a manual dismiss/discard, which also
      // clears the context but should NOT force this session to complete there.
      if (lastLiveStatusRef.current !== null) {
        updateLiveSession(sessionId, sessionName, elapsed, 'finished');
        lastLiveStatusRef.current = null;
        lastLiveSyncRef.current = null;
      }
    } else if (lastLiveStatusRef.current !== null) {
      clearLiveSession();
      lastLiveStatusRef.current = null;
      lastLiveSyncRef.current = null;
    }
  }, [status, elapsed, sessionId, sessionName]);

  useEffect(() => () => clearLiveSession(), []);

  const forceNextBroadcast = useCallback(() => {
    lastLiveStatusRef.current = null;
  }, []);

  return { forceNextBroadcast };
}
