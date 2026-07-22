import { NativeModules } from 'react-native';
import { ping, syncSessionsData } from '../workoutSync';
import type { SessionsData } from '../sessions';

describe('ping', () => {
  it('calls the native WorkoutSync.ping method when available', () => {
    const pingMock = jest.fn();
    NativeModules.WorkoutSync = { ping: pingMock };

    ping();

    expect(pingMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the native module is unavailable', () => {
    NativeModules.WorkoutSync = undefined;

    expect(() => ping()).not.toThrow();
  });
});

describe('syncSessionsData', () => {
  const data: SessionsData = {
    folders: [{ id: 'f1', name: 'Folder 1', createdAt: 1 }],
    sessions: [{ id: 's1', name: 'S1', folderId: 'f1', mode: 'advanced', intervals: [] }],
  };

  it('calls the native WorkoutSync.syncSessionsData method with the JSON-serialized data', () => {
    const syncMock = jest.fn();
    NativeModules.WorkoutSync = { syncSessionsData: syncMock };

    syncSessionsData(data);

    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(syncMock.mock.calls[0][0])).toEqual(data);
  });

  it('does not throw when the native module is unavailable', () => {
    NativeModules.WorkoutSync = undefined;

    expect(() => syncSessionsData(data)).not.toThrow();
  });
});
