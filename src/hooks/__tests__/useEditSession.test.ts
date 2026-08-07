import { act, renderHook } from '@testing-library/react-native';
import { useEditSession } from '../useEditSession';
import { i18n } from '../../lib/i18n';
import { useAppAlert, dismissAppAlert } from '../../lib/appAlert';
import {
  type Session,
  DEFAULT_RUN_SPEEDS, DEFAULT_RUN_INCLINES, DEFAULT_SPIN_VALUES,
} from '../../lib/sessions';
import { SPEED_PRESETS, INCLINE_PRESETS, SPIN_PRESETS } from '../../lib/presets';

const onBack = jest.fn();

async function renderAlertObserver() {
  return (await renderHook(() => useAppAlert())).result;
}

// ── Fixtures ──────────────────────────────────────────────────────────────

const easyRunSession: Session = {
  id: 'easy1', name: 'Easy One', folderId: 'f1', mode: 'easy',
  activityType: 'run',
  config: { warmup: 45, high: 40, low: 20, rounds: 6, cooldown: 45 },
  runSpeeds: SPEED_PRESETS['2'], runInclines: INCLINE_PRESETS['2'], inclineEnabled: true,
};

// warmup + rounds*(high+low) + cooldown = 300 + 5*60 + 300 = 900 > 600 -> lengthIsSet starts true
const longEasySession: Session = {
  id: 'longEasy', name: 'Long Run', folderId: 'f1', mode: 'easy',
  activityType: 'run',
  config: { warmup: 300, high: 45, low: 15, rounds: 5, cooldown: 300 },
  runSpeeds: DEFAULT_RUN_SPEEDS,
};

// Converts back to easy as work=40/rest=20 x2, which matches INTENSITY_PRESETS['3']
const advancedSession: Session = {
  id: 'adv1', name: 'Advanced One', folderId: 'f1', mode: 'advanced',
  intervals: [
    { type: 'warmup', dur: 20 },
    { type: 'work', dur: 40 },
    { type: 'rest', dur: 20 },
    { type: 'work', dur: 40 },
    { type: 'rest', dur: 20 },
    { type: 'cooldown', dur: 20 },
  ],
};

// Cannot convert to easy: work durations differ (10 vs 20)
const unconvertibleAdvancedSession: Session = {
  id: 'adv2', name: 'Irregular', folderId: 'f1', mode: 'advanced',
  intervals: [
    { type: 'work', dur: 10 },
    { type: 'rest', dur: 5 },
    { type: 'work', dur: 20 },
    { type: 'rest', dur: 5 },
  ],
};

const advancedRunSession: Session = {
  id: 'advRun', name: 'Advanced Run', folderId: 'f1', mode: 'advanced', activityType: 'run',
  intervals: [
    { type: 'warmup', dur: 20 },
    { type: 'work', dur: 30, speed: 12, incline: 6 },
    { type: 'rest', dur: 15 },
    { type: 'cooldown', dur: 20 },
  ],
  runSpeeds: SPEED_PRESETS['3'], runInclines: INCLINE_PRESETS['3'], inclineEnabled: true,
};

const advancedSpinSession: Session = {
  id: 'advSpin', name: 'Adv Spin', folderId: 'f1', mode: 'advanced', activityType: 'spinning',
  intervals: [
    { type: 'warmup', dur: 20 },
    { type: 'work', dur: 30, resistance: 8, power: 200 },
    { type: 'rest', dur: 15 },
    { type: 'cooldown', dur: 20 },
  ],
  spinValues: DEFAULT_SPIN_VALUES,
};

const circuitSession: Session = {
  id: 'circ1', name: 'Circuit One', folderId: 'f1', mode: 'circuit',
  intervals: [
    { type: 'work', dur: 40, activityLabel: 'Push-ups' },
    { type: 'rest', dur: 20 },
  ],
  circuits: 3, warmup: 30, cooldown: 30, circuitRest: 20,
};

afterEach(() => {
  dismissAppAlert();
});

// ── Initial state ────────────────────────────────────────────────────────

