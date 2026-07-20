import {
  intervalsToSegments,
  expandWorkout,
  expandCircuit,
  reindexSegments,
  totalDuration,
  segmentIndexAt,
  computeRoundsForTargetDuration,
  buildIntervalsFromEasy,
  tryConvertToEasy,
  fmtDuration,
  fmtTimer,
  fmtSpeed,
  convertKmhToMph,
  convertMphToKmh,
  type Interval,
  type WorkoutConfig,
} from '../workout';

describe('intervalsToSegments', () => {
  it('lays out consecutive intervals with cumulative startAt/endAt', () => {
    const intervals: Interval[] = [
      { type: 'warmup', dur: 10 },
      { type: 'work', dur: 20 },
      { type: 'rest', dur: 5 },
    ];
    expect(intervalsToSegments(intervals)).toEqual([
      { phase: 'warmup', duration: 10, startAt: 0, endAt: 10, index: 0 },
      { phase: 'work', duration: 20, startAt: 10, endAt: 30, index: 1 },
      { phase: 'rest', duration: 5, startAt: 30, endAt: 35, index: 2 },
    ]);
  });

  it('returns an empty array for no intervals', () => {
    expect(intervalsToSegments([])).toEqual([]);
  });
});

describe('expandWorkout', () => {
  const base: WorkoutConfig = { warmup: 10, high: 20, low: 5, rounds: 2, cooldown: 15 };

  it('expands warmup, work/rest rounds, and cooldown in order', () => {
    const segs = expandWorkout(base);
    expect(segs.map(s => s.phase)).toEqual(['warmup', 'work', 'rest', 'work', 'rest', 'cooldown']);
    expect(totalDuration(segs)).toBe(10 + (20 + 5) * 2 + 15);
  });

  it('omits warmup when warmup is 0', () => {
    const segs = expandWorkout({ ...base, warmup: 0 });
    expect(segs[0].phase).toBe('work');
  });

  it('omits rest segments when low is 0', () => {
    const segs = expandWorkout({ ...base, low: 0 });
    expect(segs.filter(s => s.phase === 'rest')).toHaveLength(0);
    expect(segs.filter(s => s.phase === 'work')).toHaveLength(2);
  });

  it('omits cooldown when cooldown is 0', () => {
    const segs = expandWorkout({ ...base, cooldown: 0 });
    expect(segs[segs.length - 1].phase).toBe('rest');
  });
});

describe('expandCircuit', () => {
  const intervals: Interval[] = [
    { type: 'work', dur: 30, activityLabel: 'Push-ups' },
    { type: 'rest', dur: 10 },
  ];

  it('repeats the interval list per circuit, tagging circuitNumber', () => {
    const segs = expandCircuit(intervals, 2, 60, 60, 20);
    expect(segs.map(s => s.phase)).toEqual([
      'warmup', 'work', 'rest', 'circuitRest', 'work', 'rest', 'cooldown',
    ]);
    expect(segs.filter(s => s.phase === 'work').map(s => s.circuitNumber)).toEqual([1, 2]);
  });

  it('does not add a circuitRest after the final circuit', () => {
    const segs = expandCircuit(intervals, 1, 0, 0, 20);
    expect(segs.some(s => s.phase === 'circuitRest')).toBe(false);
  });

  it('omits circuitRest between circuits when circuitRest is 0', () => {
    const segs = expandCircuit(intervals, 2, 0, 0, 0);
    expect(segs.some(s => s.phase === 'circuitRest')).toBe(false);
  });

  it('carries activityLabel onto each segment', () => {
    const segs = expandCircuit(intervals, 1, 0, 0, 0);
    expect(segs[0].activityLabel).toBe('Push-ups');
  });
});

describe('reindexSegments', () => {
  it('rewrites startAt/endAt/index from the given cursor and index', () => {
    const segs = intervalsToSegments([{ type: 'work', dur: 10 }, { type: 'rest', dur: 5 }]);
    const reindexed = reindexSegments(segs, 100, 3);
    expect(reindexed).toEqual([
      { phase: 'work', duration: 10, startAt: 100, endAt: 110, index: 3 },
      { phase: 'rest', duration: 5, startAt: 110, endAt: 115, index: 4 },
    ]);
  });
});

describe('totalDuration', () => {
  it('returns the endAt of the last segment', () => {
    const segs = intervalsToSegments([{ type: 'work', dur: 10 }, { type: 'rest', dur: 5 }]);
    expect(totalDuration(segs)).toBe(15);
  });

  it('returns 0 for an empty segment list', () => {
    expect(totalDuration([])).toBe(0);
  });
});

describe('segmentIndexAt', () => {
  const segs = intervalsToSegments([{ type: 'work', dur: 10 }, { type: 'rest', dur: 5 }]);

  it('finds the segment index containing the elapsed time', () => {
    expect(segmentIndexAt(segs, 0)).toBe(0);
    expect(segmentIndexAt(segs, 9)).toBe(0);
    expect(segmentIndexAt(segs, 10)).toBe(1);
    expect(segmentIndexAt(segs, 14)).toBe(1);
  });

  it('returns -1 when elapsed is beyond all segments', () => {
    expect(segmentIndexAt(segs, 15)).toBe(-1);
  });

  it('returns -1 for an empty segment list', () => {
    expect(segmentIndexAt([], 0)).toBe(-1);
  });
});

