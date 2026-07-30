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
