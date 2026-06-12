export type PresetLevel = 'easy' | 'medium' | 'hard';

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
  easy:   { warmup: 180, work:  20, rest: 40, rounds: 14, cooldown: 180 },
  medium: { warmup: 240, work:  30, rest: 30, rounds: 18, cooldown: 240 },
  hard:   { warmup: 300, work:  45, rest: 15, rounds: 22, cooldown: 300 },
};

export const SPEED_PRESETS: Record<PresetLevel, SpeedPreset> = {
  easy:   { warmupSpeed:  5, workSpeed:  8, restSpeed:  5, cooldownSpeed: 4.5 },
  medium: { warmupSpeed:  6, workSpeed: 11, restSpeed:  6, cooldownSpeed: 5.5 },
  hard:   { warmupSpeed:  7, workSpeed: 14, restSpeed:  7, cooldownSpeed: 6   },
};
