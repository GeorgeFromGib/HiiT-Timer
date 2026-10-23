import { useCallback, useEffect, useRef, useState } from 'react';
import { appendEntry, buildHistoryEntry, newId } from '../lib/history';
import { ownsRun, type LiveSessionState } from '../lib/liveSessionSync';
import { summarizeRun, type SessionStats } from '../lib/sessionStats';
import type { Session } from '../lib/sessions';
import type { Segment } from '../lib/workout';

interface Args {
  session:               Session;
  segments:              Segment[];
  totalDur:              number;
  stats:                 SessionStats;
  elapsed:               number;
  status:                string;
  initialResumeElapsed?: number;
  incomingLiveSession?:  LiveSessionState | null;
}

/**
 * Writes the run to History. Only the device that started the run records it — a
 * mirror of the peer's run leaves that to the starter (the watch sends its own
 * record to the phone). `historyEntryId` is the finished run's entry, for the
 * complete screen's feeling picker; `logAbandoned` records a terminated run.
 */
export function useRunLogging({
  session, segments, totalDur, stats, elapsed, status, initialResumeElapsed, incomingLiveSession,
}: Args) {
  const [historyEntryId, setHistoryEntryId] = useState<string>();
  const ownsRunRef = useRef(ownsRun(session.id, initialResumeElapsed, incomingLiveSession, Date.now()));

  useEffect(() => {
    if (status !== 'finished') { setHistoryEntryId(undefined); return; }
    if (!ownsRunRef.current) return;
    const summary = summarizeRun(segments, totalDur, stats);
    const id = newId();
    const entry = buildHistoryEntry({ id, session, plannedSecs: totalDur, summary, activeSecs: summary.totalSecs, completed: true });
    if (!entry) return;
    setHistoryEntryId(id);
    appendEntry(entry);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps -- log once per finish, not on every stats/segments change

  const logAbandoned = useCallback(() => {
    if (!ownsRunRef.current) return;
    const entry = buildHistoryEntry({
      id: newId(), session, plannedSecs: totalDur, activeSecs: elapsed, completed: false,
      summary: summarizeRun(segments, totalDur, stats),
    });
    if (entry) appendEntry(entry);
  }, [session, totalDur, elapsed, segments, stats]);

  return { historyEntryId, logAbandoned };
}
