import { act, renderHook } from '@testing-library/react-native';
import { useSpeedAndSpinEdit } from '../useSpeedAndSpinEdit';
import { useAppAlert, dismissAppAlert } from '../../lib/appAlert';
import {
  type Session, DEFAULT_RUN_SPEEDS, DEFAULT_RUN_INCLINES, DEFAULT_SPIN_VALUES,
} from '../../lib/sessions';
import { SPEED_PRESETS, WALK_SPEED_PRESETS, INCLINE_PRESETS, SPIN_PRESETS } from '../../lib/presets';

const runSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'run-1', name: 'Run', folderId: 'default', mode: 'easy', activityType: 'run',
  config: { warmup: 300, high: 45, low: 15, rounds: 5, cooldown: 300 },
  runSpeeds: SPEED_PRESETS['3'],
  runInclines: INCLINE_PRESETS['3'],
  ...overrides,
});

const spinSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'spin-1', name: 'Spin', folderId: 'default', mode: 'easy', activityType: 'spinning',
  config: { warmup: 300, high: 40, low: 20, rounds: 5, cooldown: 300 },
  spinValues: SPIN_PRESETS['3'],
  ...overrides,
});

const circuitSession: Session = {
  id: 'circuit-1', name: 'Circuit', folderId: 'default', mode: 'circuit',
  intervals: [{ type: 'work', dur: 30 }], circuits: 2, warmup: 30, cooldown: 30, circuitRest: 15,
};

afterEach(() => {
  dismissAppAlert();
});

