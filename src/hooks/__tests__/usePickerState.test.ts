import { act, renderHook } from '@testing-library/react-native';
import { usePickerState, MIN_TARGET_DURATION_MINUTES, MAX_TARGET_DURATION_MINUTES } from '../usePickerState';
import { shapes, type PickerSpec } from '../pickerShapes';

const spec = (over: Partial<PickerSpec> = {}): PickerSpec => ({
  title: 'T', shape: shapes.duration, current: 65, onCommit: jest.fn(), ...over,
});

describe('usePickerState', () => {
  it('starts closed; openPicker exposes the spec title, columns, separator and encoded selection', async () => {
    const { result } = await renderHook(() => usePickerState());
    expect(result.current.picker).toBeNull();

    await act(async () => result.current.openPicker(spec()));
    expect(result.current.picker!.title).toBe('T');
    expect(result.current.picker!.selected).toEqual([1, 5]);
    expect(result.current.picker!.columns).toHaveLength(2);
    expect(result.current.picker!.separator).toBe(':');
  });

  it('openPicker(null) is a no-op', async () => {
    const { result } = await renderHook(() => usePickerState());
    await act(async () => result.current.openPicker(null));
    expect(result.current.picker).toBeNull();
  });

  it('commitPicker decodes the wheel selection, calls onCommit, and closes', async () => {
    const onCommit = jest.fn();
    const { result } = await renderHook(() => usePickerState());
    await act(async () => result.current.openPicker(spec({ onCommit })));
    await act(async () => result.current.commitPicker({ selected: [2, 30] }));

    expect(onCommit).toHaveBeenCalledWith(150);
    expect(result.current.picker).toBeNull();
  });

  it('dismissPicker closes without committing; commitPicker with nothing open does nothing', async () => {
    const onCommit = jest.fn();
    const { result } = await renderHook(() => usePickerState());
    await act(async () => result.current.commitPicker({ selected: [0, 0] }));
    await act(async () => result.current.openPicker(spec({ onCommit })));
    await act(async () => result.current.dismissPicker());

    expect(result.current.picker).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('shapes: encode/decode', () => {
  const roundTrips: Array<[string, { encode: (v: number) => number[]; decode: (i: number[]) => number }, number]> = [
    ['duration', shapes.duration, 125],
    ['count', shapes.count('x'), 7],
    ['targetMinutes', shapes.targetMinutes, 45],
    ['tabataMinutes', shapes.tabataMinutes, 240],
    ['resistance', shapes.resistance, 4],
    ['power', shapes.power, 70],
    ['incline', shapes.incline, 3.5],
    ['speed', shapes.speed(false), 12.5],
  ];
  it.each(roundTrips)('%s round-trips', (_name, shape, value) => {
    expect(shape.decode(shape.encode(value))).toBe(value);
  });

  it('count and resistance are 1-based, power starts at 40 W in 10 W steps, incline in 0.5% steps', () => {
    expect(shapes.count('x').encode(5)).toEqual([4]);
    expect(shapes.resistance.encode(4)).toEqual([3]);
    expect(shapes.power.encode(70)).toEqual([3]);
    expect(shapes.incline.encode(3.5)).toEqual([7]);
  });

  it('targetMinutes clamps below the minimum; the max is derived from the label count', () => {
    expect(shapes.targetMinutes.encode(1)).toEqual([0]);
    expect(shapes.targetMinutes.encode(25)).toEqual([25 - MIN_TARGET_DURATION_MINUTES]);
    expect(MAX_TARGET_DURATION_MINUTES).toBe(MIN_TARGET_DURATION_MINUTES + 171 - 1);
  });

  it('tabataMinutes falls back to the last step for an off-grid value', () => {
    expect(shapes.tabataMinutes.encode(123)).toEqual([shapes.tabataMinutes.columns()[0].values.length - 1]);
  });

  it('speed splits whole/tenths, labels the unit, and uses a "." separator', () => {
    expect(shapes.speed(false).encode(12.5)).toEqual([12, 5]);
    expect(shapes.speed(false).columns()[0].unitLabel).toBe('km/h');
    expect(shapes.speed(true).columns()[0].unitLabel).toBe('mph');
    expect(shapes.speed(false).separator).toBe('.');
  });
});