describe('useEditSession — initial state (new session)', () => {
  it('defaults to easy mode with DEFAULTS field values when no session/activity type is given', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack));
    const d = result.current.draft;
    expect(d.name).toBe('');
    expect(d.isAdvanced).toBe(false);
    expect(d.isCircuit).toBe(false);
    expect(d.isSpinning).toBe(false);
    expect(d.fieldValues).toEqual({ warmup: 30, work: 30, rest: 15, cooldown: 30 });
    expect(d.rounds).toBe(4);
    expect(d.intervals).toEqual([]);
    expect(d.activityType).toBeUndefined();
    expect(d.runSpeeds).toEqual(DEFAULT_RUN_SPEEDS);
    expect(d.runInclines).toEqual(DEFAULT_RUN_INCLINES);
    expect(d.inclineEnabled).toBe(true);
    expect(d.spinValues).toEqual(DEFAULT_SPIN_VALUES);
    expect(d.activeTimingPreset).toBeNull();
    expect(d.targetLengthMinutes).toBe(15);
    expect(d.activeSpeedPreset).toBeNull();
    expect(d.activeInclinePreset).toBeNull();
    expect(d.activeSpinPreset).toBeNull();
    expect(d.hasChanges).toBe(false);
    expect(d.circuitWarmup).toBe(60);
    expect(d.circuitCooldown).toBe(60);
    expect(d.circuitRest).toBe(30);
    expect(d.circuitCount).toBe(3);
    expect(result.current.picker).toBeNull();
  });

  it('computes previewSegments/previewTotal for the default easy config', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack));
    const d = result.current.draft;
    // warmup 30 + 4 * (30+15) + cooldown 30
    expect(d.previewTotal).toBe(30 + 4 * (30 + 15) + 30);
    expect(d.previewSegments.map(s => s.phase)).toEqual([
      'warmup', 'work', 'rest', 'work', 'rest', 'work', 'rest', 'work', 'rest', 'cooldown',
    ]);
  });

  it('initialActivityType "circuit" starts the draft in circuit mode with default circuit values', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack, 'circuit'));
    const d = result.current.draft;
    expect(d.isCircuit).toBe(true);
    expect(d.isAdvanced).toBe(false);
    expect(d.activityType).toBeUndefined();
    expect(d.intervals).toEqual([]);
  });

  it('initialActivityType "run"/"spinning" seed activityType for a new easy session', async () => {
    const run = await renderHook(() => useEditSession(undefined, onBack, 'run'));
    expect(run.result.current.draft.activityType).toBe('run');

    const spin = await renderHook(() => useEditSession(undefined, onBack, 'spinning'));
    expect(spin.result.current.draft.activityType).toBe('spinning');
    expect(spin.result.current.draft.isSpinning).toBe(true);
  });
});

describe('useEditSession — initial state (existing session)', () => {
  it('populates the draft from an existing easy/run session', async () => {
    const { result } = await renderHook(() => useEditSession(easyRunSession, onBack));
    const d = result.current.draft;
    expect(d.name).toBe('Easy One');
    expect(d.isAdvanced).toBe(false);
    expect(d.fieldValues).toEqual({ warmup: 45, work: 40, rest: 20, cooldown: 45 });
    expect(d.rounds).toBe(6);
    expect(d.activityType).toBe('run');
    expect(d.runSpeeds).toEqual(SPEED_PRESETS['2']);
    expect(d.runInclines).toEqual(INCLINE_PRESETS['2']);
    // work=40/rest=20 matches INTENSITY_PRESETS['3']
    expect(d.activeTimingPreset).toBe('3');
    expect(d.activeSpeedPreset).toBe('2');
    expect(d.activeInclinePreset).toBe('2');
    expect(d.hasChanges).toBe(false);
  });

  it('populates the draft from an existing advanced session and derives activeTimingPreset from its intervals', async () => {
    const { result } = await renderHook(() => useEditSession(advancedSession, onBack));
    const d = result.current.draft;
    expect(d.isAdvanced).toBe(true);
    expect(d.intervals.map(iv => ({ type: iv.type, dur: iv.dur }))).toEqual([
      { type: 'warmup', dur: 20 }, { type: 'work', dur: 40 }, { type: 'rest', dur: 20 },
      { type: 'work', dur: 40 }, { type: 'rest', dur: 20 }, { type: 'cooldown', dur: 20 },
    ]);
    expect(d.activeTimingPreset).toBe('3');
    expect(d.previewTotal).toBe(20 + 40 + 20 + 40 + 20 + 20);
  });

  it('populates the draft from an existing circuit session', async () => {
    const { result } = await renderHook(() => useEditSession(circuitSession, onBack));
    const d = result.current.draft;
    expect(d.isCircuit).toBe(true);
    expect(d.circuitWarmup).toBe(30);
    expect(d.circuitCooldown).toBe(30);
    expect(d.circuitRest).toBe(20);
    expect(d.circuitCount).toBe(3);
    expect(d.intervals.map(iv => iv.type)).toEqual(['work', 'rest']);
  });

  it('lengthIsSet reflects whether the existing easy session total already exceeds 10 minutes (observed via the rounds-change warning)', async () => {
    const alert = await renderAlertObserver();
    const { result } = await renderHook(() => useEditSession(longEasySession, onBack));

    await act(async () => result.current.openRoundsPicker());
    await act(async () => result.current.commitPicker({ selected: [9] })); // rounds -> 10
    expect(alert.current?.title).toBe(i18n.t('alerts.roundsChangeLengthTitle'));
  });
});

// ── setName ──────────────────────────────────────────────────────────────

describe('setName', () => {
  it('updates draft.name and flips hasChanges', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack));
    expect(result.current.draft.hasChanges).toBe(false);

    await act(async () => result.current.setName('My Workout'));
    expect(result.current.draft.name).toBe('My Workout');
    expect(result.current.draft.hasChanges).toBe(true);

    await act(async () => result.current.setName(''));
    expect(result.current.draft.hasChanges).toBe(false);
  });
});

// ── toggleMode ───────────────────────────────────────────────────────────

