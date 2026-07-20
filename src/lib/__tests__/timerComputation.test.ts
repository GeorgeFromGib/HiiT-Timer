import { computeTimerSnapshot, computeBeatSchedule } from '../timerComputation';
import { intervalsToSegments } from '../workout';

describe('computeTimerSnapshot', () => {
  const segments = intervalsToSegments([
    { type: 'warmup', dur: 10 },
    { type: 'work', dur: 20 },
    { type: 'rest', dur: 5 },
  ]);

  it('reports the current segment index and remaining time mid-segment', () => {
    const snap = computeTimerSnapshot(15, segments);
    expect(snap).toEqual({
      isFinished: false,
      index: 1,
      remainingInSegment: 15, // work segment ends at 30, elapsed 15 -> 15 remaining
      remainingTotal: 20,     // total 35, elapsed 15
    });
  });

  it('reports the first segment at elapsed 0', () => {
    const snap = computeTimerSnapshot(0, segments);
    expect(snap.index).toBe(0);
    expect(snap.remainingInSegment).toBe(10);
    expect(snap.remainingTotal).toBe(35);
  });

  it('marks finished when elapsed equals total duration', () => {
    const snap = computeTimerSnapshot(35, segments);
    expect(snap).toEqual({ isFinished: true, index: -1, remainingInSegment: 0, remainingTotal: 0 });
  });

  it('marks finished when elapsed exceeds total duration', () => {
    const snap = computeTimerSnapshot(100, segments);
    expect(snap.isFinished).toBe(true);
  });

  it('handles an empty segment list as finished immediately', () => {
    const snap = computeTimerSnapshot(0, []);
    expect(snap).toEqual({ isFinished: true, index: -1, remainingInSegment: 0, remainingTotal: 0 });
  });
});

describe('computeBeatSchedule', () => {
  it('schedules a prepare cue and all three beats when plenty of time remains', () => {
    const schedule = computeBeatSchedule(10);
    expect(schedule.prepareDelayMs).toBe(5000);
    expect(schedule.beats).toEqual([
      { beat: 3, delayMs: 7000 },
      { beat: 2, delayMs: 8000 },
      { beat: 1, delayMs: 9000 },
    ]);
  });

  it('omits the prepare cue when remaining is under 5 seconds', () => {
    const schedule = computeBeatSchedule(4);
    expect(schedule.prepareDelayMs).toBeNull();
  });

  it('includes the prepare cue exactly at the 5 second boundary', () => {
    const schedule = computeBeatSchedule(5);
    expect(schedule.prepareDelayMs).toBe(0);
  });

  it('filters out beats whose delay would be negative', () => {
    const schedule = computeBeatSchedule(2);
    // beat 3 would be delayMs -1000 -> excluded; beat 2 -> 0; beat 1 -> 1000
    expect(schedule.beats).toEqual([
      { beat: 2, delayMs: 0 },
      { beat: 1, delayMs: 1000 },
    ]);
  });

  it('returns no beats when remaining time is 0', () => {
    const schedule = computeBeatSchedule(0);
    expect(schedule.beats).toEqual([]);
    expect(schedule.prepareDelayMs).toBeNull();
  });

  it('returns no beats when remaining time is negative', () => {
    const schedule = computeBeatSchedule(-5);
    expect(schedule.beats).toEqual([]);
    expect(schedule.prepareDelayMs).toBeNull();
  });
});
