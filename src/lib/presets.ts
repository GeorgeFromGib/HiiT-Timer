import { type Interval, buildIntervalsFromEasy } from './workout';
import { type RunSpeeds, type SpinValues } from './sessions';

export type PresetLevel = '1' | '2' | '3' | '4' | '5' | '6';

export interface DurationPreset {
  warmup:   number; // seconds
  work:     number;
  rest:     number;
  rounds:   number;
  cooldown: number;
}

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

export const DURATION_PRESETS: Record<PresetLevel, DurationPreset> = {
  '1': { warmup: 180, work:  20, rest: 40, rounds: 14, cooldown: 180 },
  '2': { warmup: 240, work:  30, rest: 30, rounds: 18, cooldown: 240 },
  '3': { warmup: 300, work:  45, rest: 15, rounds: 22, cooldown: 300 },
  '4': { warmup: 300, work:  50, rest: 10, rounds: 25, cooldown: 300 },
  '5': { warmup: 300, work:  55, rest: 10, rounds: 25, cooldown: 300 },
  '6': { warmup: 300, work:  60, rest:  5, rounds: 27, cooldown: 300 },
};

export const SPEED_PRESETS: Record<PresetLevel, SpeedPreset> = {
  '1': { warmupSpeed:  5, workSpeed:  8, restSpeed:  5, cooldownSpeed: 4.5 },
  '2': { warmupSpeed:  6, workSpeed: 11, restSpeed:  6, cooldownSpeed: 5.5 },
  '3': { warmupSpeed:  7, workSpeed: 14, restSpeed:  7, cooldownSpeed: 6.0 },
  '4': { warmupSpeed:  8, workSpeed: 17, restSpeed:  8, cooldownSpeed: 6.5 },
  '5': { warmupSpeed:  9, workSpeed: 20, restSpeed:  9, cooldownSpeed: 7.0 },
  '6': { warmupSpeed: 10, workSpeed: 23, restSpeed: 10, cooldownSpeed: 7.5 },
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

export function findMatchingDurationPreset(warmup: number, work: number, rest: number, rounds: number, cooldown: number): PresetLevel | null {
  return ALL_LEVELS.find(level => {
    const p = DURATION_PRESETS[level];
    return p.warmup === warmup && p.work === work && p.rest === rest && p.rounds === rounds && p.cooldown === cooldown;
  }) ?? null;
}

export function findMatchingDurationPresetForIntervals(intervals: Interval[]): PresetLevel | null {
  return ALL_LEVELS.find(level => {
    const p = DURATION_PRESETS[level];
    const expected = buildIntervalsFromEasy({ warmup: p.warmup, high: p.work, low: p.rest, rounds: p.rounds, cooldown: p.cooldown });
    return expected.length === intervals.length &&
      expected.every((e, i) => e.type === intervals[i].type && e.dur === intervals[i].dur);
  }) ?? null;
}

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
