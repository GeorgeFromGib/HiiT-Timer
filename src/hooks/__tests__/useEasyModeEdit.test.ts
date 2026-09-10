import { act, renderHook } from '@testing-library/react-native';
import { useEasyModeEdit } from '../useEasyModeEdit';
import { type Session } from '../../lib/sessions';
import { type WorkoutConfig } from '../../lib/workout';
import { INTENSITY_PRESETS } from '../../lib/intensityPresets';

const easySession = (config: Partial<WorkoutConfig> = {}): Session => ({
  id: 'sess-1', name: 'Easy', folderId: 'default', mode: 'easy',
  config: { warmup: 30, high: 40, low: 20, rounds: 5, cooldown: 30, ...config },
});

const advancedSession: Session = {
  id: 'sess-2', name: 'Advanced', folderId: 'default', mode: 'advanced',
  intervals: [{ type: 'work', dur: 20 }],
};

describe('useEasyModeEdit', () => {
  it('a new session starts on intensity preset 1 with a 5-minute warm-up/cool-down', async () => {
    const { result } = await renderHook(() => useEasyModeEdit(undefined));
    expect(result.current.fieldValues).toEqual({ warmup: 300, work: 20, rest: 40, cooldown: 300 });
    expect(result.current.rounds).toBe(5);
    expect(result.current.easyConfig).toEqual({ warmup: 300, high: 20, low: 40, rounds: 5, cooldown: 300 });
    expect(result.current.activeTimingPreset).toBe('1');
    expect(result.current.hasChanges).toBe(false);
    expect(result.current.isTimingDirty).toBe(false);
  });

  it('uses the new-session defaults for a non-easy (advanced) session', async () => {
    const { result } = await renderHook(() => useEasyModeEdit(advancedSession));
    expect(result.current.fieldValues.warmup).toBe(300);
    expect(result.current.rounds).toBe(5);
  });

  it('seeds field values from an existing easy session', async () => {
    const { result } = await renderHook(() => useEasyModeEdit(easySession()));
    expect(result.current.fieldValues).toEqual({ warmup: 30, work: 40, rest: 20, cooldown: 30 });
    expect(result.current.rounds).toBe(5);
  });

  it('detects the matching intensity preset when work/rest match a preset exactly', async () => {
    const preset3 = INTENSITY_PRESETS['3'];
    const { result } = await renderHook(() =>
      useEasyModeEdit(easySession({ high: preset3.work, low: preset3.rest }))
    );
    expect(result.current.activeTimingPreset).toBe('3');
  });

  it('activeTimingPreset is null when work/rest do not match any preset', async () => {
    const { result } = await renderHook(() => useEasyModeEdit(easySession({ high: 41, low: 21 })));
    expect(result.current.activeTimingPreset).toBeNull();
  });

  it('setField updates a field, records it as last-non-zero when > 0, and clears the active preset', async () => {
    const preset3 = INTENSITY_PRESETS['3'];
    const { result } = await renderHook(() =>
      useEasyModeEdit(easySession({ high: preset3.work, low: preset3.rest }))
    );
    expect(result.current.activeTimingPreset).toBe('3');

    await act(async () => result.current.setField('warmup', 90));
    expect(result.current.fieldValues.warmup).toBe(90);
    expect(result.current.activeTimingPreset).toBeNull();
    expect(result.current.hasChanges).toBe(true);
    expect(result.current.isTimingDirty).toBe(true);
  });

  it('setField with 0 does not overwrite the remembered last-non-zero value', async () => {
    const { result } = await renderHook(() => useEasyModeEdit(easySession({ warmup: 45 })));

    await act(async () => result.current.setField('warmup', 0));
    expect(result.current.fieldValues.warmup).toBe(0);

    // Re-enabling should restore the original 45, not 0
    await act(async () => result.current.setFieldEnabled('warmup', true));
    expect(result.current.fieldValues.warmup).toBe(45);
  });

  it('setFieldEnabled(false) zeroes the field and returns 0', async () => {
    const { result } = await renderHook(() => useEasyModeEdit(easySession({ warmup: 45 })));

    let returned: number | undefined;
    await act(async () => { returned = result.current.setFieldEnabled('warmup', false); });
    expect(returned).toBe(0);
    expect(result.current.fieldValues.warmup).toBe(0);
  });

  it('setFieldEnabled(true) restores the last non-zero value and returns it', async () => {
    const { result } = await renderHook(() => useEasyModeEdit(easySession({ cooldown: 60 })));
    await act(async () => result.current.setFieldEnabled('cooldown', false));
    expect(result.current.fieldValues.cooldown).toBe(0);

    let returned: number | undefined;
    await act(async () => { returned = result.current.setFieldEnabled('cooldown', true); });
    expect(returned).toBe(60);
    expect(result.current.fieldValues.cooldown).toBe(60);
  });

  it('setFieldEnabled(true) on a field that started at 0 falls back to the DEFAULTS value', async () => {
    // initW=0 -> lastNonZero seeded with DEFAULTS.warmup (300) per the `initW || DEFAULTS.warmup` fallback
    const { result } = await renderHook(() => useEasyModeEdit(easySession({ warmup: 0 })));
    expect(result.current.fieldValues.warmup).toBe(0);

    let returned: number | undefined;
    await act(async () => { returned = result.current.setFieldEnabled('warmup', true); });
    expect(returned).toBe(300);
  });

  it('setRounds updates rounds and clears the active preset', async () => {
    const preset3 = INTENSITY_PRESETS['3'];
    const { result } = await renderHook(() =>
      useEasyModeEdit(easySession({ high: preset3.work, low: preset3.rest }))
    );
    await act(async () => result.current.setRounds(10));
    expect(result.current.rounds).toBe(10);
    expect(result.current.activeTimingPreset).toBeNull();
  });

  it('applyIntensityPreset sets work/rest/rounds, the active preset, and resets isTimingDirty (checkpoint)', async () => {
    const { result } = await renderHook(() => useEasyModeEdit(undefined));
    await act(async () => result.current.setField('warmup', 99)); // dirty the checkpoint first
    expect(result.current.isTimingDirty).toBe(true);

    await act(async () => result.current.applyIntensityPreset(50, 10, 6, '5'));
    expect(result.current.fieldValues.work).toBe(50);
    expect(result.current.fieldValues.rest).toBe(10);
    expect(result.current.rounds).toBe(6);
    // a preset standardises warm-up and cool-down to 5 minutes
    expect(result.current.fieldValues.warmup).toBe(300);
    expect(result.current.fieldValues.cooldown).toBe(300);
    expect(result.current.activeTimingPreset).toBe('5');
    expect(result.current.isTimingDirty).toBe(false);
    // hasChanges still reflects divergence from the originally loaded session
    expect(result.current.hasChanges).toBe(true);
  });

  it('easyConfig clamps high to at least 1 and rounds to at least 1', async () => {
    const { result } = await renderHook(() => useEasyModeEdit(easySession({ high: 40, rounds: 5 })));
    await act(async () => result.current.setField('work', 0));
    await act(async () => result.current.setRounds(0));
    expect(result.current.easyConfig.high).toBe(1);
    expect(result.current.easyConfig.rounds).toBe(1);
    // fieldValues/rounds themselves are NOT clamped, only easyConfig
    expect(result.current.fieldValues.work).toBe(0);
    expect(result.current.rounds).toBe(0);
  });

  it('reset restores all fields to the preset-1 defaults', async () => {
    const { result } = await renderHook(() => useEasyModeEdit(easySession()));
    await act(async () => result.current.setField('warmup', 999));
    await act(async () => result.current.setRounds(20));

    await act(async () => result.current.reset());
    expect(result.current.fieldValues).toEqual({ warmup: 300, work: 20, rest: 40, cooldown: 300 });
    expect(result.current.rounds).toBe(5);
    expect(result.current.activeTimingPreset).toBe('1');
  });
});