describe('toggleMode', () => {
  it('easy -> advanced builds the interval list from the current easy config', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack));
    await act(async () => result.current.toggleMode(true));
    expect(result.current.draft.isAdvanced).toBe(true);
    // buildIntervalsFromEasy(warmup30, work30x4, rest15x4, cooldown30) -> 1 + 4*2 + 1
    expect(result.current.draft.intervals).toHaveLength(10);
  });

  it('advanced -> easy converts a regular interval list back to easy fields', async () => {
    const { result } = await renderHook(() => useEditSession(advancedSession, onBack));
    await act(async () => result.current.toggleMode(false));
    expect(result.current.draft.isAdvanced).toBe(false);
    expect(result.current.draft.fieldValues).toEqual({ warmup: 20, work: 40, rest: 20, cooldown: 20 });
    expect(result.current.draft.rounds).toBe(2);
  });

  it('advanced -> easy shows an error alert and stays in advanced mode when the interval list cannot convert', async () => {
    const alert = await renderAlertObserver();
    const { result } = await renderHook(() => useEditSession(unconvertibleAdvancedSession, onBack));

    await act(async () => result.current.toggleMode(false));
    expect(result.current.draft.isAdvanced).toBe(true); // unchanged
    expect(alert.current?.title).toBe(i18n.t('alerts.cannotSwitchEasyTitle'));
  });
});

// ── cyclePhase ───────────────────────────────────────────────────────────

describe('cyclePhase', () => {
  it('cycles through only work/rest in circuit mode', async () => {
    const { result } = await renderHook(() => useEditSession(circuitSession, onBack));
    const key = result.current.draft.intervals[0]._key; // work
    await act(async () => result.current.cyclePhase(key));
    expect(result.current.draft.intervals[0].type).toBe('rest');
    await act(async () => result.current.cyclePhase(key));
    expect(result.current.draft.intervals[0].type).toBe('work');
  });

  it('cycles through warmup/work/rest/cooldown in advanced mode', async () => {
    const { result } = await renderHook(() => useEditSession(advancedSession, onBack));
    const key = result.current.draft.intervals[1]._key; // work
    await act(async () => result.current.cyclePhase(key));
    expect(result.current.draft.intervals[1].type).toBe('rest');
    await act(async () => result.current.cyclePhase(key));
    expect(result.current.draft.intervals[1].type).toBe('cooldown');
    await act(async () => result.current.cyclePhase(key));
    expect(result.current.draft.intervals[1].type).toBe('warmup');
  });
});

// ── Interval list actions ───────────────────────────────────────────────

describe('interval list actions', () => {
  it('addInterval appends a default-duration interval when no interval of that type exists yet', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack, 'circuit'));
    await act(async () => result.current.addInterval('work'));
    expect(result.current.draft.intervals).toHaveLength(1);
    expect(result.current.draft.intervals[0]).toMatchObject({ type: 'work', dur: 30 });
  });

  it('addInterval copies duration/activityLabel from the last interval of the same type', async () => {
    const { result } = await renderHook(() => useEditSession(circuitSession, onBack));
    await act(async () => result.current.addInterval('work'));
    const added = result.current.draft.intervals[result.current.draft.intervals.length - 1];
    expect(added).toMatchObject({ type: 'work', dur: 40, activityLabel: 'Push-ups' });
  });

  it('duplicateInterval inserts a copy right after the original with a new key', async () => {
    const { result } = await renderHook(() => useEditSession(advancedSession, onBack));
    const key = result.current.draft.intervals[1]._key;
    await act(async () => result.current.duplicateInterval(key));
    expect(result.current.draft.intervals).toHaveLength(7);
    expect(result.current.draft.intervals[1]._key).toBe(key);
    expect(result.current.draft.intervals[2]).toMatchObject({ type: 'work', dur: 40 });
    expect(result.current.draft.intervals[2]._key).not.toBe(key);
  });

  it('removeInterval removes the interval with the given key', async () => {
    const { result } = await renderHook(() => useEditSession(advancedSession, onBack));
    const key = result.current.draft.intervals[0]._key;
    await act(async () => result.current.removeInterval(key));
    expect(result.current.draft.intervals).toHaveLength(5);
    expect(result.current.draft.intervals.find(iv => iv._key === key)).toBeUndefined();
  });

  it('clearIntervals empties the interval list', async () => {
    const { result } = await renderHook(() => useEditSession(advancedSession, onBack));
    await act(async () => result.current.clearIntervals());
    expect(result.current.draft.intervals).toEqual([]);
  });

  it('reorderIntervals replaces the interval list with the given order', async () => {
    const { result } = await renderHook(() => useEditSession(advancedSession, onBack));
    const reversed = [...result.current.draft.intervals].reverse();
    await act(async () => result.current.reorderIntervals(reversed));
    expect(result.current.draft.intervals).toEqual(reversed);
  });

  it('setActivityLabel updates the label on the matching interval', async () => {
    const { result } = await renderHook(() => useEditSession(circuitSession, onBack));
    const key = result.current.draft.intervals[0]._key;
    await act(async () => result.current.setActivityLabel(key, 'Burpees'));
    expect(result.current.draft.intervals[0].activityLabel).toBe('Burpees');
  });
});

// ── Field pickers & setFieldEnabled ─────────────────────────────────────

