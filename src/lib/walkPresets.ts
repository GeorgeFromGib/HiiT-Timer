import { type RunSpeeds } from './sessions';
import { type PresetLevel } from './presets';

export interface WalkPresetStructure {
  continuous: boolean;
  warmup:     number;
  work:       number;
  rest:       number;
  rounds:     number;
  cooldown:   number;
}

export interface WalkPreset {
  structure: WalkPresetStructure;
  runSpeeds: RunSpeeds;
}

// Named on-ramp presets for Outdoor Walk sessions. Unlike the generic 1–6 intensity dial,
// each level is a complete hand-tuned session (structure + pace) rather than a value fit
// against an independently-chosen target length.
export const WALK_PRESETS: Record<PresetLevel, WalkPreset> = {
  '1': {
    structure: { continuous: true, warmup: 0, work: 600, rest: 0, rounds: 1, cooldown: 0 },
    runSpeeds: { warmupSpeed: 4.0, workSpeed: 4.0, restSpeed: 4.0, cooldownSpeed: 4.0 },
  },
  '2': {
    structure: { continuous: true, warmup: 0, work: 900, rest: 0, rounds: 1, cooldown: 0 },
    runSpeeds: { warmupSpeed: 4.0, workSpeed: 4.0, restSpeed: 4.0, cooldownSpeed: 4.0 },
  },
  '3': {
    structure: { continuous: false, warmup: 120, work: 60, rest: 180, rounds: 5, cooldown: 120 },
    runSpeeds: { warmupSpeed: 4.5, workSpeed: 5.5, restSpeed: 4.5, cooldownSpeed: 4.5 },
  },
  '4': {
    structure: { continuous: false, warmup: 120, work: 90, rest: 150, rounds: 6, cooldown: 120 },
    runSpeeds: { warmupSpeed: 4.8, workSpeed: 5.8, restSpeed: 4.8, cooldownSpeed: 4.8 },
  },
  '5': {
    structure: { continuous: false, warmup: 180, work: 120, rest: 120, rounds: 6, cooldown: 180 },
    runSpeeds: { warmupSpeed: 5.0, workSpeed: 6.2, restSpeed: 5.0, cooldownSpeed: 5.0 },
  },
  '6': {
    structure: { continuous: false, warmup: 180, work: 150, rest: 90, rounds: 7, cooldown: 180 },
    runSpeeds: { warmupSpeed: 5.3, workSpeed: 6.8, restSpeed: 5.3, cooldownSpeed: 5.3 },
  },
};

const ALL_LEVELS: PresetLevel[] = ['1', '2', '3', '4', '5', '6'];

// Same 1–6 levels, speeds only — used to drive the Advanced-mode speed preset dial with
// walking-appropriate paces instead of Treadmill's SPEED_PRESETS.
export const WALK_SPEED_PRESETS: Record<PresetLevel, RunSpeeds> = {
  '1': WALK_PRESETS['1'].runSpeeds,
  '2': WALK_PRESETS['2'].runSpeeds,
  '3': WALK_PRESETS['3'].runSpeeds,
  '4': WALK_PRESETS['4'].runSpeeds,
  '5': WALK_PRESETS['5'].runSpeeds,
  '6': WALK_PRESETS['6'].runSpeeds,
};

export function walkPresetTotalSeconds(level: PresetLevel): number {
  const { warmup, work, rest, rounds, cooldown } = WALK_PRESETS[level].structure;
  return warmup + rounds * (work + rest) + cooldown;
}

export function findMatchingWalkPreset(
  fieldValues: { warmup: number; work: number; rest: number; cooldown: number },
  rounds: number,
  runSpeeds: RunSpeeds,
): PresetLevel | null {
  return ALL_LEVELS.find(level => {
    const { structure: s, runSpeeds: rs } = WALK_PRESETS[level];
    return s.warmup === fieldValues.warmup && s.work === fieldValues.work &&
           s.rest === fieldValues.rest && s.cooldown === fieldValues.cooldown &&
           s.rounds === rounds &&
           rs.warmupSpeed === runSpeeds.warmupSpeed && rs.workSpeed === runSpeeds.workSpeed &&
           rs.restSpeed === runSpeeds.restSpeed && rs.cooldownSpeed === runSpeeds.cooldownSpeed;
  }) ?? null;
}
