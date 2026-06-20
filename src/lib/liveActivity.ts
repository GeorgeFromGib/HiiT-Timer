import { NativeModules, Platform } from 'react-native';
import { PHASE_META, type Phase } from './workout';

const { LiveActivityModule } = NativeModules;
const isSupported = Platform.OS === 'ios' && !!LiveActivityModule;

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
