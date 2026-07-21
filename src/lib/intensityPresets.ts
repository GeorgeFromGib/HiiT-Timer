import { type Interval, tryConvertToEasy } from './workout';
import { type PresetLevel } from './presets';

export interface IntensityPreset {
  work: number; // seconds
  rest: number;
}

export const INTENSITY_PRESETS: Record<PresetLevel, IntensityPreset> = {
  '1': { work: 20, rest: 40 },
  '2': { work: 30, rest: 30 },
  '3': { work: 40, rest: 20 },
  '4': { work: 45, rest: 15 },
  '5': { work: 50, rest: 15 },
  '6': { work: 60, rest: 15 },
};

// Same 1–6 levels as INTENSITY_PRESETS, walking-appropriate work/rest — drives the timing preset
// dial for Outdoor Walk sessions instead of Treadmill's INTENSITY_PRESETS. Rounds still adjust to
// hit the session's target length, same as every other activity type.
export const WALK_INTENSITY_PRESETS: Record<PresetLevel, IntensityPreset> = {
  '1': { work: 30,  rest: 90 },
  '2': { work: 60,  rest: 90 },
  '3': { work: 90,  rest: 90 },
  '4': { work: 120, rest: 60 },
  '5': { work: 180, rest: 60 },
  '6': { work: 240, rest: 60 },
};

const ALL_LEVELS: PresetLevel[] = ['1', '2', '3', '4', '5', '6'];

export function findMatchingIntensityPreset(
  work: number,
  rest: number,
  source: Record<PresetLevel, IntensityPreset> = INTENSITY_PRESETS,
): PresetLevel | null {
  return ALL_LEVELS.find(level => {
    const p = source[level];
    return p.work === work && p.rest === rest;
  }) ?? null;
}

export function findMatchingIntensityPresetForIntervals(intervals: Interval[]): PresetLevel | null {
  const result = tryConvertToEasy(intervals);
  if (!result.ok) return null;
  return findMatchingIntensityPreset(result.work, result.rest);
}
