import { type Interval, tryConvertToEasy } from './workout';
import { type PresetLevel } from './presets';

export interface IntensityPreset {
  work: number; // seconds
  rest: number;
}

export const INTENSITY_PRESETS: Record<PresetLevel, IntensityPreset> = {
  '1': { work: 20, rest: 40 },
  '2': { work: 30, rest: 30 },
  '3': { work: 45, rest: 15 },
  '4': { work: 50, rest: 10 },
  '5': { work: 55, rest: 10 },
  '6': { work: 60, rest:  5 },
};

const ALL_LEVELS: PresetLevel[] = ['1', '2', '3', '4', '5', '6'];

export function findMatchingIntensityPreset(work: number, rest: number): PresetLevel | null {
  return ALL_LEVELS.find(level => {
    const p = INTENSITY_PRESETS[level];
    return p.work === work && p.rest === rest;
  }) ?? null;
}

export function findMatchingIntensityPresetForIntervals(intervals: Interval[]): PresetLevel | null {
  const result = tryConvertToEasy(intervals);
  if (!result.ok) return null;
  return findMatchingIntensityPreset(result.work, result.rest);
}
