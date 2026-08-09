import { NativeModules } from 'react-native';
import { updateLiveSession, clearLiveSession, shouldBroadcastLiveSession } from '../liveSessionSync';

describe('updateLiveSession', () => {
  it('calls the native LiveSessionSync.updateLiveSession method with the given fields', () => {
    const updateMock = jest.fn();
    NativeModules.LiveSessionSync = { updateLiveSession: updateMock };

    updateLiveSession('s1', 'Tabata', 42.5, 'running');

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith('s1', 'Tabata', 42.5, 'running');
  });

  it('does not throw when the native module is unavailable', () => {
    NativeModules.LiveSessionSync = undefined;

    expect(() => updateLiveSession('s1', 'Tabata', 42.5, 'running')).not.toThrow();
  });
});

describe('clearLiveSession', () => {
  it('calls the native LiveSessionSync.clearLiveSession method', () => {
    const clearMock = jest.fn();
    NativeModules.LiveSessionSync = { clearLiveSession: clearMock };

    clearLiveSession();

    expect(clearMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the native module is unavailable', () => {
    NativeModules.LiveSessionSync = undefined;

    expect(() => clearLiveSession()).not.toThrow();
  });
});

describe('shouldBroadcastLiveSession', () => {
  it('is true on a status change regardless of timing', () => {
    expect(shouldBroadcastLiveSession('running', 'paused', 1_000, 1_000)).toBe(true);
  });

  it('is true the first time (lastSentAt is null)', () => {
    expect(shouldBroadcastLiveSession(null, 'running', null, 1_000)).toBe(true);
  });

  it('is false when the status is unchanged and under the minimum interval', () => {
    expect(shouldBroadcastLiveSession('running', 'running', 1_000, 1_500, 2_000)).toBe(false);
  });

  it('is true when the status is unchanged but the minimum interval has elapsed', () => {
    expect(shouldBroadcastLiveSession('running', 'running', 1_000, 3_001, 2_000)).toBe(true);
  });
});

import {
  type LiveSessionState,
  resumeElapsedFor,
  isLiveSessionFresh,
  nextLiveSessionAction,
  parseLiveSessionState,
  subscribeToLiveSessionUpdates,
  LIVE_SESSION_MAX_AGE_MS,
} from '../liveSessionSync';

describe('resumeElapsedFor', () => {
  it('adds the wall-clock gap while running', () => {
    const state: LiveSessionState = { sessionId: '1', name: 'Tabata', elapsed: 20, status: 'running', updatedAt: 1000 };
    expect(resumeElapsedFor(state, 1_008_000)).toBeCloseTo(28, 3);
  });

  it('ignores the wall-clock gap while paused', () => {
    const state: LiveSessionState = { sessionId: '1', name: 'Tabata', elapsed: 20, status: 'paused', updatedAt: 1000 };
    expect(resumeElapsedFor(state, 1_008_000)).toBe(20);
  });
});

describe('isLiveSessionFresh', () => {
  it('is true within the max age', () => {
    const state: LiveSessionState = { sessionId: '1', name: 'Tabata', elapsed: 20, status: 'paused', updatedAt: 1000 };
    expect(isLiveSessionFresh(state, 1000 * 1000 + LIVE_SESSION_MAX_AGE_MS - 1)).toBe(true);
  });

  it('is false beyond the max age', () => {
    const state: LiveSessionState = { sessionId: '1', name: 'Tabata', elapsed: 20, status: 'paused', updatedAt: 1000 };
    expect(isLiveSessionFresh(state, 1000 * 1000 + LIVE_SESSION_MAX_AGE_MS + 1)).toBe(false);
  });
});

describe('nextLiveSessionAction', () => {
  const base: LiveSessionState = { sessionId: '1', name: 'Tabata', elapsed: 20, status: 'running', updatedAt: 1000 };

  it('ignores a stale incoming update', () => {
    const action = nextLiveSessionAction(null, null, base, 1000 * 1000 + LIVE_SESSION_MAX_AGE_MS + 1);
    expect(action).toEqual({ type: 'ignore' });
  });

  it('ignores an update no newer than the last applied one', () => {
    const action = nextLiveSessionAction(null, 1000, base, 1_001_000);
    expect(action).toEqual({ type: 'ignore' });
  });

  it('launches a new session when nothing is currently showing', () => {
    const paused = { ...base, status: 'paused' as const };
    const action = nextLiveSessionAction(null, null, paused, 1_000_000);
    expect(action).toEqual({ type: 'launchNew', sessionId: '1', resumeElapsed: 20 });
  });

  it('launches a new session when a different session is currently showing', () => {
    const action = nextLiveSessionAction('2', null, base, 1_000_000);
    expect(action).toEqual({ type: 'launchNew', sessionId: '1', resumeElapsed: 20 });
  });

  it('applies to the current session when the ids match', () => {
    const action = nextLiveSessionAction('1', null, base, 1_004_000);
    expect(action).toEqual({ type: 'applyToCurrent', elapsed: 24, status: 'running' });
  });
});

describe('parseLiveSessionState', () => {
  it('parses a valid event', () => {
    const event = { sessionId: '1', name: 'Tabata', elapsed: 20, status: 'running', updatedAt: 1000 };
    expect(parseLiveSessionState(event)).toEqual(event);
  });

  it('returns null for a cleared/empty context', () => {
    expect(parseLiveSessionState({})).toBeNull();
  });

  it('returns null for an invalid status value', () => {
    const event = { sessionId: '1', name: 'Tabata', elapsed: 20, status: 'bogus', updatedAt: 1000 };
    expect(parseLiveSessionState(event)).toBeNull();
  });

  it('parses a terminal finished event', () => {
    const event = { sessionId: '1', name: 'Tabata', elapsed: 18, status: 'finished', updatedAt: 1000 };
    expect(parseLiveSessionState(event)).toEqual(event);
  });

  it('parses a terminal terminated event', () => {
    const event = { sessionId: '1', name: 'Tabata', elapsed: 18, status: 'terminated', updatedAt: 1000 };
    expect(parseLiveSessionState(event)).toEqual(event);
  });
});

describe('subscribeToLiveSessionUpdates', () => {
  it('returns a no-op unsubscribe when the native module is unavailable', () => {
    NativeModules.LiveSessionSync = undefined;
    const unsubscribe = subscribeToLiveSessionUpdates(jest.fn());
    expect(() => unsubscribe()).not.toThrow();
  });
});
