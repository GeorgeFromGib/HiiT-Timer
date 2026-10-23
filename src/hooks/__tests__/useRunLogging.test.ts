import { act, renderHook } from '@testing-library/react-native';
import { useRunLogging } from '../useRunLogging';
import { appendEntry } from '../../lib/history';
import { ZERO_STATS } from '../../lib/sessionStats';
import type { Session } from '../../lib/sessions';
import type { Segment } from '../../lib/workout';
import type { LiveSessionState } from '../../lib/liveSessionSync';

jest.mock('../../lib/history', () => ({ ...jest.requireActual('../../lib/history'), appendEntry: jest.fn() }));

const session: Session = {
  id: 's1', name: 'Test', folderId: 'f', mode: 'easy',
  config: { warmup: 0, high: 20, low: 10, rounds: 1, cooldown: 0 },
};
const segments = [
  { phase: 'work', duration: 20, startAt: 0, endAt: 20 },
  { phase: 'rest', duration: 10, startAt: 20, endAt: 30 },
] as Segment[];

const base = { session, segments, totalDur: 30, stats: ZERO_STATS, elapsed: 0, status: 'running' };
const appended = () => (appendEntry as jest.Mock).mock.calls.map(c => c[0]);

beforeEach(() => jest.clearAllMocks());

describe('useRunLogging — finished runs', () => {
  it('logs one completed entry when status becomes finished, and exposes its id', async () => {
    const { result, rerender } = await renderHook((p: { status: string }) => useRunLogging({ ...base, ...p }), { initialProps: { status: 'running' } });
    expect(appendEntry).not.toHaveBeenCalled();

    await rerender({ status: 'finished' });
    expect(appended()).toHaveLength(1);
    expect(appended()[0]).toMatchObject({ sessionId: 's1', completed: true, plannedSecs: 30, source: 'phone' });
    expect(result.current.historyEntryId).toBe(appended()[0].id);
  });

  it('clears historyEntryId when the run restarts', async () => {
    const { result, rerender } = await renderHook((p: { status: string }) => useRunLogging({ ...base, ...p }), { initialProps: { status: 'finished' } });
    expect(result.current.historyEntryId).toBeDefined();
    await rerender({ status: 'running' });
    expect(result.current.historyEntryId).toBeUndefined();
  });

  it('does not log a run it is only mirroring (resumed from the peer)', async () => {
    const { result, rerender } = await renderHook(
      (p: { status: string }) => useRunLogging({ ...base, ...p, initialResumeElapsed: 40 }), { initialProps: { status: 'running' } },
    );
    await rerender({ status: 'finished' });
    expect(appendEntry).not.toHaveBeenCalled();
    expect(result.current.historyEntryId).toBeUndefined();
  });

  it('does not log when opened onto a fresh live run of the same session', async () => {
    const live: LiveSessionState = { sessionId: 's1', name: 'Test', elapsed: 5, status: 'running', updatedAt: Date.now() };
    const { rerender } = await renderHook(
      (p: { status: string }) => useRunLogging({ ...base, ...p, incomingLiveSession: live }), { initialProps: { status: 'running' } },
    );
    await rerender({ status: 'finished' });
    expect(appendEntry).not.toHaveBeenCalled();
  });
});

describe('useRunLogging — logAbandoned', () => {
  it('records an uncompleted entry with the elapsed time', async () => {
    const { result } = await renderHook(() => useRunLogging({ ...base, elapsed: 25 }));
    await act(async () => result.current.logAbandoned());
    expect(appended()).toHaveLength(1);
    expect(appended()[0]).toMatchObject({ completed: false, activeSecs: 25 });
  });

  it('skips runs too short to count', async () => {
    const { result } = await renderHook(() => useRunLogging({ ...base, elapsed: 1 }));
    await act(async () => result.current.logAbandoned());
    expect(appendEntry).not.toHaveBeenCalled();
  });

  it('skips when the peer started the run', async () => {
    const { result } = await renderHook(() => useRunLogging({ ...base, elapsed: 25, initialResumeElapsed: 10 }));
    await act(async () => result.current.logAbandoned());
    expect(appendEntry).not.toHaveBeenCalled();
  });
});
