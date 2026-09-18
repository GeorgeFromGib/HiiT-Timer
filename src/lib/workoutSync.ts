import { NativeModules } from 'react-native';
import type { SessionsData } from './sessions';

export function syncSessionsData(data: SessionsData): void {
  try {
    // Look up NativeModules.WorkoutSync at call time, not via a destructured
    // module-scope binding — the native module can register after this file
    // loads, and tests reassign NativeModules.WorkoutSync at runtime.
    NativeModules.WorkoutSync?.syncSessionsData(JSON.stringify(data));
  } catch (e) {
    console.warn('workoutSync: syncSessionsData failed', e);
  }
}

export function syncPreferences(hideFolders: boolean, language: string): void {
  try {
    NativeModules.WorkoutSync?.syncPreferences(hideFolders, language);
  } catch (e) {
    console.warn('workoutSync: syncPreferences failed', e);
  }
}
