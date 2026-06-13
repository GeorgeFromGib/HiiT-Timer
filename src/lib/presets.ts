import { type Interval, buildIntervalsFromEasy } from './workout';
import { type RunSpeeds } from './sessions';

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
