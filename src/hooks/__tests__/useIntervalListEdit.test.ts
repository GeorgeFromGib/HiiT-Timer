import { act, renderHook } from '@testing-library/react-native';
import { useIntervalListEdit } from '../useIntervalListEdit';
import { type Session } from '../../lib/sessions';
import { type Interval } from '../../lib/workout';

const advancedSession = (intervals: Interval[]): Session => ({
  id: 'sess-1', name: 'Advanced', folderId: 'default', mode: 'advanced', intervals,
});

const circuitSession = (intervals: Interval[]): Session => ({
  id: 'sess-2', name: 'Circuit', folderId: 'default', mode: 'circuit',
  intervals, circuits: 2, warmup: 30, cooldown: 30, circuitRest: 15,
});

const easySession: Session = {
  id: 'sess-3', name: 'Easy', folderId: 'default', mode: 'easy',
  config: { warmup: 10, high: 20, low: 5, rounds: 2, cooldown: 10 },
};

describe('useIntervalListEdit', () => {
  it('starts with an empty interval list when no existing session is given', async () => {
    const { result } = await renderHook(() => useIntervalListEdit(undefined));
    expect(result.current.intervals).toEqual([]);
    expect(result.current.hasChanges).toBe(false);
    expect(result.current.isTimingDirty).toBe(false);
  });

  it('starts with an empty interval list for an easy-mode session', async () => {
    const { result } = await renderHook(() => useIntervalListEdit(easySession));
    expect(result.current.intervals).toEqual([]);
  });

  it('seeds intervals from an advanced session, assigning a _key to each', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }, { type: 'rest', dur: 10 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));
    expect(result.current.intervals).toHaveLength(2);
    expect(result.current.intervals[0]).toMatchObject({ type: 'work', dur: 20 });
    expect(result.current.intervals[1]).toMatchObject({ type: 'rest', dur: 10 });
    expect(typeof result.current.intervals[0]._key).toBe('string');
    expect(result.current.intervals[0]._key).not.toBe(result.current.intervals[1]._key);
  });

  it('seeds intervals from a circuit session', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 30 }];
    const { result } = await renderHook(() => useIntervalListEdit(circuitSession(ivs)));
    expect(result.current.intervals).toHaveLength(1);
    expect(result.current.intervals[0]).toMatchObject({ type: 'work', dur: 30 });
  });

  it('cyclePhase advances to the next phase in the given list and wraps around', async () => {
    const { result } = await renderHook(() =>
      useIntervalListEdit(advancedSession([{ type: 'work', dur: 20 }]))
    );
    const key = result.current.intervals[0]._key;

    await act(async () => result.current.cyclePhase(key, ['work', 'rest', 'cooldown']));
    expect(result.current.intervals[0].type).toBe('rest');

    await act(async () => result.current.cyclePhase(key, ['work', 'rest', 'cooldown']));
    expect(result.current.intervals[0].type).toBe('cooldown');

    await act(async () => result.current.cyclePhase(key, ['work', 'rest', 'cooldown']));
    expect(result.current.intervals[0].type).toBe('work');
  });

  it('cyclePhase jumps to the first phase in the list when current type is not present', async () => {
    const { result } = await renderHook(() =>
      useIntervalListEdit(advancedSession([{ type: 'warmup', dur: 20 }]))
    );
    const key = result.current.intervals[0]._key;

    await act(async () => result.current.cyclePhase(key, ['work', 'rest']));
    expect(result.current.intervals[0].type).toBe('work');
  });

  it('cyclePhase is a no-op for a key that does not exist', async () => {
    const { result } = await renderHook(() =>
      useIntervalListEdit(advancedSession([{ type: 'work', dur: 20 }]))
    );
    await act(async () => result.current.cyclePhase('missing-key', ['work', 'rest']));
    expect(result.current.intervals[0].type).toBe('work');
  });

  it('addInterval appends a default 30s interval with no matching prior interval of that type', async () => {
    const { result } = await renderHook(() => useIntervalListEdit(undefined));
    await act(async () => result.current.addInterval('work'));
    expect(result.current.intervals).toHaveLength(1);
    expect(result.current.intervals[0]).toMatchObject({ type: 'work', dur: 30, activityLabel: undefined });
  });

  it('addInterval copies dur/activityLabel from the last interval of the same type', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 45, activityLabel: 'Burpees' }, { type: 'rest', dur: 10 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));
    await act(async () => result.current.addInterval('work'));
    expect(result.current.intervals).toHaveLength(3);
    expect(result.current.intervals[2]).toMatchObject({ type: 'work', dur: 45, activityLabel: 'Burpees' });
  });

  it('duplicateInterval inserts a copy directly after the source, with a new _key', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }, { type: 'rest', dur: 10 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));
    const key = result.current.intervals[0]._key;

    await act(async () => result.current.duplicateInterval(key));
    expect(result.current.intervals).toHaveLength(3);
    expect(result.current.intervals[0]).toMatchObject({ type: 'work', dur: 20 });
    expect(result.current.intervals[1]).toMatchObject({ type: 'work', dur: 20 });
    expect(result.current.intervals[1]._key).not.toBe(result.current.intervals[0]._key);
    expect(result.current.intervals[2]).toMatchObject({ type: 'rest', dur: 10 });
  });

  it('duplicateInterval is a no-op for a key that does not exist', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));
    await act(async () => result.current.duplicateInterval('missing-key'));
    expect(result.current.intervals).toHaveLength(1);
  });

  it('removeInterval removes the interval with the given key', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }, { type: 'rest', dur: 10 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));
    const key = result.current.intervals[0]._key;

    await act(async () => result.current.removeInterval(key));
    expect(result.current.intervals).toHaveLength(1);
    expect(result.current.intervals[0]).toMatchObject({ type: 'rest', dur: 10 });
  });

  it('clearIntervals empties the list', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }, { type: 'rest', dur: 10 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));
    await act(async () => result.current.clearIntervals());
    expect(result.current.intervals).toEqual([]);
  });

  it('reorderIntervals replaces the list with the given order', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }, { type: 'rest', dur: 10 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));
    const reversed = [...result.current.intervals].reverse();

    await act(async () => result.current.reorderIntervals(reversed));
    expect(result.current.intervals[0].type).toBe('rest');
    expect(result.current.intervals[1].type).toBe('work');
  });

  it('setActivityLabel updates only the matching interval', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }, { type: 'work', dur: 20 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));
    const key = result.current.intervals[0]._key;

    await act(async () => result.current.setActivityLabel(key, 'Squats'));
    expect(result.current.intervals[0].activityLabel).toBe('Squats');
    expect(result.current.intervals[1].activityLabel).toBeUndefined();
  });

  it('setIntervalDuration updates the duration of the matching interval', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));
    const key = result.current.intervals[0]._key;

    await act(async () => result.current.setIntervalDuration(key, 99));
    expect(result.current.intervals[0].dur).toBe(99);
  });

  it('setIntervalSpeed sets speed and clearIntervalSpeed clears it', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));
    const key = result.current.intervals[0]._key;

    await act(async () => result.current.setIntervalSpeed(key, 12.5));
    expect(result.current.intervals[0].speed).toBe(12.5);

    await act(async () => result.current.clearIntervalSpeed(key));
    expect(result.current.intervals[0].speed).toBeUndefined();
  });

  it('setIntervalIncline sets incline and clearIntervalIncline clears it', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));
    const key = result.current.intervals[0]._key;

    await act(async () => result.current.setIntervalIncline(key, 4));
    expect(result.current.intervals[0].incline).toBe(4);

    await act(async () => result.current.clearIntervalIncline(key));
    expect(result.current.intervals[0].incline).toBeUndefined();
  });

  it('setIntervalResistance sets resistance and clearIntervalResistance clears it', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));
    const key = result.current.intervals[0]._key;

    await act(async () => result.current.setIntervalResistance(key, 6));
    expect(result.current.intervals[0].resistance).toBe(6);

    await act(async () => result.current.clearIntervalResistance(key));
    expect(result.current.intervals[0].resistance).toBeUndefined();
  });

  it('setIntervalPower sets power and clearIntervalPower clears it', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));
    const key = result.current.intervals[0]._key;

    await act(async () => result.current.setIntervalPower(key, 150));
    expect(result.current.intervals[0].power).toBe(150);

    await act(async () => result.current.clearIntervalPower(key));
    expect(result.current.intervals[0].power).toBeUndefined();
  });

  it('buildFromEasy replaces the interval list from an easy config', async () => {
    const { result } = await renderHook(() => useIntervalListEdit(undefined));
    await act(async () => result.current.buildFromEasy({ warmup: 10, high: 20, low: 5, rounds: 2, cooldown: 15 }));

    expect(result.current.intervals.map(iv => iv.type)).toEqual([
      'warmup', 'work', 'rest', 'work', 'rest', 'cooldown',
    ]);
    expect(result.current.intervals.every(iv => typeof iv._key === 'string')).toBe(true);
  });

  it('buildFromEasy resets isTimingDirty (checkpoint) but hasChanges still reflects divergence from the original session', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));

    await act(async () => result.current.buildFromEasy({ warmup: 0, high: 99, low: 0, rounds: 1, cooldown: 0 }));
    expect(result.current.isTimingDirty).toBe(false);
    expect(result.current.hasChanges).toBe(true);
  });

  it('hasChanges is true after a mutation and isTimingDirty tracks divergence since last buildFromEasy', async () => {
    const ivs: Interval[] = [{ type: 'work', dur: 20 }];
    const { result } = await renderHook(() => useIntervalListEdit(advancedSession(ivs)));
    expect(result.current.hasChanges).toBe(false);
    expect(result.current.isTimingDirty).toBe(false);

    const key = result.current.intervals[0]._key;
    await act(async () => result.current.setIntervalDuration(key, 99));

    expect(result.current.hasChanges).toBe(true);
    expect(result.current.isTimingDirty).toBe(true);
  });

  it('exposes the tryConvertToEasy helper from lib/workout', async () => {
    const { result } = await renderHook(() => useIntervalListEdit(undefined));
    expect(typeof result.current.tryConvertToEasy).toBe('function');
    expect(result.current.tryConvertToEasy([{ type: 'work', dur: 20 }])).toEqual({
      ok: true, warmup: 0, work: 20, rest: 0, rounds: 1, cooldown: 0,
    });
  });
});
