import { NativeEventEmitter, NativeModules } from 'react-native';

export function updateLiveSession(
  sessionId: string,
  name: string,
  elapsed: number,
  status: 'running' | 'paused' | 'finished' | 'terminated',
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

/** Snapshot of the other device's live session, as broadcast over WatchConnectivity.
 * 'finished' and 'terminated' are one-shot terminal broadcasts distinct from
 * a cleared (null) context, so a natural finish or an explicit terminate can
 * be told apart from an ambient/manual dismiss on the other device — all
 * three clear the context, but only 'finished'/'terminated' should force
 * this device's own session to complete/end there too. */
export interface LiveSessionState {
  sessionId: string;
  name: string;
  elapsed: number;
  status: 'running' | 'paused' | 'finished' | 'terminated';
  updatedAt: number; // epoch seconds — matches native Date().timeIntervalSince1970
}

export type LiveSessionAction =
  | { type: 'ignore' }
  | { type: 'applyToCurrent'; elapsed: number; status: 'running' | 'paused' | 'finished' | 'terminated' }
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
    (e.status !== 'running' && e.status !== 'paused' && e.status !== 'finished' && e.status !== 'terminated') ||
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