describe('openFieldPicker / commitPicker (field)', () => {
  it('opens with the encoded current value and commits a new duration, recalculating rounds to preserve total length', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack));
    await act(async () => result.current.openFieldPicker('work'));
    expect(result.current.picker?.selected).toEqual([0, 30]);

    await act(async () => result.current.commitPicker({ selected: [0, 45] }));
    expect(result.current.draft.fieldValues.work).toBe(45);
    // old total 240; warmup30+rounds*(45+15)+cooldown30 solved for rounds -> round(180/60) = 3
    expect(result.current.draft.rounds).toBe(3);
    expect(result.current.picker).toBeNull();
  });
});

describe('setFieldEnabled', () => {
  it('disabling warmup zeroes it, recalculates rounds, and warns about the short duration', async () => {
    const alert = await renderAlertObserver();
    const { result } = await renderHook(() => useEditSession(undefined, onBack));

    await act(async () => result.current.setFieldEnabled('warmup', false));
    expect(result.current.draft.fieldValues.warmup).toBe(0);
    // old total 240; 0+rounds*(30+15)+30 solved for rounds -> round(210/45) = 5
    expect(result.current.draft.rounds).toBe(5);
    expect(alert.current?.title).toBe(i18n.t('alerts.shortWarmupCooldownTitle'));
  });

  it('re-enabling warmup restores the last non-zero value, warning again since the restored value is still short', async () => {
    const alert = await renderAlertObserver();
    const { result } = await renderHook(() => useEditSession(undefined, onBack));

    await act(async () => result.current.setFieldEnabled('warmup', false));
    await act(async () => dismissAppAlert());

    await act(async () => result.current.setFieldEnabled('warmup', true));
    expect(result.current.draft.fieldValues.warmup).toBe(30);
    // total before this step was 0+5*45+30=255; solving with warmup 30 -> round(195/45) = 4
    expect(result.current.draft.rounds).toBe(4);
    // restored value (30s) is still under the 5-minute threshold, so this should warn too
    expect(alert.current?.title).toBe(i18n.t('alerts.shortWarmupCooldownTitle'));
  });

  it('re-enabling warmup to a restored value at/above the 5-minute threshold does not warn', async () => {
    const alert = await renderAlertObserver();
    const { result } = await renderHook(() => useEditSession(undefined, onBack));

    await act(async () => result.current.openFieldPicker('warmup'));
    await act(async () => result.current.commitPicker({ selected: [5, 0] })); // 5min warmup
    await act(async () => dismissAppAlert());

    await act(async () => result.current.setFieldEnabled('warmup', false));
    await act(async () => dismissAppAlert());

    await act(async () => result.current.setFieldEnabled('warmup', true));
    expect(result.current.draft.fieldValues.warmup).toBe(300);
    expect(alert.current).toBeNull();
  });

  it('disabling a non warmup/cooldown field (work) does not recalc rounds or warn', async () => {
    const alert = await renderAlertObserver();
    const { result } = await renderHook(() => useEditSession(undefined, onBack));

    await act(async () => result.current.setFieldEnabled('work', false));
    expect(result.current.draft.fieldValues.work).toBe(0);
    expect(result.current.draft.rounds).toBe(4); // unchanged
    expect(alert.current).toBeNull();
  });
});

// ── Rounds picker & length-lock warning ─────────────────────────────────

describe('openRoundsPicker / commitPicker (rounds)', () => {
  it('updates rounds and target length, without warning, when the length was not yet "set"', async () => {
    const alert = await renderAlertObserver();
    const { result } = await renderHook(() => useEditSession(undefined, onBack));

    await act(async () => result.current.openRoundsPicker());
    expect(result.current.picker?.selected).toEqual([3]); // rounds=4 -> idx 3

    await act(async () => result.current.commitPicker({ selected: [6] })); // rounds -> 7
    expect(result.current.draft.rounds).toBe(7);
    expect(alert.current).toBeNull();
  });

  it('warns once when changing rounds after the length is already "set", then stops warning', async () => {
    const alert = await renderAlertObserver();
    const { result } = await renderHook(() => useEditSession(longEasySession, onBack));

    await act(async () => result.current.openRoundsPicker());
    await act(async () => result.current.commitPicker({ selected: [9] })); // rounds -> 10
    expect(result.current.draft.rounds).toBe(10);
    expect(result.current.draft.targetLengthMinutes).toBe(20);
    expect(alert.current?.title).toBe(i18n.t('alerts.roundsChangeLengthTitle'));

    await act(async () => dismissAppAlert());
    await act(async () => result.current.openRoundsPicker());
    await act(async () => result.current.commitPicker({ selected: [11] })); // rounds -> 12
    expect(result.current.draft.rounds).toBe(12);
    expect(alert.current).toBeNull(); // lengthIsSet flipped false, no further warning
  });
});

// ── applyDurationPreset ──────────────────────────────────────────────────

