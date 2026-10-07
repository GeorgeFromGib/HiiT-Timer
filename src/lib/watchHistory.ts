import { NativeEventEmitter, NativeModules } from 'react-native';
import type { HistoryEntry } from './history';

const ACTIVITY_TYPES = ['general', 'run', 'circuit', 'spinning', 'tabata'] as const;

/** Validates a record sent by the watch (WatchHistoryRecord.userInfo in
 * ios/Shared/WorkoutSessionRecording.swift) and stamps it source 'watch'. */
export function parseWatchHistoryEntry(event: unknown): HistoryEntry | null {
  if (typeof event !== 'object' || event === null) return null;
  const e = event as Record<string, unknown>;
  const activityType = ACTIVITY_TYPES.find(a => a === e.activityType);
  if (
    typeof e.id !== 'string' || typeof e.startedAt !== 'number' ||
    typeof e.sessionId !== 'string' || typeof e.sessionName !== 'string' || !activityType ||
    typeof e.plannedSecs !== 'number' || typeof e.activeSecs !== 'number' ||
    typeof e.rounds !== 'number' || typeof e.workSecs !== 'number' || typeof e.completed !== 'boolean'
  ) return null;
  return {
    id: e.id, startedAt: e.startedAt, sessionId: e.sessionId, sessionName: e.sessionName, activityType,
    plannedSecs: e.plannedSecs, activeSecs: e.activeSecs, rounds: e.rounds, workSecs: e.workSecs,
    completed: e.completed, source: 'watch',
  };
}

/** Subscribes to history records the watch sends when it finishes or abandons a run it started. */
export function subscribeToWatchHistory(callback: (entry: HistoryEntry) => void): () => void {
  if (!NativeModules.LiveSessionSync) return () => {};
  const emitter = new NativeEventEmitter(NativeModules.LiveSessionSync);
  const subscription = emitter.addListener('WatchHistoryEntry', (event: unknown) => {
    const entry = parseWatchHistoryEntry(event);
    if (entry) callback(entry);
  });
  return () => subscription.remove();
}
