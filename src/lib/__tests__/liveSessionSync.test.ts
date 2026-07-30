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