describe('applyDurationPreset', () => {
  it('applies directly when timing has not diverged from the loaded/preset checkpoint', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack));
    await act(async () => result.current.applyDurationPreset('4')); // work45/rest15
    const d = result.current.draft;
    expect(d.fieldValues.work).toBe(45);
    expect(d.fieldValues.rest).toBe(15);
    // computeRoundsForTargetDuration(30,45,15,30, 15*60) -> round(840/60) = 14
    expect(d.rounds).toBe(14);
    expect(d.activeTimingPreset).toBe('4');
  });

  it('warns before overwriting dirty timing, and only applies once the alert is confirmed', async () => {
    const alert = await renderAlertObserver();
    const { result } = await renderHook(() => useEditSession(undefined, onBack));

    // dirty the timing checkpoint
    await act(async () => result.current.openFieldPicker('work'));
    await act(async () => result.current.commitPicker({ selected: [0, 31] }));
    expect(result.current.draft.fieldValues.work).toBe(31);

    await act(async () => result.current.applyDurationPreset('2')); // work30/rest30
    expect(alert.current?.title).toBe(i18n.t('alerts.overwriteTitle'));
    expect(result.current.draft.fieldValues.work).toBe(31); // not yet applied

    const applyButton = alert.current!.buttons[1];
    await act(async () => applyButton.onPress?.());
    expect(result.current.draft.fieldValues.work).toBe(30);
    expect(result.current.draft.fieldValues.rest).toBe(30);
    expect(result.current.draft.activeTimingPreset).toBe('2');
  });

  it('rebuilds the advanced interval list when applied while in advanced mode', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack));
    await act(async () => result.current.toggleMode(true));
    await act(async () => result.current.applyDurationPreset('1')); // work20/rest40
    expect(result.current.draft.intervals.some(iv => iv.type === 'work' && iv.dur === 20)).toBe(true);
  });
});

// ── openCustomLengthPicker / target duration ─────────────────────────────

describe('openCustomLengthPicker / commitPicker (targetDuration)', () => {
  it('sets a new target length and recomputes rounds, marking the length as "set"', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack));
    await act(async () => result.current.openCustomLengthPicker());
    await act(async () => result.current.commitPicker({ selected: [10] })); // minutes 10+10=20
    expect(result.current.draft.targetLengthMinutes).toBe(20);
    // computeRoundsForTargetDuration(30,30,15,30, 20*60) -> round(1140/45) = 25
    expect(result.current.draft.rounds).toBe(25);
  });
});

// ── Speed pickers (session-level & per-interval) ─────────────────────────

describe('setRunSpeed (top-level)', () => {
  it('updates draft.runSpeeds for the given field', async () => {
    const { result } = await renderHook(() => useEditSession(easyRunSession, onBack));
    await act(async () => result.current.setRunSpeed('cooldownSpeed', 3.3));
    expect(result.current.draft.runSpeeds.cooldownSpeed).toBe(3.3);
  });
});

describe('openSpeedPicker / commitPicker (speed)', () => {
  it('opens encoded from the given display value and commits a session-level speed', async () => {
    const { result } = await renderHook(() => useEditSession(easyRunSession, onBack));
    await act(async () => result.current.openSpeedPicker('workSpeed', 11.3, false));
    expect(result.current.picker?.selected).toEqual([11, 3]);

    await act(async () => result.current.commitPicker({ selected: [12, 5] }));
    expect(result.current.draft.runSpeeds.workSpeed).toBe(12.5);
  });
});

describe('openIntervalSpeedPicker / commitPicker (intervalSpeed)', () => {
  it('encodes from the interval override when present', async () => {
    const { result } = await renderHook(() => useEditSession(advancedRunSession, onBack));
    const key = result.current.draft.intervals[1]._key; // work, speed override 12
    await act(async () => result.current.openIntervalSpeedPicker(key, false));
    expect(result.current.picker?.selected).toEqual([12, 0]);
  });

  it('falls back to speedForPhase when the interval has no override, and converts to mph', async () => {
    const { result } = await renderHook(() => useEditSession(advancedRunSession, onBack));
    const key = result.current.draft.intervals[2]._key; // rest, no override
    await act(async () => result.current.openIntervalSpeedPicker(key, false));
    expect(result.current.picker?.selected).toEqual([6, 2]); // restSpeed 6.2 km/h

    const workKey = result.current.draft.intervals[1]._key;
    await act(async () => result.current.openIntervalSpeedPicker(workKey, true)); // miles, override 12km/h
    expect(result.current.picker?.selected).toEqual([7, 5]); // 12km/h ~= 7.46mph
  });

  it('is a no-op when the key does not exist', async () => {
    const { result } = await renderHook(() => useEditSession(advancedRunSession, onBack));
    await act(async () => result.current.openIntervalSpeedPicker('missing-key', false));
    expect(result.current.picker).toBeNull();
  });

  it('commit sets the per-interval speed override', async () => {
    const { result } = await renderHook(() => useEditSession(advancedRunSession, onBack));
    const key = result.current.draft.intervals[2]._key;
    await act(async () => result.current.openIntervalSpeedPicker(key, false));
    await act(async () => result.current.commitPicker({ selected: [9, 0] }));
    expect(result.current.draft.intervals.find(iv => iv._key === key)?.speed).toBe(9);
  });
});

