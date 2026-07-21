import { NativeModules } from 'react-native';
import { ping } from '../workoutSync';

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
