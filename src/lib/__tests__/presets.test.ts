import {
  SPEED_PRESETS,
  SPIN_PRESETS,
  INCLINE_PRESETS,
  findMatchingSpeedPreset,
  findMatchingInclinePreset,
  findMatchingSpinPreset,
} from '../presets';
import type { RunSpeeds, RunInclines, SpinValues } from '../sessions';

describe('findMatchingSpeedPreset', () => {
  it('finds the level matching a known speed set from the default source', () => {
    expect(findMatchingSpeedPreset(SPEED_PRESETS['3'])).toBe('3');
  });

  it('returns null when no level matches', () => {
    const speeds: RunSpeeds = { warmupSpeed: 1, workSpeed: 1, restSpeed: 1, cooldownSpeed: 1 };
    expect(findMatchingSpeedPreset(speeds)).toBeNull();
  });

  it('matches every defined speed preset level against itself', () => {
    for (const level of Object.keys(SPEED_PRESETS) as (keyof typeof SPEED_PRESETS)[]) {
      expect(findMatchingSpeedPreset(SPEED_PRESETS[level])).toBe(level);
    }
  });
});

describe('findMatchingInclinePreset', () => {
  it('finds the level matching a known incline set', () => {
    expect(findMatchingInclinePreset(INCLINE_PRESETS['4'])).toBe('4');
  });

  it('returns null when no level matches', () => {
    const inclines: RunInclines = { warmupIncline: 99, workIncline: 99, restIncline: 99, cooldownIncline: 99 };
    expect(findMatchingInclinePreset(inclines)).toBeNull();
  });

  it('matches every defined incline preset level against itself', () => {
    for (const level of Object.keys(INCLINE_PRESETS) as (keyof typeof INCLINE_PRESETS)[]) {
      expect(findMatchingInclinePreset(INCLINE_PRESETS[level])).toBe(level);
    }
  });
});

describe('findMatchingSpinPreset', () => {
  it('finds the level matching a known spin value set', () => {
    expect(findMatchingSpinPreset(SPIN_PRESETS['5'])).toBe('5');
  });

  it('returns null when no level matches', () => {
    const values: SpinValues = {
      warmupResistance: 0, warmupPower: 0,
      workResistance: 0, workPower: 0,
      restResistance: 0, restPower: 0,
      cooldownResistance: 0, cooldownPower: 0,
    };
    expect(findMatchingSpinPreset(values)).toBeNull();
  });

  it('matches every defined spin preset level against itself', () => {
    for (const level of Object.keys(SPIN_PRESETS) as (keyof typeof SPIN_PRESETS)[]) {
      expect(findMatchingSpinPreset(SPIN_PRESETS[level])).toBe(level);
    }
  });

  it('does not match when only some fields agree', () => {
    const values: SpinValues = { ...SPIN_PRESETS['2'], workPower: 999 };
    expect(findMatchingSpinPreset(values)).toBeNull();
  });
});
