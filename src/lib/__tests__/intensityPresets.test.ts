import {
  INTENSITY_PRESETS,
  findMatchingIntensityPreset,
  findMatchingIntensityPresetForIntervals,
} from '../intensityPresets';
import type { Interval } from '../workout';

describe('findMatchingIntensityPreset', () => {
  it('finds the level matching a known work/rest pair', () => {
    expect(findMatchingIntensityPreset(20, 40)).toBe('1');
    expect(findMatchingIntensityPreset(60, 15)).toBe('6');
  });

  it('returns null when no level matches', () => {
    expect(findMatchingIntensityPreset(1, 1)).toBeNull();
  });

  it('matches every defined preset level against itself', () => {
    for (const level of Object.keys(INTENSITY_PRESETS) as (keyof typeof INTENSITY_PRESETS)[]) {
      const p = INTENSITY_PRESETS[level];
      expect(findMatchingIntensityPreset(p.work, p.rest)).toBe(level);
    }
  });
});

describe('findMatchingIntensityPresetForIntervals', () => {
  it('matches an interval list convertible to a known preset', () => {
    const ivs: Interval[] = [
      { type: 'work', dur: 30 },
      { type: 'rest', dur: 30 },
      { type: 'work', dur: 30 },
      { type: 'rest', dur: 30 },
    ];
    expect(findMatchingIntensityPresetForIntervals(ivs)).toBe('2');
  });

  it('returns null when the intervals cannot convert to easy config', () => {
    const ivs: Interval[] = [{ type: 'rest', dur: 5 }, { type: 'work', dur: 20 }];
    expect(findMatchingIntensityPresetForIntervals(ivs)).toBeNull();
  });

  it('returns null when the converted work/rest does not match any preset', () => {
    const ivs: Interval[] = [
      { type: 'work', dur: 7 },
      { type: 'rest', dur: 3 },
      { type: 'work', dur: 7 },
      { type: 'rest', dur: 3 },
    ];
    expect(findMatchingIntensityPresetForIntervals(ivs)).toBeNull();
  });

  it('returns null for an empty interval list', () => {
    expect(findMatchingIntensityPresetForIntervals([])).toBeNull();
  });
});