describe('computeRoundsForTargetDuration', () => {
  it('solves for the round count nearest the target duration', () => {
    // warmup 10 + cooldown 10 leaves 80s for rounds of (work 20 + rest 5) = 25 -> 80/25 = 3.2 -> 3
    expect(computeRoundsForTargetDuration(10, 20, 5, 10, 100)).toBe(3);
  });

  it('returns 1 when work+rest per round is 0', () => {
    expect(computeRoundsForTargetDuration(10, 0, 0, 10, 100)).toBe(1);
  });

  it('returns 1 when warmup+cooldown already exceed the target', () => {
    expect(computeRoundsForTargetDuration(60, 20, 5, 60, 100)).toBe(1);
  });
});

describe('buildIntervalsFromEasy', () => {
  it('builds warmup, work/rest pairs, and cooldown intervals', () => {
    const intervals = buildIntervalsFromEasy({ warmup: 10, high: 20, low: 5, rounds: 2, cooldown: 15 });
    expect(intervals).toEqual([
      { type: 'warmup', dur: 10 },
      { type: 'work', dur: 20 },
      { type: 'rest', dur: 5 },
      { type: 'work', dur: 20 },
      { type: 'rest', dur: 5 },
      { type: 'cooldown', dur: 15 },
    ]);
  });

  it('omits rest intervals when low is 0', () => {
    const intervals = buildIntervalsFromEasy({ warmup: 0, high: 20, low: 0, rounds: 2, cooldown: 0 });
    expect(intervals).toEqual([{ type: 'work', dur: 20 }, { type: 'work', dur: 20 }]);
  });
});

describe('tryConvertToEasy', () => {
  it('converts a regular work/rest interval list back to easy config', () => {
    const ivs: Interval[] = [
      { type: 'warmup', dur: 10 },
      { type: 'work', dur: 20 },
      { type: 'rest', dur: 5 },
      { type: 'work', dur: 20 },
      { type: 'rest', dur: 5 },
      { type: 'cooldown', dur: 15 },
    ];
    expect(tryConvertToEasy(ivs)).toEqual({
      ok: true, warmup: 10, work: 20, rest: 5, rounds: 2, cooldown: 15,
    });
  });

  it('converts a work-only interval list (no rest) back to easy config', () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }, { type: 'work', dur: 20 }];
    expect(tryConvertToEasy(ivs)).toEqual({
      ok: true, warmup: 0, work: 20, rest: 0, rounds: 2, cooldown: 0,
    });
  });

  it('rejects an empty work list', () => {
    const result = tryConvertToEasy([{ type: 'warmup', dur: 10 }]);
    expect(result).toEqual({ ok: false, reasonKey: 'validation.noWorkIntervals' });
  });

  it('rejects a disallowed phase type', () => {
    const result = tryConvertToEasy([{ type: 'work', dur: 20 }, { type: 'circuitRest', dur: 5 }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonKey).toBe('validation.phaseNotAllowed');
  });

  it('rejects a list not starting with work', () => {
    const result = tryConvertToEasy([{ type: 'rest', dur: 5 }, { type: 'work', dur: 20 }]);
    expect(result).toEqual({ ok: false, reasonKey: 'validation.mustStartWithWork' });
  });

  it('rejects an odd-length work/rest list', () => {
    const result = tryConvertToEasy([
      { type: 'work', dur: 20 }, { type: 'rest', dur: 5 }, { type: 'work', dur: 20 },
    ]);
    expect(result).toEqual({ ok: false, reasonKey: 'validation.workRestPairing' });
  });

  it('rejects mismatched work durations', () => {
    const result = tryConvertToEasy([
      { type: 'work', dur: 20 }, { type: 'rest', dur: 5 }, { type: 'work', dur: 30 }, { type: 'rest', dur: 5 },
    ]);
    expect(result).toEqual({ ok: false, reasonKey: 'validation.sameWorkDuration' });
  });

  it('rejects mismatched rest durations', () => {
    const result = tryConvertToEasy([
      { type: 'work', dur: 20 }, { type: 'rest', dur: 5 }, { type: 'work', dur: 20 }, { type: 'rest', dur: 10 },
    ]);
    expect(result).toEqual({ ok: false, reasonKey: 'validation.sameRestDuration' });
  });
});

describe('fmtDuration', () => {
  it('formats seconds only', () => expect(fmtDuration(45)).toBe('45s'));
  it('formats whole minutes', () => expect(fmtDuration(120)).toBe('2min'));
  it('formats minutes and seconds', () => expect(fmtDuration(90)).toBe('1min 30s'));
  it('formats zero as seconds', () => expect(fmtDuration(0)).toBe('0s'));
});

describe('fmtTimer', () => {
  it('formats sub-minute as bare seconds', () => expect(fmtTimer(45)).toBe('45'));
  it('formats minutes:seconds under an hour', () => expect(fmtTimer(90)).toBe('01:30'));
  it('formats hours:minutes:seconds at/over an hour', () => expect(fmtTimer(3661)).toBe('1:01:01'));
  it('rounds up fractional seconds', () => expect(fmtTimer(44.2)).toBe('45'));
  it('clamps negative values to 0', () => expect(fmtTimer(-5)).toBe('0'));
});

describe('fmtSpeed', () => {
  it('formats km/h as-is', () => expect(fmtSpeed(10, 'km')).toBe('10 km/h'));
  it('converts to mph rounded to the nearest 0.5', () => expect(fmtSpeed(10, 'miles')).toBe('6.0 mph'));
});

describe('convertKmhToMph / convertMphToKmh', () => {
  it('converts km/h to mph', () => {
    expect(convertKmhToMph(10)).toBeCloseTo(6.21371, 4);
  });

  it('round-trips mph -> km/h -> mph', () => {
    expect(convertMphToKmh(convertKmhToMph(10))).toBeCloseTo(10, 8);
  });
});
