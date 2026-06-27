import { tryConvertToEasy, buildIntervalsFromEasy } from '../lib/workout';
import { toLocal, type LocalInterval } from './editSessionTypes';

type EasyConfig = { warmup: number; high: number; low: number; rounds: number; cooldown: number };

export interface AdvancedModeEdit {
  buildFromEasy:    (config: EasyConfig) => LocalInterval[];
  tryConvertToEasy: typeof tryConvertToEasy;
}

export function useAdvancedModeEdit(): AdvancedModeEdit {
  return {
    buildFromEasy:    (config) => buildIntervalsFromEasy(config).map(toLocal),
    tryConvertToEasy: tryConvertToEasy,
  };
}