describe('clearIntervalSpeed', () => {
  it('clears the per-interval speed override', async () => {
    const { result } = await renderHook(() => useEditSession(advancedRunSession, onBack));
    const key = result.current.draft.intervals[1]._key;
    await act(async () => result.current.clearIntervalSpeed(key));
    expect(result.current.draft.intervals.find(iv => iv._key === key)?.speed).toBeUndefined();
  });
});

// ── Incline pickers (session-level & per-interval) & setInclineEnabled ──

describe('openInclinePicker / commitPicker (incline)', () => {
  it('opens encoded from the current session-level incline and commits a new value', async () => {
    const { result } = await renderHook(() => useEditSession(easyRunSession, onBack));
    await act(async () => result.current.openInclinePicker('workIncline'));
    expect(result.current.picker?.selected).toEqual([4]); // INCLINE_PRESETS['2'].workIncline=2 -> idx 4

    await act(async () => result.current.commitPicker({ selected: [10] })); // 10/2 = 5
    expect(result.current.draft.runInclines.workIncline).toBe(5);
  });
});

describe('openIntervalInclinePicker / clearIntervalIncline', () => {
  it('encodes from the override when present, and falls back to inclineForPhase otherwise', async () => {
    const { result } = await renderHook(() => useEditSession(advancedRunSession, onBack));
    const workKey = result.current.draft.intervals[1]._key; // incline override 6
    await act(async () => result.current.openIntervalInclinePicker(workKey));
    expect(result.current.picker?.selected).toEqual([12]); // 6*2

    const restKey = result.current.draft.intervals[2]._key; // no override
    await act(async () => result.current.openIntervalInclinePicker(restKey));
    expect(result.current.picker?.selected).toEqual([3]); // restIncline 1.5 * 2
  });

  it('clearIntervalIncline removes the override', async () => {
    const { result } = await renderHook(() => useEditSession(advancedRunSession, onBack));
    const key = result.current.draft.intervals[1]._key;
    await act(async () => result.current.clearIntervalIncline(key));
    expect(result.current.draft.intervals.find(iv => iv._key === key)?.incline).toBeUndefined();
  });
});

describe('setInclineEnabled', () => {
  it('toggles inclineEnabled and removes incline from previewSegments when disabled', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack, 'run'));
    expect(result.current.draft.previewSegments.some(s => 'incline' in s)).toBe(true);

    await act(async () => result.current.setInclineEnabled(false));
    expect(result.current.draft.inclineEnabled).toBe(false);
    expect(result.current.draft.previewSegments.some(s => 'incline' in s)).toBe(false);
    expect(result.current.draft.previewSegments.every(s => 'speed' in s)).toBe(true);
  });
});

// ── Spin pickers (session-level & per-interval) ──────────────────────────

describe('openSpinResistancePicker / openSpinPowerPicker / commitPicker', () => {
  it('opens encoded from current spinValues and commits new session-level values', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack, 'spinning'));
    await act(async () => result.current.openSpinResistancePicker('workResistance'));
    expect(result.current.picker?.selected).toEqual([4]); // DEFAULT workResistance=5 -> idx 4
    await act(async () => result.current.commitPicker({ selected: [6] }));
    expect(result.current.draft.spinValues.workResistance).toBe(7);

    await act(async () => result.current.openSpinPowerPicker('workPower'));
    expect(result.current.picker?.selected).toEqual([8]); // DEFAULT workPower=120 -> (120-40)/10=8
    await act(async () => result.current.commitPicker({ selected: [10] }));
    expect(result.current.draft.spinValues.workPower).toBe(140);
  });
});

describe('openIntervalResistancePicker / openIntervalPowerPicker / clear*', () => {
  it('encodes from the override when present, and falls back to spinValueForPhase otherwise', async () => {
    const { result } = await renderHook(() => useEditSession(advancedSpinSession, onBack));
    const workKey = result.current.draft.intervals[1]._key; // resistance 8, power 200
    await act(async () => result.current.openIntervalResistancePicker(workKey));
    expect(result.current.picker?.selected).toEqual([7]);
    await act(async () => result.current.openIntervalPowerPicker(workKey));
    expect(result.current.picker?.selected).toEqual([16]);

    const restKey = result.current.draft.intervals[2]._key; // fallback rest resistance2/power60
    await act(async () => result.current.openIntervalResistancePicker(restKey));
    expect(result.current.picker?.selected).toEqual([1]);
    await act(async () => result.current.openIntervalPowerPicker(restKey));
    expect(result.current.picker?.selected).toEqual([2]);
  });

  it('clearIntervalResistance and clearIntervalPower remove the overrides', async () => {
    const { result } = await renderHook(() => useEditSession(advancedSpinSession, onBack));
    const key = result.current.draft.intervals[1]._key;
    await act(async () => result.current.clearIntervalResistance(key));
    await act(async () => result.current.clearIntervalPower(key));
    const iv = result.current.draft.intervals.find(i => i._key === key);
    expect(iv?.resistance).toBeUndefined();
    expect(iv?.power).toBeUndefined();
  });

  it('is a no-op when the key does not exist', async () => {
    const { result } = await renderHook(() => useEditSession(advancedSpinSession, onBack));
    await act(async () => result.current.openIntervalResistancePicker('missing'));
    await act(async () => result.current.openIntervalPowerPicker('missing'));
    expect(result.current.picker).toBeNull();
  });
});

