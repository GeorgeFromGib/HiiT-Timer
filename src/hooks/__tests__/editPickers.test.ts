import { editPickers } from '../editPickers';
import { DEFAULT_RUN_INCLINES, DEFAULT_RUN_SPEEDS, DEFAULT_SPIN_VALUES } from '../../lib/sessions';
import { convertMphToKmh } from '../../lib/workout';
import { warnIfShortDuration } from '../../lib/appAlert';

jest.mock('../../lib/appAlert', () => ({ warnIfShortDuration: jest.fn() }));

function setup() {
  const circuit = { circuitWarmup: 45, circuitCooldown: 30, circuitRest: 15, circuitCount: 3, set: jest.fn() };
  const speedSpin = {
    runSpeeds: DEFAULT_RUN_SPEEDS, runInclines: DEFAULT_RUN_INCLINES, spinValues: DEFAULT_SPIN_VALUES,
    setRunSpeed: jest.fn(), setRunIncline: jest.fn(), setSpinValue: jest.fn(),
  };
  const intervalEdit = {
    setIntervalDuration: jest.fn(), setIntervalSpeed: jest.fn(), setIntervalResistance: jest.fn(),
    setIntervalPower: jest.fn(), setIntervalIncline: jest.fn(),
  };
  const onField = jest.fn(), onRounds = jest.fn(), onTargetDuration = jest.fn();
  const pickers = editPickers({
    intervals: [{ type: 'work', dur: 20, _key: 'a' }, { type: 'rest', dur: 10, _key: 'b' }],
    fieldValues: { warmup: 300, work: 20, rest: 10, cooldown: 60 },
    circuit, speedSpin, intervalEdit, onField, onRounds, onTargetDuration,
  } as any);
  return { pickers, circuit, speedSpin, intervalEdit, onField, onRounds, onTargetDuration };
}

// commit a picker at wheel `selected` and return its spec for title/seed assertions
const commit = (spec: any, selected: number[]) => { spec.onCommit(spec.shape.decode(selected)); return spec; };
const seed = (spec: any) => spec.shape.encode(spec.current);

describe('editPickers', () => {
  it('field / rounds / targetDuration hand their decoded value to the coordinator', () => {
    const { pickers, onField, onRounds, onTargetDuration } = setup();
    expect(seed(commit(pickers.field('work'), [1, 5]))).toEqual([0, 20]);
    expect(onField).toHaveBeenCalledWith('work', 65);
    expect(commit(pickers.rounds(5), [9]).title).toBe('Rounds');
    expect(onRounds).toHaveBeenCalledWith(10);
    commit(pickers.targetDuration(25), [5]);
    expect(onTargetDuration).toHaveBeenCalledWith(15);
  });

  it('interval pickers title by position, seed from the interval, and are null for an unknown key', () => {
    const { pickers, intervalEdit } = setup();
    const spec = commit(pickers.interval('b')!, [0, 45]);
    expect(spec.title).toBe('Interval 2');
    expect(seed(spec)).toEqual([0, 10]);
    expect(intervalEdit.setIntervalDuration).toHaveBeenCalledWith('b', 45);
    expect(pickers.interval('missing')).toBeNull();
    expect(pickers.intervalSpeed('missing', false)).toBeNull();
  });

  it('circuit pickers seed from circuit values; warmup/cooldown warn when short, rest and tabata do not', () => {
    const { pickers, circuit } = setup();
    expect(seed(commit(pickers.circuitWarmup(), [0, 20]))).toEqual([0, 45]);
    expect(circuit.set).toHaveBeenLastCalledWith('warmup', 20);
    expect(warnIfShortDuration).toHaveBeenCalledWith(20);
    (warnIfShortDuration as jest.Mock).mockClear();

    expect(commit(pickers.circuitCooldown(), [0, 25]).title).toBe('Cool Down');
    commit(pickers.circuitRest(), [0, 5]);
    expect(circuit.set).toHaveBeenLastCalledWith('rest', 5);
    commit(pickers.circuitCount(), [3]);
    expect(circuit.set).toHaveBeenLastCalledWith('count', 4);
    commit(pickers.tabataWarmup(), [0]);
    expect(circuit.set).toHaveBeenLastCalledWith('warmup', 180);
    expect(warnIfShortDuration).toHaveBeenCalledTimes(1); // only the circuit cooldown
  });

  it('speed pickers show/commit in the display unit and store km/h', () => {
    const { pickers, speedSpin, intervalEdit } = setup();
    const mph = commit(pickers.speed('workSpeed', 6, true), [6, 0]);
    expect(mph.title).toBe('Work Speed');
    expect(speedSpin.setRunSpeed).toHaveBeenCalledWith('workSpeed', convertMphToKmh(6));
    commit(pickers.speed('workSpeed', 10, false), [12, 5]);
    expect(speedSpin.setRunSpeed).toHaveBeenLastCalledWith('workSpeed', 12.5);
    const iv = commit(pickers.intervalSpeed('b', false)!, [8, 0]);
    expect(iv.title).toBe('Interval 2 Speed');
    expect(intervalEdit.setIntervalSpeed).toHaveBeenCalledWith('b', 8);
  });

  it('spin and incline pickers seed from the session values and per-interval ones fall back to phase defaults', () => {
    const { pickers, speedSpin, intervalEdit } = setup();
    commit(pickers.spinResistance('workResistance'), [6]);
    expect(speedSpin.setSpinValue).toHaveBeenLastCalledWith('workResistance', 7);
    expect(commit(pickers.spinPower('workPower'), [3]).title).toBe('Power');
    expect(speedSpin.setSpinValue).toHaveBeenLastCalledWith('workPower', 70);
    commit(pickers.incline('workIncline'), [9]);
    expect(speedSpin.setRunIncline).toHaveBeenLastCalledWith('workIncline', 4.5);

    commit(pickers.intervalResistance('a')!, [5]);
    expect(intervalEdit.setIntervalResistance).toHaveBeenCalledWith('a', 6);
    commit(pickers.intervalPower('a')!, [2]);
    expect(intervalEdit.setIntervalPower).toHaveBeenCalledWith('a', 60);
    const inc = pickers.intervalIncline('a')!;
    expect(inc.current).toBe(DEFAULT_RUN_INCLINES.workIncline);
    commit(inc, [4]);
    expect(intervalEdit.setIntervalIncline).toHaveBeenCalledWith('a', 2);
  });
});
