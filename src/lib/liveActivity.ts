import { Platform } from 'react-native';
import { PHASE_META, type Phase } from './workout';

let LiveActivityModule: any = null;
if (Platform.OS === 'ios') {
  try {
    const { requireNativeModule } = require('expo-modules-core');
    LiveActivityModule = requireNativeModule('LiveActivityModule');
  } catch {
    // module not available (simulator, Expo Go, or prebuild not run)
  }
}

const isSupported = !!LiveActivityModule;

export async function startWorkoutActivity(params: {
  sessionName: string;
  phase: Phase;
  timeRemaining: number;
  phaseColor: string;
}): Promise<void> {
  if (!isSupported) return;
  return LiveActivityModule.startActivity(
    params.sessionName,
    params.phase,
    PHASE_META[params.phase].word,
    params.timeRemaining,
    params.phaseColor,
  );
}

export async function updateWorkoutActivity(params: {
  phase: Phase;
  timeRemaining: number;
  phaseColor: string;
}): Promise<void> {
  if (!isSupported) return;
  return LiveActivityModule.updateActivity(
    params.phase,
    PHASE_META[params.phase].word,
    params.timeRemaining,
    params.phaseColor,
  );
}

export async function endWorkoutActivity(): Promise<void> {
  if (!isSupported) return;
  return LiveActivityModule.endActivity();
}
