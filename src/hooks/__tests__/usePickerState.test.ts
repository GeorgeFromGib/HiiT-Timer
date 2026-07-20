import { act, renderHook } from '@testing-library/react-native';
import {
  usePickerState, MIN_TARGET_DURATION_MINUTES, MAX_TARGET_DURATION_MINUTES,
  type CommitResult,
} from '../usePickerState';
import { type LocalInterval, type TimeField } from '../editSessionTypes';
import { convertMphToKmh } from '../../lib/workout';

const intervals: LocalInterval[] = [
  { type: 'work', dur: 20, _key: 'a' },
  { type: 'rest', dur: 10, _key: 'b' },
];

const fieldValues: Record<TimeField, number> = { warmup: 300, work: 20, rest: 10, cooldown: 60 };
const circuitValues = { warmup: 45, cooldown: 30, rest: 15, count: 3 };

async function setup(onCommit = jest.fn()) {
  const hook = await renderHook(() =>
    usePickerState(intervals, fieldValues, circuitValues, onCommit),
  );
  return { ...hook, onCommit };
}

describe('usePickerState', () => {
  it('starts with no active picker', async () => {
    const { result } = await setup();
    expect(result.current.picker).toBeNull();
  });

  it('openFieldPicker opens a duration picker seeded from fieldValues', async () => {
    const { result } = await setup();
    await act(async () => result.current.openFieldPicker('work'));

    expect(result.current.picker).not.toBeNull();
    expect(result.current.picker!.title).toBe('Work'); // phases.work — sanity, not asserting exact copy elsewhere
    expect(result.current.picker!.selected).toEqual([0, 20]); // encodeDuration(20)
    expect(result.current.picker!.columns).toHaveLength(2);
    expect(result.current.picker!.columns[0].values).toHaveLength(60);
    expect(result.current.picker!.separator).toBe(':');
  });

  it('openRoundsPicker seeds selected as currentRounds - 1', async () => {
    const { result } = await setup();
    await act(async () => result.current.openRoundsPicker(5));

    expect(result.current.picker!.title).toBe('Rounds');
    expect(result.current.picker!.selected).toEqual([4]);
    expect(result.current.picker!.columns).toHaveLength(1);
    expect(result.current.picker!.separator).toBeUndefined();
  });

  it('openTargetDurationPicker seeds from currentMinutes when within range', async () => {
    const { result } = await setup();
    await act(async () => result.current.openTargetDurationPicker(25));

    expect(result.current.picker!.title).toBe('Session Length');
    expect(result.current.picker!.selected).toEqual([25 - MIN_TARGET_DURATION_MINUTES]);
  });

  it('openTargetDurationPicker clamps currentMinutes below the minimum up to MIN_TARGET_DURATION_MINUTES', async () => {
    const { result } = await setup();
    await act(async () => result.current.openTargetDurationPicker(1));

    expect(result.current.picker!.selected).toEqual([0]);
  });

  it('MAX_TARGET_DURATION_MINUTES is derived from the label count', () => {
    expect(MAX_TARGET_DURATION_MINUTES).toBe(MIN_TARGET_DURATION_MINUTES + 171 - 1);
  });

  it('openIntervalPicker opens a duration picker seeded from the matching interval', async () => {
    const { result } = await setup();
    await act(async () => result.current.openIntervalPicker('b'));

    expect(result.current.picker!.title).toBe('Interval 2'); // idx 1 -> n=2
    expect(result.current.picker!.selected).toEqual([0, 10]); // encodeDuration(10)
  });

  it('openIntervalPicker is a no-op for an unknown key', async () => {
    const { result } = await setup();
    await act(async () => result.current.openIntervalPicker('missing'));
    expect(result.current.picker).toBeNull();
  });

  it('openSpeedPicker encodes the display value into whole/decimal columns', async () => {
    const { result } = await setup();
    await act(async () => result.current.openSpeedPicker('workSpeed', 12.5, false));

    expect(result.current.picker!.title).toBe('Work Speed');
    expect(result.current.picker!.selected).toEqual([12, 5]);
    expect(result.current.picker!.columns[0].unitLabel).toBe('km/h');
    expect(result.current.picker!.separator).toBe('.');
  });

  it('openSpeedPicker uses mph column labels when isMiles is true', async () => {
    const { result } = await setup();
    await act(async () => result.current.openSpeedPicker('workSpeed', 6, true));
    expect(result.current.picker!.columns[0].unitLabel).toBe('mph');
  });

  it('openIntervalSpeedPicker titles by the interval position', async () => {
    const { result } = await setup();
    await act(async () => result.current.openIntervalSpeedPicker('b', 8, false));
    expect(result.current.picker!.title).toBe('Interval 2 Speed');
    expect(result.current.picker!.selected).toEqual([8, 0]);
  });

  it('openCircuitWarmupPicker/openCircuitCooldownPicker/openCircuitRestPicker seed from circuitValues', async () => {
    const { result } = await setup();

    await act(async () => result.current.openCircuitWarmupPicker());
    expect(result.current.picker!.title).toBe('Warm Up');
    expect(result.current.picker!.selected).toEqual([0, 45]);

    await act(async () => result.current.openCircuitCooldownPicker());
    expect(result.current.picker!.title).toBe('Cool Down');
    expect(result.current.picker!.selected).toEqual([0, 30]);

    await act(async () => result.current.openCircuitRestPicker());
    expect(result.current.picker!.selected).toEqual([0, 15]);
  });

  it('openCircuitCountPicker seeds selected as count - 1', async () => {
    const { result } = await setup();
    await act(async () => result.current.openCircuitCountPicker());
    expect(result.current.picker!.title).toBe('Sets');
    expect(result.current.picker!.selected).toEqual([2]);
  });

  it('openSpinResistancePicker/openSpinPowerPicker encode resistance and power', async () => {
    const { result } = await setup();

    await act(async () => result.current.openSpinResistancePicker('resistance', 4));
    expect(result.current.picker!.title).toBe('Resistance');
    expect(result.current.picker!.selected).toEqual([3]);

    await act(async () => result.current.openSpinPowerPicker('power', 70));
    expect(result.current.picker!.title).toBe('Power');
    expect(result.current.picker!.selected).toEqual([3]); // (70-40)/10
  });

  it('openIntervalResistancePicker/openIntervalPowerPicker encode per-interval values', async () => {
    const { result } = await setup();

    await act(async () => result.current.openIntervalResistancePicker('a', 1));
    expect(result.current.picker!.selected).toEqual([0]);

    await act(async () => result.current.openIntervalPowerPicker('a', 40));
    expect(result.current.picker!.selected).toEqual([0]);
  });

  it('openInclinePicker/openIntervalInclinePicker encode 0.5 steps', async () => {
    const { result } = await setup();

    await act(async () => result.current.openInclinePicker('workIncline', 3.5));
    expect(result.current.picker!.title).toBe('Incline');
    expect(result.current.picker!.selected).toEqual([7]);

    await act(async () => result.current.openIntervalInclinePicker('a', 0));
    expect(result.current.picker!.selected).toEqual([0]);
  });

  it('dismissPicker clears the active picker without calling onCommit', async () => {
    const { result, onCommit } = await setup();
    await act(async () => result.current.openRoundsPicker(3));
    await act(async () => result.current.dismissPicker());

    expect(result.current.picker).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commitPicker is a no-op when there is no active picker', async () => {
    const { result, onCommit } = await setup();
    await act(async () => result.current.commitPicker({ selected: [0] }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commitPicker decodes and closes for every picker type', async () => {
    const cases: Array<{
      open: (r: Awaited<ReturnType<typeof setup>>['result']['current']) => void;
      selected: number[];
      expected: CommitResult;
    }> = [
      { open: (r) => r.openRoundsPicker(1), selected: [4], expected: { type: 'rounds', value: 5 } },
      { open: (r) => r.openTargetDurationPicker(10), selected: [5], expected: { type: 'targetDuration', minutes: 15 } },
      { open: (r) => r.openFieldPicker('warmup'), selected: [1, 5], expected: { type: 'field', field: 'warmup', secs: 65 } },
      { open: (r) => r.openIntervalPicker('a'), selected: [0, 45], expected: { type: 'interval', key: 'a', secs: 45 } },
      { open: (r) => r.openSpeedPicker('workSpeed', 10, false), selected: [12, 5], expected: { type: 'speed', field: 'workSpeed', kmh: 12.5 } },
      { open: (r) => r.openIntervalSpeedPicker('a', 10, false), selected: [8, 0], expected: { type: 'intervalSpeed', key: 'a', kmh: 8 } },
      { open: (r) => r.openCircuitWarmupPicker(), selected: [1, 30], expected: { type: 'circuitWarmup', secs: 90 } },
      { open: (r) => r.openCircuitCooldownPicker(), selected: [0, 20], expected: { type: 'circuitCooldown', secs: 20 } },
      { open: (r) => r.openCircuitRestPicker(), selected: [0, 5], expected: { type: 'circuitRest', secs: 5 } },
      { open: (r) => r.openCircuitCountPicker(), selected: [3], expected: { type: 'circuitCount', value: 4 } },
      { open: (r) => r.openSpinResistancePicker('resistance', 1), selected: [6], expected: { type: 'spinResistance', field: 'resistance', value: 7 } },
      { open: (r) => r.openSpinPowerPicker('power', 40), selected: [3], expected: { type: 'spinPower', field: 'power', value: 70 } },
      { open: (r) => r.openIntervalResistancePicker('a', 1), selected: [5], expected: { type: 'intervalResistance', key: 'a', value: 6 } },
      { open: (r) => r.openIntervalPowerPicker('a', 40), selected: [2], expected: { type: 'intervalPower', key: 'a', value: 60 } },
      { open: (r) => r.openInclinePicker('workIncline', 0), selected: [9], expected: { type: 'incline', field: 'workIncline', value: 4.5 } },
      { open: (r) => r.openIntervalInclinePicker('a', 0), selected: [4], expected: { type: 'intervalIncline', key: 'a', value: 2 } },
    ];

    for (const { open, selected, expected } of cases) {
      const { result, onCommit } = await setup();
      await act(async () => open(result.current));
      await act(async () => result.current.commitPicker({ selected }));

      expect(onCommit).toHaveBeenCalledWith(expected);
      expect(result.current.picker).toBeNull();
    }
  });

  it('commitPicker on a speed picker converts mph selection back to km/h', async () => {
    const { result, onCommit } = await setup();
    await act(async () => result.current.openSpeedPicker('workSpeed', 6, true));
    await act(async () => result.current.commitPicker({ selected: [6, 0] }));

    expect(onCommit).toHaveBeenCalledWith({ type: 'speed', field: 'workSpeed', kmh: convertMphToKmh(6) });
  });
});
