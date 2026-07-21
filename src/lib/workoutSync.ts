import { NativeModules } from 'react-native';

export function ping(): void {
  try {
    NativeModules.WorkoutSync?.ping();
  } catch (e) {
    console.warn('workoutSync: ping failed', e);
  }
}
