import { act, renderHook } from '@testing-library/react-native';
import { NativeModules } from 'react-native';
import { useLiveSessionMirror } from '../useLiveSessionMirror';
import { LIVE_SESSION_MAX_AGE_MS, type LiveSessionState } from '../../lib/liveSessionSync';

function setNow(ms: number) {
  jest.spyOn(Date, 'now').mockReturnValue(ms);
}

function liveState(overrides: Partial<LiveSessionState> = {}): LiveSessionState {
  return { sessionId: 's1', name: 'Tabata', elapsed: 20, status: 'running', updatedAt: 1000, ...overrides };
}

let updateMock: jest.Mock;
let clearMock: jest.Mock;

beforeEach(() => {
  updateMock = jest.fn();
  clearMock = jest.fn();
  NativeModules.LiveSessionSync = { updateLiveSession: updateMock, clearLiveSession: clearMock };
  setNow(1_000_000);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useLiveSessionMirror — applying incoming updates', () => {
  it('applies a fresh update for the current session', async () => {
    const applyIncomingLiveState = jest.fn();
    const onBack = jest.fn();
    const { rerender } = await renderHook(
      ({ incoming }) => useLiveSessionMirror('s1', 'Tabata', incoming, 'running', 20, applyIncomingLiveState, onBack),
      { initialProps: { incoming: null as LiveSessionState | null } },
    );

    setNow(1_004_000);
    await act(async () => { await rerender({ incoming: liveState({ updatedAt: 1000 }) }); });

    expect(applyIncomingLiveState).toHaveBeenCalledWith('running', 24);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('ignores an update for a different session id', async () => {
    const applyIncomingLiveState = jest.fn();
    const { rerender } = await renderHook(
      ({ incoming }) => useLiveSessionMirror('s1', 'Tabata', incoming, 'running', 20, applyIncomingLiveState, jest.fn()),
      { initialProps: { incoming: null as LiveSessionState | null } },
    );

    await act(async () => { await rerender({ incoming: liveState({ sessionId: 'other' }) }); });

    expect(applyIncomingLiveState).not.toHaveBeenCalled();
  });

  it('ignores a stale update', async () => {
    const applyIncomingLiveState = jest.fn();
    const { rerender } = await renderHook(
      ({ incoming }) => useLiveSessionMirror('s1', 'Tabata', incoming, 'running', 20, applyIncomingLiveState, jest.fn()),
      { initialProps: { incoming: null as LiveSessionState | null } },
    );

    setNow(1000 * 1000 + LIVE_SESSION_MAX_AGE_MS + 1);
    await act(async () => { await rerender({ incoming: liveState({ updatedAt: 1000 }) }); });

    expect(applyIncomingLiveState).not.toHaveBeenCalled();
  });

  it('ignores an update no newer than the last one applied', async () => {
    const applyIncomingLiveState = jest.fn();
    const { rerender } = await renderHook(
      ({ incoming }) => useLiveSessionMirror('s1', 'Tabata', incoming, 'running', 20, applyIncomingLiveState, jest.fn()),
      { initialProps: { incoming: null as LiveSessionState | null } },
    );

    await act(async () => { await rerender({ incoming: liveState({ updatedAt: 1000 }) }); });
    expect(applyIncomingLiveState).toHaveBeenCalledTimes(1);

    // Same updatedAt again (e.g. an unrelated re-render) — must not re-apply.
    await act(async () => { await rerender({ incoming: liveState({ updatedAt: 1000 }) }); });
    expect(applyIncomingLiveState).toHaveBeenCalledTimes(1);
  });

  it('calls onBack instead of applying state when the peer terminates the session', async () => {
    const applyIncomingLiveState = jest.fn();
    const onBack = jest.fn();
    const { rerender } = await renderHook(
      ({ incoming }) => useLiveSessionMirror('s1', 'Tabata', incoming, 'running', 20, applyIncomingLiveState, onBack),
      { initialProps: { incoming: null as LiveSessionState | null } },
    );

    await act(async () => { await rerender({ incoming: liveState({ status: 'terminated', updatedAt: 1000 }) }); });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(applyIncomingLiveState).not.toHaveBeenCalled();
  });
});

describe('useLiveSessionMirror — broadcasting local changes', () => {
  it('broadcasts immediately on a status change', async () => {
    const { rerender } = await renderHook(
      ({ status, elapsed }) => useLiveSessionMirror('s1', 'Tabata', null, status, elapsed, jest.fn(), jest.fn()),
      { initialProps: { status: 'idle' as const, elapsed: 0 } },
    );

    await act(async () => { await rerender({ status: 'running', elapsed: 5 }); });

    expect(updateMock).toHaveBeenCalledWith('s1', 'Tabata', 5, 'running');
  });

  it('throttles same-status broadcasts within the minimum interval', async () => {
    const { rerender } = await renderHook(
      ({ status, elapsed }) => useLiveSessionMirror('s1', 'Tabata', null, status, elapsed, jest.fn(), jest.fn()),
      { initialProps: { status: 'idle' as const, elapsed: 0 } },
    );

    await act(async () => { await rerender({ status: 'running', elapsed: 5 }); });
    expect(updateMock).toHaveBeenCalledTimes(1);

    setNow(1_000_500); // < 2s later
    await act(async () => { await rerender({ status: 'running', elapsed: 6 }); });
    expect(updateMock).toHaveBeenCalledTimes(1);

    setNow(1_002_100); // >= 2s later
    await act(async () => { await rerender({ status: 'running', elapsed: 7 }); });
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenLastCalledWith('s1', 'Tabata', 7, 'running');
  });

  it('broadcasts "finished" exactly once', async () => {
    const { rerender } = await renderHook(
      ({ status, elapsed }) => useLiveSessionMirror('s1', 'Tabata', null, status, elapsed, jest.fn(), jest.fn()),
      { initialProps: { status: 'running' as const, elapsed: 5 } },
    );

    await act(async () => { await rerender({ status: 'finished', elapsed: 30 }); });
    expect(updateMock).toHaveBeenLastCalledWith('s1', 'Tabata', 30, 'finished');
    const callsAfterFirstFinish = updateMock.mock.calls.length;

    await act(async () => { await rerender({ status: 'finished', elapsed: 30 }); });
    expect(updateMock).toHaveBeenCalledTimes(callsAfterFirstFinish);
  });

  it('clears the live session when returning to idle after broadcasting', async () => {
    const { rerender } = await renderHook(
      ({ status, elapsed }) => useLiveSessionMirror('s1', 'Tabata', null, status, elapsed, jest.fn(), jest.fn()),
      { initialProps: { status: 'running' as const, elapsed: 5 } },
    );

    await act(async () => { await rerender({ status: 'idle', elapsed: 0 }); });

    expect(clearMock).toHaveBeenCalledTimes(1);
  });

  it('suppresses the outbound broadcast that would just echo a just-applied remote update', async () => {
    const applyIncomingLiveState = jest.fn();
    const { rerender } = await renderHook(
      ({ incoming, status, elapsed }) =>
        useLiveSessionMirror('s1', 'Tabata', incoming, status, elapsed, applyIncomingLiveState, jest.fn()),
      { initialProps: { incoming: null as LiveSessionState | null, status: 'running' as const, elapsed: 5 } },
    );
    // Establish a baseline broadcast so the mirror has already sent something.
    await act(async () => { await rerender({ incoming: null, status: 'running', elapsed: 5 }); });
    updateMock.mockClear();

    setNow(1_004_000);
    await act(async () => { await rerender({ incoming: liveState({ status: 'paused', elapsed: 20, updatedAt: 1000 }), status: 'running', elapsed: 5 }); });
    // Paused states don't accrue a wall-clock gap, so the applied elapsed matches the incoming one.
    expect(applyIncomingLiveState).toHaveBeenCalledWith('paused', 20);

    // The screen re-renders with the applied (paused, 20) state — this must not
    // be broadcast back out as if it were a new local change.
    await act(async () => { await rerender({ incoming: liveState({ status: 'paused', elapsed: 20, updatedAt: 1000 }), status: 'paused', elapsed: 20 }); });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('forceNextBroadcast bypasses the throttle', async () => {
    const { result, rerender } = await renderHook(
      ({ status, elapsed }) => useLiveSessionMirror('s1', 'Tabata', null, status, elapsed, jest.fn(), jest.fn()),
      { initialProps: { status: 'idle' as const, elapsed: 0 } },
    );

    await act(async () => { await rerender({ status: 'running', elapsed: 5 }); });
    expect(updateMock).toHaveBeenCalledTimes(1);

    setNow(1_000_500); // still within the throttle window
    result.current.forceNextBroadcast();
    await act(async () => { await rerender({ status: 'running', elapsed: 6 }); });

    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenLastCalledWith('s1', 'Tabata', 6, 'running');
  });
});

describe('useLiveSessionMirror — cleanup', () => {
  it('clears the live session on unmount', async () => {
    const { unmount } = await renderHook(() =>
      useLiveSessionMirror('s1', 'Tabata', null, 'running', 5, jest.fn(), jest.fn()),
    );

    await unmount();

    expect(clearMock).toHaveBeenCalledTimes(1);
  });
});
