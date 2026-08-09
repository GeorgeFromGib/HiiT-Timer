import { NativeModules } from 'react-native';
import { syncSessionsData, syncPreferences } from '../workoutSync';
import type { SessionsData } from '../sessions';

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

describe('syncPreferences', () => {
  it('calls the native WorkoutSync.syncPreferences method with the hideFolders value', () => {
    const syncMock = jest.fn();
    NativeModules.WorkoutSync = { syncPreferences: syncMock };

    syncPreferences(false);

    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(syncMock).toHaveBeenCalledWith(false);
  });

  it('does not throw when the native module is unavailable', () => {
    NativeModules.WorkoutSync = undefined;

    expect(() => syncPreferences(true)).not.toThrow();
  });
});
