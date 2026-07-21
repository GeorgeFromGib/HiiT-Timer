import { NativeModules } from 'react-native';

export function ping(): void {
  try {
    // Look up NativeModules.WorkoutSync at call time, not via a destructured
    // module-scope binding — the native module can register after this file
    // loads, and tests reassign NativeModules.WorkoutSync at runtime.
    NativeModules.WorkoutSync?.ping();
  } catch (e) {
    console.warn('workoutSync: ping failed', e);
  }
}
