import { type RunSpeeds, type RunInclines, type SpinValues } from './sessions';

export type PresetLevel = '1' | '2' | '3' | '4' | '5' | '6';

export interface SpeedPreset {
  warmupSpeed:   number; // km/h
  workSpeed:     number;
  restSpeed:     number;
  cooldownSpeed: number;
}

export interface InclinePreset {
  warmupIncline:   number; // % grade
  workIncline:     number;
  restIncline:     number;
  cooldownIncline: number;
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

// Same 1–6 levels as SPEED_PRESETS, walking-appropriate paces — drives the speed preset dial
// for Outdoor Walk sessions instead of Treadmill's SPEED_PRESETS.
export const WALK_SPEED_PRESETS: Record<PresetLevel, SpeedPreset> = {
  '1': { warmupSpeed: 3.5, workSpeed: 4.8, restSpeed: 3.8, cooldownSpeed: 3.5 },
  '2': { warmupSpeed: 4.0, workSpeed: 5.8, restSpeed: 4.3, cooldownSpeed: 4.0 },
  '3': { warmupSpeed: 4.5, workSpeed: 6.5, restSpeed: 4.8, cooldownSpeed: 4.3 },
  '4': { warmupSpeed: 5.0, workSpeed: 7.2, restSpeed: 5.2, cooldownSpeed: 4.5 },
  '5': { warmupSpeed: 5.2, workSpeed: 8.0, restSpeed: 5.5, cooldownSpeed: 4.8 },
  '6': { warmupSpeed: 5.5, workSpeed: 8.8, restSpeed: 5.8, cooldownSpeed: 5.0 },
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

// Levels map to treadmill incline intensity: Flat/Recovery → Gentle Rise → Rolling Hills →
// Hill Climb → Steep Ascent → Max Grade — mirroring SPIN_PRESETS' resistance ramp, but as a
// single incline axis (treadmills have one incline control, unlike a bike's resistance+power).
export const INCLINE_PRESETS: Record<PresetLevel, InclinePreset> = {
  '1': { warmupIncline: 1,   workIncline: 1,  restIncline: 0.5, cooldownIncline: 0.5 },
  '2': { warmupIncline: 1,   workIncline: 2,  restIncline: 1,   cooldownIncline: 1   },
  '3': { warmupIncline: 1.5, workIncline: 4,  restIncline: 1.5, cooldownIncline: 1   },
  '4': { warmupIncline: 2,   workIncline: 6,  restIncline: 2,   cooldownIncline: 1.5 },
  '5': { warmupIncline: 2,   workIncline: 9,  restIncline: 2,   cooldownIncline: 1.5 },
  '6': { warmupIncline: 2.5, workIncline: 12, restIncline: 2,   cooldownIncline: 2   },
};

const ALL_LEVELS: PresetLevel[] = ['1', '2', '3', '4', '5', '6'];

export function findMatchingSpeedPreset(
  speeds: RunSpeeds,
  source: Record<PresetLevel, SpeedPreset> = SPEED_PRESETS,
): PresetLevel | null {
  return ALL_LEVELS.find(level => {
    const p = source[level];
    return p.warmupSpeed === speeds.warmupSpeed && p.workSpeed === speeds.workSpeed &&
           p.restSpeed === speeds.restSpeed && p.cooldownSpeed === speeds.cooldownSpeed;
  }) ?? null;
}

export function findMatchingInclinePreset(inclines: RunInclines): PresetLevel | null {
  return ALL_LEVELS.find(level => {
    const i = INCLINE_PRESETS[level];
    return i.warmupIncline === inclines.warmupIncline && i.workIncline === inclines.workIncline &&
           i.restIncline === inclines.restIncline && i.cooldownIncline === inclines.cooldownIncline;
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
