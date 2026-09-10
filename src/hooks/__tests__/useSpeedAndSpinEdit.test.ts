import { act, renderHook } from '@testing-library/react-native';
import { useSpeedAndSpinEdit } from '../useSpeedAndSpinEdit';
import { useAppAlert, dismissAppAlert } from '../../lib/appAlert';
import {
  type Session, DEFAULT_RUN_SPEEDS, DEFAULT_RUN_INCLINES, DEFAULT_SPIN_VALUES,
} from '../../lib/sessions';
import { SPEED_PRESETS, INCLINE_PRESETS, SPIN_PRESETS } from '../../lib/presets';

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
  it('a new session starts on preset level 1 for speed, incline and spin', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(undefined));
    expect(result.current.runSpeeds).toEqual(SPEED_PRESETS['1']);
    expect(result.current.runInclines).toEqual(INCLINE_PRESETS['1']);
    expect(result.current.inclineEnabled).toBe(true);
    expect(result.current.spinValues).toEqual(SPIN_PRESETS['1']);
    expect(result.current.activeSpeedPreset).toBe('1');
    expect(result.current.activeInclinePreset).toBe('1');
    expect(result.current.activeSpinPreset).toBe('1');
    expect(result.current.hasChanges).toBe(false);
  });

  it('seeds runSpeeds/runInclines/inclineEnabled and detects the matching preset for a run session', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession()));
    expect(result.current.runSpeeds).toEqual(SPEED_PRESETS['3']);
    expect(result.current.runInclines).toEqual(INCLINE_PRESETS['3']);
    expect(result.current.inclineEnabled).toBe(true);
    expect(result.current.activeSpeedPreset).toBe('3');
    expect(result.current.activeInclinePreset).toBe('3');
  });

  it('respects an explicit inclineEnabled: false on the existing run session', async () => {
    const { result } = await renderHook(() =>
      useSpeedAndSpinEdit(runSession({ inclineEnabled: false }))
    );
    expect(result.current.inclineEnabled).toBe(false);
  });

  it('defaults cooldownTaper ON for a new run or spinning session, OFF otherwise', async () => {
    const newRun = await renderHook(() => useSpeedAndSpinEdit(undefined, 'run'));
    expect(newRun.result.current.cooldownTaper).toBe(true);

    const newSpin = await renderHook(() => useSpeedAndSpinEdit(undefined, 'spinning'));
    expect(newSpin.result.current.cooldownTaper).toBe(true);

    const newGeneral = await renderHook(() => useSpeedAndSpinEdit(undefined, 'general'));
    expect(newGeneral.result.current.cooldownTaper).toBe(false);
  });

  it('keeps an existing run or spinning session on its saved cooldownTaper value', async () => {
    const off = await renderHook(() => useSpeedAndSpinEdit(runSession(), 'run'));
    expect(off.result.current.cooldownTaper).toBe(false);

    const on = await renderHook(() => useSpeedAndSpinEdit(runSession({ cooldownTaper: true }), 'run'));
    expect(on.result.current.cooldownTaper).toBe(true);

    const spinOn = await renderHook(() => useSpeedAndSpinEdit(spinSession({ cooldownTaper: true })));
    expect(spinOn.result.current.cooldownTaper).toBe(true);
  });

  it('seeds spinValues and detects the matching preset for a spinning session', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(spinSession()));
    expect(result.current.spinValues).toEqual(SPIN_PRESETS['3']);
    expect(result.current.activeSpinPreset).toBe('3');
    // Not a run session, so run-only fields stay at the level-1 placeholder
    expect(result.current.runInclines).toEqual(INCLINE_PRESETS['1']);
  });

  it('uses the level-1 placeholder for a circuit-mode session, with no active preset', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(circuitSession));
    expect(result.current.runSpeeds).toEqual(SPEED_PRESETS['1']);
    expect(result.current.activeSpeedPreset).toBeNull();
  });

  it('setRunSpeed updates one field, marks the preset as custom, and flips hasChanges', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession()));
    await act(async () => result.current.setRunSpeed('workSpeed', 99));
    expect(result.current.runSpeeds.workSpeed).toBe(99);
    expect(result.current.runSpeeds.warmupSpeed).toBe(SPEED_PRESETS['3'].warmupSpeed);
    expect(result.current.activeSpeedPreset).toBeNull();
    expect(result.current.hasChanges).toBe(true);
  });

  it('setRunIncline updates one field and clears the active incline preset', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession()));
    await act(async () => result.current.setRunIncline('workIncline', 8));
    expect(result.current.runInclines.workIncline).toBe(8);
    expect(result.current.activeInclinePreset).toBeNull();
  });

  it('setInclineEnabled toggles the flag directly', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession()));
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
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession()));
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
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession()));
    await act(async () => result.current.setRunSpeed('workSpeed', 1));
    await act(async () => result.current.applySpeedPreset('5'));

    const alert = await renderHook(() => useAppAlert());
    expect(alert.result.current?.buttons[0].onPress).toBeUndefined();
    expect(result.current.runSpeeds.workSpeed).toBe(1);
    expect(result.current.activeSpeedPreset).toBeNull();
  });

  it('applyInclinePreset prompts when incline is dirty, and applies on confirm', async () => {
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession()));
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
    const { result } = await renderHook(() => useSpeedAndSpinEdit(runSession()));
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
