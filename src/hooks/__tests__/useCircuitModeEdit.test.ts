import { act, renderHook } from '@testing-library/react-native';
import { useCircuitModeEdit } from '../useCircuitModeEdit';
import { type Session } from '../../lib/sessions';

const circuitSession: Session = {
  id: 's1',
  name: 'Circuit Session',
  folderId: 'f1',
  mode: 'circuit',
  intervals: [
    { type: 'work', dur: 40, activityLabel: 'Push-ups' },
    { type: 'rest', dur: 20 },
  ],
  circuits: 5,
  warmup: 15,
  cooldown: 25,
  circuitRest: 10,
};

const easySession: Session = {
  id: 's2',
  name: 'Easy Session',
  folderId: 'f1',
  mode: 'easy',
  config: { warmup: 10, high: 20, low: 5, rounds: 3, cooldown: 15 },
};

describe('useCircuitModeEdit', () => {
  it('seeds field values from a circuit-mode session', async () => {
    const { result } = await renderHook(() => useCircuitModeEdit(circuitSession));
    expect(result.current.circuitWarmup).toBe(15);
    expect(result.current.circuitCooldown).toBe(25);
    expect(result.current.circuitRest).toBe(10);
    expect(result.current.circuitCount).toBe(5);
    expect(result.current.hasChanges).toBe(false);
  });

  it('falls back to DEFAULTS when the session is undefined', async () => {
    const { result } = await renderHook(() => useCircuitModeEdit(undefined));
    expect(result.current.circuitWarmup).toBe(60);
    expect(result.current.circuitCooldown).toBe(60);
    expect(result.current.circuitRest).toBe(30);
    expect(result.current.circuitCount).toBe(3);
    expect(result.current.hasChanges).toBe(false);
  });

  it('falls back to DEFAULTS when the session is not in circuit mode', async () => {
    const { result } = await renderHook(() => useCircuitModeEdit(easySession));
    expect(result.current.circuitWarmup).toBe(60);
    expect(result.current.circuitCooldown).toBe(60);
    expect(result.current.circuitRest).toBe(30);
    expect(result.current.circuitCount).toBe(3);
  });

  it('set() updates the given field and marks hasChanges true', async () => {
    const { result } = await renderHook(() => useCircuitModeEdit(circuitSession));

    await act(async () => result.current.set('warmup', 45));
    expect(result.current.circuitWarmup).toBe(45);
    expect(result.current.hasChanges).toBe(true);
  });

  it('set() updates each field independently (cooldown, rest, count)', async () => {
    const { result } = await renderHook(() => useCircuitModeEdit(circuitSession));

    await act(async () => result.current.set('cooldown', 99));
    expect(result.current.circuitCooldown).toBe(99);

    await act(async () => result.current.set('rest', 12));
    expect(result.current.circuitRest).toBe(12);

    await act(async () => result.current.set('count', 7));
    expect(result.current.circuitCount).toBe(7);
  });

  it('hasChanges returns false again after setting fields back to their original values', async () => {
    const { result } = await renderHook(() => useCircuitModeEdit(circuitSession));

    await act(async () => result.current.set('warmup', 45));
    expect(result.current.hasChanges).toBe(true);

    await act(async () => result.current.set('warmup', 15));
    expect(result.current.hasChanges).toBe(false);
  });

  it('reset() restores all fields to DEFAULTS, not the original session values', async () => {
    const { result } = await renderHook(() => useCircuitModeEdit(circuitSession));

    await act(async () => result.current.set('warmup', 45));
    await act(async () => result.current.reset());

    expect(result.current.circuitWarmup).toBe(60);
    expect(result.current.circuitCooldown).toBe(60);
    expect(result.current.circuitRest).toBe(30);
    expect(result.current.circuitCount).toBe(3);
  });

  it('startTabata seeds the canonical locked config for a brand-new Tabata session', async () => {
    const { result } = await renderHook(() => useCircuitModeEdit(undefined, true));

    expect(result.current.tabata).toBe(true);
    expect(result.current.circuitWarmup).toBe(300);
    expect(result.current.circuitCooldown).toBe(300);
    expect(result.current.circuitRest).toBe(0);
    expect(result.current.circuitCount).toBe(1);
    expect(result.current.hasChanges).toBe(false);
  });

  it('an existing circuit session ignores startTabata and keeps its saved values', async () => {
    const { result } = await renderHook(() => useCircuitModeEdit(circuitSession, true));

    expect(result.current.tabata).toBe(false);
    expect(result.current.circuitWarmup).toBe(15);
  });

  it('seeds tabata=true from a saved Tabata circuit with no spurious changes', async () => {
    const tabataSession: Session = {
      ...circuitSession, tabata: true, warmup: 300, cooldown: 300, circuitRest: 0, circuits: 1,
    };
    const { result } = await renderHook(() => useCircuitModeEdit(tabataSession));

    expect(result.current.tabata).toBe(true);
    expect(result.current.hasChanges).toBe(false);
  });

  it('reset() on a circuit session with values matching DEFAULTS leaves hasChanges reflecting the diff from the original snapshot', async () => {
    // Session equal to DEFAULTS: reset() sets state to DEFAULTS, which differs from the
    // draft's original snapshot (also DEFAULTS here), so hasChanges should be false.
    const defaultsSession: Session = { ...circuitSession, warmup: 60, cooldown: 60, circuitRest: 30, circuits: 3 };
    const { result } = await renderHook(() => useCircuitModeEdit(defaultsSession));

    await act(async () => result.current.set('warmup', 10));
    expect(result.current.hasChanges).toBe(true);

    await act(async () => result.current.reset());
    expect(result.current.hasChanges).toBe(false);
  });
});
