import { type RunSpeeds, type SpinValues } from './sessions';

export type PresetLevel = '1' | '2' | '3' | '4' | '5' | '6';

export interface SpeedPreset {
  warmupSpeed:   number; // km/h
  workSpeed:     number;
  restSpeed:     number;
  cooldownSpeed: number;
}

export interface SpinPreset {
  warmupResistance:   number;
  warmupPower:        number;
  workResistance:     number;
  workPower:          number;
  restResistance:     number;
  restPower:          number;
  cooldownResistance: number;
  cooldownPower:      number;
}

export const SPEED_PRESETS: Record<PresetLevel, SpeedPreset> = {
  '1': { warmupSpeed:  3.0, workSpeed:  5.5, restSpeed:  3.0, cooldownSpeed: 2.5 },
  '2': { warmupSpeed:  4.5, workSpeed:  8.4, restSpeed:  4.5, cooldownSpeed: 3.8 },
  '3': { warmupSpeed:  6.2, workSpeed: 11.3, restSpeed:  6.2, cooldownSpeed: 5.1 },
  '4': { warmupSpeed:  7.8, workSpeed: 14.2, restSpeed:  7.8, cooldownSpeed: 6.4 },
  '5': { warmupSpeed:  9.4, workSpeed: 17.1, restSpeed:  9.4, cooldownSpeed: 7.7 },
  '6': { warmupSpeed: 11.0, workSpeed: 20.0, restSpeed: 11.0, cooldownSpeed: 9.0 },
};

// Levels map to spinning intensity zones: Recovery → Easy Endurance → Steady Tempo → Threshold → VO2 Push → Max Sprint
export const SPIN_PRESETS: Record<PresetLevel, SpinPreset> = {
  '1': { warmupResistance: 2, warmupPower:  50, workResistance: 2, workPower:  60, restResistance: 2, restPower:  50, cooldownResistance: 2, cooldownPower:  50 },
  '2': { warmupResistance: 2, warmupPower:  60, workResistance: 3, workPower:  90, restResistance: 2, restPower:  50, cooldownResistance: 2, cooldownPower:  60 },
  '3': { warmupResistance: 3, warmupPower:  80, workResistance: 5, workPower: 120, restResistance: 2, restPower:  60, cooldownResistance: 3, cooldownPower:  70 },
  '4': { warmupResistance: 4, warmupPower: 100, workResistance: 7, workPower: 170, restResistance: 2, restPower:  60, cooldownResistance: 3, cooldownPower:  80 },
  '5': { warmupResistance: 4, warmupPower: 110, workResistance: 8, workPower: 210, restResistance: 3, restPower:  60, cooldownResistance: 3, cooldownPower:  90 },
  '6': { warmupResistance: 5, warmupPower: 120, workResistance: 9, workPower: 250, restResistance: 3, restPower:  70, cooldownResistance: 4, cooldownPower: 100 },
};

const ALL_LEVELS: PresetLevel[] = ['1', '2', '3', '4', '5', '6'];

export function findMatchingSpeedPreset(speeds: RunSpeeds): PresetLevel | null {
  return ALL_LEVELS.find(level => {
    const p = SPEED_PRESETS[level];
    return p.warmupSpeed === speeds.warmupSpeed && p.workSpeed === speeds.workSpeed &&
           p.restSpeed === speeds.restSpeed && p.cooldownSpeed === speeds.cooldownSpeed;
  }) ?? null;
}

export function findMatchingSpinPreset(values: SpinValues): PresetLevel | null {
  return ALL_LEVELS.find(level => {
    const p = SPIN_PRESETS[level];
    return p.warmupResistance === values.warmupResistance && p.warmupPower === values.warmupPower &&
           p.workResistance === values.workResistance && p.workPower === values.workPower &&
           p.restResistance === values.restResistance && p.restPower === values.restPower &&
           p.cooldownResistance === values.cooldownResistance && p.cooldownPower === values.cooldownPower;
  }) ?? null;
}