// ── Circuit-specific pickers ─────────────────────────────────────────────

describe('circuit pickers', () => {
  it('openCircuitWarmupPicker/openCircuitCooldownPicker commit and warn about short durations', async () => {
    const alert = await renderAlertObserver();
    const { result } = await renderHook(() => useEditSession(undefined, onBack, 'circuit'));

    await act(async () => result.current.openCircuitWarmupPicker());
    await act(async () => result.current.commitPicker({ selected: [2, 10] })); // 130s
    expect(result.current.draft.circuitWarmup).toBe(130);
    expect(alert.current?.title).toBe(i18n.t('alerts.shortWarmupCooldownTitle'));

    await act(async () => dismissAppAlert());
    await act(async () => result.current.openCircuitCooldownPicker());
    await act(async () => result.current.commitPicker({ selected: [2, 10] }));
    expect(result.current.draft.circuitCooldown).toBe(130);
    expect(alert.current?.title).toBe(i18n.t('alerts.shortWarmupCooldownTitle'));
  });

  it('openCircuitRestPicker commits without a short-duration warning', async () => {
    const alert = await renderAlertObserver();
    const { result } = await renderHook(() => useEditSession(undefined, onBack, 'circuit'));

    await act(async () => result.current.openCircuitRestPicker());
    await act(async () => result.current.commitPicker({ selected: [0, 45] }));
    expect(result.current.draft.circuitRest).toBe(45);
    expect(alert.current).toBeNull();
  });

  it('openCircuitsPicker commits the circuit count', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack, 'circuit'));
    await act(async () => result.current.openCircuitsPicker());
    expect(result.current.picker?.selected).toEqual([2]); // count=3 -> idx 2
    await act(async () => result.current.commitPicker({ selected: [4] })); // count -> 5
    expect(result.current.draft.circuitCount).toBe(5);
  });
});

// ── Preset application delegates (speed/incline/spin) ────────────────────

describe('applySpeedPreset / applyInclinePreset / applySpinPreset', () => {
  it('apply directly (no prior edits) and update the active-preset flags', async () => {
    const { result } = await renderHook(() => useEditSession(easyRunSession, onBack));

    await act(async () => result.current.applySpeedPreset('5'));
    expect(result.current.draft.runSpeeds).toEqual(SPEED_PRESETS['5']);
    expect(result.current.draft.activeSpeedPreset).toBe('5');

    await act(async () => result.current.applyInclinePreset('5'));
    expect(result.current.draft.runInclines).toEqual(INCLINE_PRESETS['5']);
    expect(result.current.draft.activeInclinePreset).toBe('5');
  });

  it('applySpinPreset applies directly and updates activeSpinPreset', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack, 'spinning'));
    await act(async () => result.current.applySpinPreset('4'));
    expect(result.current.draft.spinValues).toEqual(SPIN_PRESETS['4']);
    expect(result.current.draft.activeSpinPreset).toBe('4');
  });
});

// ── dismissPicker / openIntervalPicker ────────────────────────────────────

describe('dismissPicker', () => {
  it('clears the active picker', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack));
    await act(async () => result.current.openRoundsPicker());
    expect(result.current.picker).not.toBeNull();
    await act(async () => result.current.dismissPicker());
    expect(result.current.picker).toBeNull();
  });
});

describe('openIntervalPicker / commitPicker (interval)', () => {
  it('opens encoded from the interval duration and commits a new duration', async () => {
    const { result } = await renderHook(() => useEditSession(advancedSession, onBack));
    const key = result.current.draft.intervals[0]._key; // warmup, dur 20
    await act(async () => result.current.openIntervalPicker(key));
    expect(result.current.picker?.selected).toEqual([0, 20]);

    await act(async () => result.current.commitPicker({ selected: [0, 25] }));
    expect(result.current.draft.intervals[0].dur).toBe(25);
  });
});

// ── buildSavePayload ───────────────────────────────────────────────────