describe('useSpeedAndSpinEdit', () => {
  it('defaults to DEFAULT_* values with no existing session', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(undefined));
    expect(result.current.runSpeeds).toEqual(DEFAULT_RUN_SPEEDS);
    expect(result.current.runInclines).toEqual(DEFAULT_RUN_INCLINES);
    expect(result.current.inclineEnabled).toBe(true);
    expect(result.current.spinValues).toEqual(DEFAULT_SPIN_VALUES);
    expect(result.current.activeSpeedPreset).toBeNull();
    expect(result.current.activeInclinePreset).toBeNull();
    expect(result.current.activeSpinPreset).toBeNull();
    expect(result.current.hasChanges).toBe(false);
  });

  it('seeds runSpeeds/runInclines/inclineEnabled and detects the matching preset for a run session', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession(), 'run'));
    expect(result.current.runSpeeds).toEqual(SPEED_PRESETS['3']);
    expect(result.current.runInclines).toEqual(INCLINE_PRESETS['3']);
    expect(result.current.inclineEnabled).toBe(true);
    expect(result.current.activeSpeedPreset).toBe('3');
    expect(result.current.activeInclinePreset).toBe('3');
  });

  it('respects an explicit inclineEnabled: false on the existing run session', async () => {
    const { result } = await renderHook(() =>
      useSpeedAndSpinEdit(runSession({ inclineEnabled: false }), 'run')
    );
    expect(result.current.inclineEnabled).toBe(false);
  });

  it('seeds spinValues and detects the matching preset for a spinning session', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(spinSession()));
    expect(result.current.spinValues).toEqual(SPIN_PRESETS['3']);
    expect(result.current.activeSpinPreset).toBe('3');
    // Not a run session, so run-only fields stay at defaults
    expect(result.current.runInclines).toEqual(DEFAULT_RUN_INCLINES);
  });

  it('falls back to defaults for a circuit-mode session regardless of activityType', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(circuitSession, 'run'));
    expect(result.current.runSpeeds).toEqual(DEFAULT_RUN_SPEEDS);
    expect(result.current.activeSpeedPreset).toBeNull();
  });

  it('uses walk speed presets when activityType is "walk"', async () => {
    const walkSpeeds = WALK_SPEED_PRESETS['4'];
    const session = runSession({ activityType: 'walk', runSpeeds: walkSpeeds, runInclines: undefined });
    const { result } = await renderHook(() => useSpeedAndSpinEdit(session, 'walk'));
    expect(result.current.runSpeeds).toEqual(walkSpeeds);
    expect(result.current.activeSpeedPreset).toBe('4');
    // Walk sessions don't seed runInclines (activityType !== 'run')
    expect(result.current.runInclines).toEqual(DEFAULT_RUN_INCLINES);
  });

  it('setRunSpeed updates one field, marks the preset as custom, and flips hasChanges', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession(), 'run'));
    await act(async () => result.current.setRunSpeed('workSpeed', 99));
    expect(result.current.runSpeeds.workSpeed).toBe(99);
    expect(result.current.runSpeeds.warmupSpeed).toBe(SPEED_PRESETS['3'].warmupSpeed);
    expect(result.current.activeSpeedPreset).toBeNull();
    expect(result.current.hasChanges).toBe(true);
  });

  it('setRunIncline updates one field and clears the active incline preset', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession(), 'run'));
    await act(async () => result.current.setRunIncline('workIncline', 8));
    expect(result.current.runInclines.workIncline).toBe(8);
    expect(result.current.activeInclinePreset).toBeNull();
  });

  it('setInclineEnabled toggles the flag directly', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession(), 'run'));
    await act(async () => result.current.setInclineEnabled(false));
    expect(result.current.inclineEnabled).toBe(false);
    expect(result.current.hasChanges).toBe(true);
  });

  it('setSpinValue updates one field and clears the active spin preset', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(spinSession()));
    await act(async () => result.current.setSpinValue('workPower', 999));
    expect(result.current.spinValues.workPower).toBe(999);
    expect(result.current.activeSpinPreset).toBeNull();
  });

  it('applySpeedPreset applies immediately when nothing is dirty', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(undefined));
    await act(async () => result.current.applySpeedPreset('5'));
    expect(result.current.runSpeeds).toEqual(SPEED_PRESETS['5']);
    expect(result.current.activeSpeedPreset).toBe('5');

    const alert = await renderHook(() => useAppAlert());
    expect(alert.result.current).toBeNull();
  });

  it('applySpeedPreset prompts a confirmation alert when speeds are dirty, and applies on confirm', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession(), 'run'));
    await act(async () => result.current.setRunSpeed('workSpeed', 1));

    await act(async () => result.current.applySpeedPreset('5'));
    // Not applied yet — still the dirtied value
    expect(result.current.runSpeeds.workSpeed).toBe(1);

    const alert = await renderHook(() => useAppAlert());
    expect(alert.result.current?.kind).toBe('warning');
    expect(alert.result.current?.buttons).toHaveLength(2);
    expect(alert.result.current?.buttons[0].style).toBe('cancel');

    await act(async () => alert.result.current?.buttons[1].onPress?.());
    expect(result.current.runSpeeds).toEqual(SPEED_PRESETS['5']);
    expect(result.current.activeSpeedPreset).toBe('5');
  });

  it('applySpeedPreset cancel button leaves state unchanged', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession(), 'run'));
    await act(async () => result.current.setRunSpeed('workSpeed', 1));
    await act(async () => result.current.applySpeedPreset('5'));

    const alert = await renderHook(() => useAppAlert());
    expect(alert.result.current?.buttons[0].onPress).toBeUndefined();
    expect(result.current.runSpeeds.workSpeed).toBe(1);
    expect(result.current.activeSpeedPreset).toBeNull();
  });

  it('applyInclinePreset prompts when incline is dirty, and applies on confirm', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession(), 'run'));
    await act(async () => result.current.setRunIncline('workIncline', 20));

    await act(async () => result.current.applyInclinePreset('6'));
    expect(result.current.runInclines.workIncline).toBe(20);

    const alert = await renderHook(() => useAppAlert());
    expect(alert.result.current?.message).toContain('incline');

    await act(async () => alert.result.current?.buttons[1].onPress?.());
    expect(result.current.runInclines).toEqual(INCLINE_PRESETS['6']);
    expect(result.current.activeInclinePreset).toBe('6');
  });

  it('applySpinPreset prompts when spin values are dirty, and applies on confirm', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(spinSession()));
    await act(async () => result.current.setSpinValue('workPower', 5));

    await act(async () => result.current.applySpinPreset('2'));
    expect(result.current.spinValues.workPower).toBe(5);

    const alert = await renderHook(() => useAppAlert());
    expect(alert.result.current?.message).toContain('resistance');

    await act(async () => alert.result.current?.buttons[1].onPress?.());
    expect(result.current.spinValues).toEqual(SPIN_PRESETS['2']);
    expect(result.current.activeSpinPreset).toBe('2');
  });

  it('applying a preset after a previous confirm no longer prompts (dirty flag reset)', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession(), 'run'));
    await act(async () => result.current.setRunSpeed('workSpeed', 1));
    await act(async () => result.current.applySpeedPreset('5'));

    const alert = await renderHook(() => useAppAlert());
    await act(async () => alert.result.current?.buttons[1].onPress?.());
    await act(async () => dismissAppAlert());

    // Applying a second preset right after a clean apply should not prompt again
    await act(async () => result.current.applySpeedPreset('2'));
    expect(result.current.runSpeeds).toEqual(SPEED_PRESETS['2']);

    const alert2 = await renderHook(() => useAppAlert());
    expect(alert2.result.current).toBeNull();
  });
});
