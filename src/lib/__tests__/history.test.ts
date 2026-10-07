import {
  loadHistory, appendEntry, setFeeling, buildHistoryEntry, shouldAskFeeling, MIN_ABANDONED_SECS, type HistoryEntry,
} from '../history';
import type { Session } from '../sessions';

const files = () => jest.requireMock('expo-file-system').__files as Map<string, string>;

const entry = (id: string, over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id, startedAt: 1000, sessionId: 's1', sessionName: 'Run', activityType: 'general',
  plannedSecs: 600, activeSecs: 600, rounds: 8, workSecs: 240, completed: true, source: 'phone', ...over,
});

describe('history store', () => {
  beforeEach(() => files().clear());

  it('returns [] when the file is missing', async () => {
    expect(await loadHistory()).toEqual([]);
  });

  it('returns [] when the file is corrupt', async () => {
    files().set('document/history.json', '{nope');
    expect(await loadHistory()).toEqual([]);
  });

  it('appends then loads entries in order', async () => {
    await appendEntry(entry('a'));
    await appendEntry(entry('b'));
    expect((await loadHistory()).map(e => e.id)).toEqual(['a', 'b']);
  });

  it('setFeeling updates only the target entry', async () => {
    await appendEntry(entry('a'));
    await appendEntry(entry('b'));
    await setFeeling('b', 'hard');
    const [a, b] = await loadHistory();
    expect(a.feeling).toBeUndefined();
    expect(b.feeling).toBe('hard');
  });

  it('setFeeling(undefined) clears a previous answer', async () => {
    await appendEntry(entry('a', { feeling: 'easy' }));
    await setFeeling('a', undefined);
    expect((await loadHistory())[0].feeling).toBeUndefined();
  });
});

describe('buildHistoryEntry', () => {
  const session = { id: 's1', name: 'Tabata Blast', folderId: 'f', mode: 'circuit', intervals: [], circuits: 1, warmup: 0, cooldown: 0, circuitRest: 0, tabata: true } as Session;
  const base = { id: 'x', session, plannedSecs: 600, summary: { totalSecs: 590, workSecs: 240, intervals: 8 }, now: 100_000 };

  it('builds a completed entry from the run summary', () => {
    const e = buildHistoryEntry({ ...base, activeSecs: 590, completed: true })!;
    expect(e).toMatchObject({
      id: 'x', sessionId: 's1', sessionName: 'Tabata Blast', activityType: 'tabata',
      plannedSecs: 600, activeSecs: 590, rounds: 8, workSecs: 240, completed: true, source: 'phone',
      startedAt: 100_000 - 590_000,
    });
    expect(e.feeling).toBeUndefined();
  });

  it('builds an abandoned entry with the elapsed time', () => {
    const e = buildHistoryEntry({ ...base, activeSecs: 120, completed: false })!;
    expect(e).toMatchObject({ completed: false, activeSecs: 120, plannedSecs: 600 });
  });

  it('skips abandoned runs under the threshold but keeps ones at it', () => {
    expect(buildHistoryEntry({ ...base, activeSecs: MIN_ABANDONED_SECS - 1, completed: false })).toBeNull();
    expect(buildHistoryEntry({ ...base, activeSecs: MIN_ABANDONED_SECS, completed: false })).not.toBeNull();
  });

  it('defaults activityType to general for plain sessions', () => {
    const plain = { id: 's2', name: 'P', folderId: 'f', mode: 'easy' } as Session;
    expect(buildHistoryEntry({ ...base, session: plain, activeSecs: 60, completed: true })!.activityType).toBe('general');
  });
});

describe('shouldAskFeeling', () => {
  it('asks for a normal run', () => expect(shouldAskFeeling(600, 0, 240)).toBe(true));
  it('asks when under half was skipped', () => expect(shouldAskFeeling(600, 299, 240)).toBe(true));
  it('does not ask when half or more was skipped', () => expect(shouldAskFeeling(600, 300, 240)).toBe(false));
  it('does not ask when there is no work time', () => expect(shouldAskFeeling(600, 0, 0)).toBe(false));
});
