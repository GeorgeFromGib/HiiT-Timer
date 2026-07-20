import { ZERO_STATS, applySkip, applySkipBack, applyExtend, applyAddRound, type SessionStats } from '../sessionStats';
import type { Segment } from '../workout';

const workSeg: Segment = { phase: 'work', duration: 20, startAt: 0, endAt: 20, index: 0 };
const restSeg: Segment = { phase: 'rest', duration: 10, startAt: 20, endAt: 30, index: 1 };

describe('ZERO_STATS', () => {
  it('has every field initialized to 0', () => {
    expect(ZERO_STATS).toEqual({
      skippedCount: 0,
      skippedSecs: 0,
      skippedWorkSecs: 0,
      extendedSecs: 0,
      addedRoundSecs: 0,
      skipBackSecs: 0,
      skipBackWorkSecs: 0,
      skipBackWorkCount: 0,
    });
  });
});

describe('applySkip', () => {
  it('increments skippedCount and skippedSecs, rounding remaining time up', () => {
    const next = applySkip(ZERO_STATS, restSeg, 4.2);
    expect(next).toEqual({ ...ZERO_STATS, skippedCount: 1, skippedSecs: 5 });
  });

  it('also tracks skippedWorkSecs when the skipped segment is work', () => {
    const next = applySkip(ZERO_STATS, workSeg, 4.2);
    expect(next).toEqual({ ...ZERO_STATS, skippedCount: 1, skippedSecs: 5, skippedWorkSecs: 5 });
  });

  it('does not add to skippedWorkSecs when segment is undefined', () => {
    const next = applySkip(ZERO_STATS, undefined, 3);
    expect(next).toEqual({ ...ZERO_STATS, skippedCount: 1, skippedSecs: 3, skippedWorkSecs: 0 });
  });

  it('rounds an exact integer remaining time without change', () => {
    const next = applySkip(ZERO_STATS, workSeg, 5);
    expect(next.skippedSecs).toBe(5);
  });

  it('handles zero remaining time', () => {
    const next = applySkip(ZERO_STATS, workSeg, 0);
    expect(next.skippedSecs).toBe(0);
    expect(next.skippedCount).toBe(1);
  });

  it('accumulates across multiple calls', () => {
    let stats = applySkip(ZERO_STATS, workSeg, 5);
    stats = applySkip(stats, restSeg, 3);
    expect(stats).toEqual({
      ...ZERO_STATS, skippedCount: 2, skippedSecs: 8, skippedWorkSecs: 5,
    });
  });
});

describe('applySkipBack', () => {
  it('increments skipBackSecs for any segment', () => {
    const next = applySkipBack(ZERO_STATS, restSeg, 10);
    expect(next).toEqual({ ...ZERO_STATS, skipBackSecs: 10 });
  });

  it('also tracks skipBackWorkSecs and skipBackWorkCount for a work segment', () => {
    const next = applySkipBack(ZERO_STATS, workSeg, 10);
    expect(next).toEqual({
      ...ZERO_STATS, skipBackSecs: 10, skipBackWorkSecs: 10, skipBackWorkCount: 1,
    });
  });

  it('returns stats unchanged when segment is undefined', () => {
    const next = applySkipBack(ZERO_STATS, undefined, 10);
    expect(next).toBe(ZERO_STATS);
  });

  it('accumulates across multiple work skip-backs', () => {
    let stats = applySkipBack(ZERO_STATS, workSeg, 5);
    stats = applySkipBack(stats, workSeg, 3);
    expect(stats).toEqual({
      ...ZERO_STATS, skipBackSecs: 8, skipBackWorkSecs: 8, skipBackWorkCount: 2,
    });
  });
});

describe('applyExtend', () => {
  it('increments extendedSecs by the given amount', () => {
    const next = applyExtend(ZERO_STATS, 15);
    expect(next).toEqual({ ...ZERO_STATS, extendedSecs: 15 });
  });

  it('accumulates across multiple calls', () => {
    let stats = applyExtend(ZERO_STATS, 15);
    stats = applyExtend(stats, 5);
    expect(stats.extendedSecs).toBe(20);
  });

  it('handles zero seconds', () => {
    expect(applyExtend(ZERO_STATS, 0)).toEqual(ZERO_STATS);
  });
});

describe('applyAddRound', () => {
  it('increments addedRoundSecs by the given amount', () => {
    const next = applyAddRound(ZERO_STATS, 30);
    expect(next).toEqual({ ...ZERO_STATS, addedRoundSecs: 30 });
  });

  it('accumulates across multiple calls', () => {
    let stats = applyAddRound(ZERO_STATS, 30);
    stats = applyAddRound(stats, 30);
    expect(stats.addedRoundSecs).toBe(60);
  });
});

describe('composition of multiple stat mutations', () => {
  it('applies a sequence of events without cross-contaminating fields', () => {
    let stats: SessionStats = ZERO_STATS;
    stats = applySkip(stats, workSeg, 5);
    stats = applySkipBack(stats, restSeg, 4);
    stats = applyExtend(stats, 10);
    stats = applyAddRound(stats, 60);
    expect(stats).toEqual({
      skippedCount: 1,
      skippedSecs: 5,
      skippedWorkSecs: 5,
      extendedSecs: 10,
      addedRoundSecs: 60,
      skipBackSecs: 4,
      skipBackWorkSecs: 0,
      skipBackWorkCount: 0,
    });
  });
});
