import { parseWatchHistoryEntry } from '../watchHistory';
import { appendEntry, loadHistory, type HistoryEntry } from '../history';
import { ownsRun, type LiveSessionState } from '../liveSessionSync';

const payload = {
  kind: 'historyEntry', id: 'w1', startedAt: 1_700_000_000_000, sessionId: 's1', sessionName: 'Tabata',
  activityType: 'circuit', plannedSecs: 600, activeSecs: 600, rounds: 8, workSecs: 240, completed: true,
};

describe('parseWatchHistoryEntry', () => {
  it('maps a watch record to a HistoryEntry stamped source "watch"', () => {
    expect(parseWatchHistoryEntry(payload)).toEqual({
      id: 'w1', startedAt: 1_700_000_000_000, sessionId: 's1', sessionName: 'Tabata', activityType: 'circuit',
      plannedSecs: 600, activeSecs: 600, rounds: 8, workSecs: 240, completed: true, source: 'watch',
    });
  });

  it.each([
    ['null', null],
    ['missing id', { ...payload, id: undefined }],
    ['string number', { ...payload, activeSecs: '600' }],
    ['unknown activity type', { ...payload, activityType: 'swimming' }],
    ['non-boolean completed', { ...payload, completed: 1 }],
  ])('rejects %s', (_n, bad) => {
    expect(parseWatchHistoryEntry(bad)).toBeNull();
  });
});

describe('appendEntry dedupe + ordering', () => {
  const entry = (id: string): HistoryEntry => parseWatchHistoryEntry({ ...payload, id })!;
  beforeEach(() => jest.requireMock('expo-file-system').__files.clear());

  it('ignores a redelivered record with the same id', async () => {
    await appendEntry(entry('w1'));
    await appendEntry(entry('w1'));
    expect(await loadHistory()).toHaveLength(1);
  });

  it('keeps every record when several arrive back to back', async () => {
    await Promise.all([appendEntry(entry('a')), appendEntry(entry('b')), appendEntry(entry('c')), appendEntry(entry('a'))]);
    expect((await loadHistory()).map(e => e.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('ownsRun', () => {
  const NOW = 1_000_000;
  const live = (over: Partial<LiveSessionState> = {}): LiveSessionState =>
    ({ sessionId: 's1', name: 'S', elapsed: 30, status: 'running', updatedAt: NOW / 1000 - 5, ...over });

  it('owns a run started here', () => expect(ownsRun('s1', undefined, null, NOW)).toBe(true));
  it('does not own a run launched from the peer (resume offset)', () => expect(ownsRun('s1', 12, null, NOW)).toBe(false));
  it('does not own a session the peer is already running live', () => expect(ownsRun('s1', undefined, live(), NOW)).toBe(false));
  it('owns it when the peer broadcast is for a different session', () => expect(ownsRun('s1', undefined, live({ sessionId: 's2' }), NOW)).toBe(true));
  it('owns it when the peer broadcast is stale', () => expect(ownsRun('s1', undefined, live({ updatedAt: NOW / 1000 - 600 }), NOW)).toBe(true));
  it('owns it when the leftover broadcast is a terminal one', () => {
    expect(ownsRun('s1', undefined, live({ status: 'finished' }), NOW)).toBe(true);
    expect(ownsRun('s1', undefined, live({ status: 'terminated' }), NOW)).toBe(true);
  });
});
