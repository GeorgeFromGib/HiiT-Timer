import { readJsonFile, writeJsonFile } from './jsonFile';
import { newId, sessionKind } from './sessions';
import type { Session, SessionKind } from './sessions';
import type { RunSummary } from './sessionStats';

// A HistoryEntry is one completed/abandoned run of a Session (template). Name and
// config are snapshotted so history survives template edits and deletes.
export type Feeling = 'easy' | 'right' | 'hard';

export interface HistoryEntry {
  id:           string;
  startedAt:    number;   // epoch ms
  sessionId:    string;
  sessionName:  string;
  activityType: SessionKind;
  plannedSecs:  number;
  activeSecs:   number;
  rounds:       number;   // interval count, same figure as the complete screen's "Intervals"
  workSecs:     number;
  completed:    boolean;  // false = abandoned via "terminate"
  feeling?:     Feeling;  // only set on completed
  source:       'phone' | 'watch';
}

const HISTORY_FILE = 'history.json';

// Runs shorter than this are accidental starts, not worth logging when abandoned.
export const MIN_ABANDONED_SECS = 5;

// Skipping half the plan or more, or having no work time, makes a rating meaningless.
export function shouldAskFeeling(plannedSecs: number, skippedSecs: number, workSecs: number): boolean {
  return workSecs > 0 && skippedSecs < plannedSecs / 2;
}

export { newId };

export async function loadHistory(): Promise<HistoryEntry[]> {
  const data = await readJsonFile<HistoryEntry[]>(HISTORY_FILE);
  return Array.isArray(data) ? data : [];
}

// Writes are read-modify-write on one file, so run them one at a time — queued watch
// records can arrive back to back and would otherwise overwrite each other.
let writeQueue: Promise<unknown> = Promise.resolve();
function serialized(task: () => Promise<void>): Promise<void> {
  const next = writeQueue.then(task, task);
  writeQueue = next.catch(() => {});
  return next;
}

/** No-op if an entry with the same id exists (watch records can be redelivered). */
export function appendEntry(entry: HistoryEntry): Promise<void> {
  return serialized(async () => {
    const entries = await loadHistory();
    if (entries.some(e => e.id === entry.id)) return;
    writeJsonFile(HISTORY_FILE, [...entries, entry]);
  });
}

export function setFeeling(id: string, feeling: Feeling | undefined): Promise<void> {
  return serialized(async () => {
    const entries = await loadHistory();
    writeJsonFile(HISTORY_FILE, entries.map(e => (e.id === id ? { ...e, feeling } : e)));
  });
}

export function removeEntry(id: string): Promise<void> {
  return serialized(async () => {
    const entries = await loadHistory();
    writeJsonFile(HISTORY_FILE, entries.filter(e => e.id !== id));
  });
}

/** Returns null for abandoned runs too short to count. */
export function buildHistoryEntry(args: {
  id:          string;
  session:     Session;
  plannedSecs: number;
  summary:     RunSummary;
  activeSecs:  number;
  completed:   boolean;
  now?:        number;
}): HistoryEntry | null {
  const { id, session, plannedSecs, summary, activeSecs, completed, now = Date.now() } = args;
  if (!completed && activeSecs < MIN_ABANDONED_SECS) return null;
  return {
    id,
    startedAt:    now - Math.round(activeSecs * 1000),
    sessionId:    session.id,
    sessionName:  session.name,
    activityType: sessionKind(session),
    plannedSecs,
    activeSecs:   Math.round(activeSecs),
    rounds:       summary.intervals,
    workSecs:     summary.workSecs,
    completed,
    source:       'phone',
  };
}