describe('buildSavePayload — easy/advanced', () => {
  it('fails with nameRequired when the name is blank', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack));
    const payload = result.current.buildSavePayload();
    expect(payload).toEqual({
      ok: false, titleKey: 'alerts.nameRequiredTitle', messageKey: 'alerts.nameRequiredMessage',
    });
  });

  it('fails with noIntervals for an advanced session with an empty interval list', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack));
    await act(async () => result.current.toggleMode(true));
    await act(async () => result.current.clearIntervals());
    await act(async () => result.current.setName('Foo'));
    const payload = result.current.buildSavePayload();
    expect(payload).toEqual({
      ok: false, titleKey: 'alerts.noIntervalsTitle', messageKey: 'alerts.noIntervalsMessage',
    });
  });

  it('builds a new easy session, trimming the name, when valid', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack));
    await act(async () => result.current.setName('  Padded Name  '));
    const payload = result.current.buildSavePayload();
    expect(payload.ok).toBe(true);
    if (payload.ok) {
      expect(payload.isNew).toBe(true);
      expect(payload.session.name).toBe('Padded Name');
      expect(payload.session.mode).toBe('easy');
      if (payload.session.mode === 'easy') {
        expect(payload.session.config).toEqual({ warmup: 30, high: 30, low: 15, rounds: 4, cooldown: 30 });
      }
    }
  });

  it('builds a new advanced session with the current interval list', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack));
    await act(async () => result.current.toggleMode(true));
    await act(async () => result.current.setName('Adv Sesh'));
    const payload = result.current.buildSavePayload();
    expect(payload.ok).toBe(true);
    if (payload.ok && payload.session.mode === 'advanced') {
      expect(payload.session.intervals).toHaveLength(10);
      expect(payload.session.intervals[0]).not.toHaveProperty('_key');
    }
  });

  it('preserves the existing id and isNew:false when editing an existing session', async () => {
    const { result } = await renderHook(() => useEditSession(easyRunSession, onBack));
    const payload = result.current.buildSavePayload();
    expect(payload.ok).toBe(true);
    if (payload.ok) {
      expect(payload.isNew).toBe(false);
      expect(payload.session.id).toBe('easy1');
    }
  });

  it('uses the passed folderId for a brand-new session, and falls back to "default" otherwise', async () => {
    const withFolder = await renderHook(() => useEditSession(undefined, onBack, undefined, 'custom-folder'));
    await act(async () => withFolder.result.current.setName('A'));
    const p1 = withFolder.result.current.buildSavePayload();
    expect(p1.ok && p1.session.folderId).toBe('custom-folder');

    const noFolder = await renderHook(() => useEditSession(undefined, onBack));
    await act(async () => noFolder.result.current.setName('B'));
    const p2 = noFolder.result.current.buildSavePayload();
    expect(p2.ok && p2.session.folderId).toBe('default');
  });
});

describe('buildSavePayload — circuit', () => {
  it('fails with nameRequired when the name is blank', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack, 'circuit'));
    await act(async () => result.current.addInterval('work'));
    const payload = result.current.buildSavePayload();
    expect(payload).toEqual({
      ok: false, titleKey: 'alerts.nameRequiredTitle', messageKey: 'alerts.nameRequiredMessage',
    });
  });

  it('fails with noWorkIntervals when there is no work interval', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack, 'circuit'));
    await act(async () => result.current.setName('NoWork'));
    await act(async () => result.current.addInterval('rest'));
    const payload = result.current.buildSavePayload();
    expect(payload).toEqual({
      ok: false, titleKey: 'alerts.noWorkIntervalsTitle', messageKey: 'alerts.noWorkIntervalsMessage',
    });
  });

  it('builds a valid circuit session', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack, 'circuit'));
    await act(async () => result.current.setName('My Circuit'));
    await act(async () => result.current.addInterval('work'));
    await act(async () => result.current.addInterval('rest'));
    const payload = result.current.buildSavePayload();
    expect(payload.ok).toBe(true);
    if (payload.ok && payload.session.mode === 'circuit') {
      expect(payload.session.name).toBe('My Circuit');
      expect(payload.session.intervals).toHaveLength(2);
      expect(payload.session.intervals[0]).not.toHaveProperty('_key');
      expect(payload.session.circuits).toBe(3);
      expect(payload.session.warmup).toBe(60);
      expect(payload.session.cooldown).toBe(60);
      expect(payload.session.circuitRest).toBe(30);
      expect(payload.isNew).toBe(true);
    }
  });

  it('preserves the existing id and isNew:false when editing an existing circuit session', async () => {
    const { result } = await renderHook(() => useEditSession(circuitSession, onBack));
    const payload = result.current.buildSavePayload();
    expect(payload.ok).toBe(true);
    if (payload.ok) {
      expect(payload.isNew).toBe(false);
      expect(payload.session.id).toBe('circ1');
    }
  });
});

// ── hasChanges ─────────────────────────────────────────────────────────

describe('hasChanges', () => {
  it('is false on load and true after editing circuit-specific fields', async () => {
    const { result } = await renderHook(() => useEditSession(circuitSession, onBack));
    expect(result.current.draft.hasChanges).toBe(false);
    await act(async () => result.current.openCircuitWarmupPicker());
    await act(async () => result.current.commitPicker({ selected: [10, 0] }));
    expect(result.current.draft.hasChanges).toBe(true);
  });

  it('is true after toggling mode auto-builds a previously empty interval list', async () => {
    const { result } = await renderHook(() => useEditSession(undefined, onBack));
    expect(result.current.draft.hasChanges).toBe(false);
    await act(async () => result.current.toggleMode(true));
    expect(result.current.draft.hasChanges).toBe(true);
  });

  it('reflects speed/incline/spin edits for non-circuit modes', async () => {
    const { result } = await renderHook(() => useEditSession(easyRunSession, onBack));
    expect(result.current.draft.hasChanges).toBe(false);
    await act(async () => result.current.setRunSpeed('workSpeed', 99));
    expect(result.current.draft.hasChanges).toBe(true);
  });
});
