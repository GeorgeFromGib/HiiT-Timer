import { useMemo, useRef, useState } from 'react';
import { i18n } from '../lib/i18n';
import { appAlert } from '../lib/appAlert';
import {
  getSessionSegments, speedForPhase, spinValueForPhase, inclineForPhase,
  type Session, type RunSpeeds, type RunInclines, type SpinValues,
  newId,
} from '../lib/sessions';
import { buildSessionFromDraft, validateDraft } from '../lib/sessionDraft';
import { type PresetLevel } from '../lib/presets';
import { INTENSITY_PRESETS, findMatchingIntensityPresetForIntervals } from '../lib/intensityPresets';
import {
  totalDuration, expandCircuit, computeRoundsForTargetDuration,
  type Interval, type Phase, type Segment,
} from '../lib/workout';
import { toDisplay } from '../lib/speedUnit';

import { type LocalInterval, toLocal, type TimeField, type SavePayload } from './editSessionTypes';
import { useEasyModeEdit } from './useEasyModeEdit';
import { useCircuitModeEdit } from './useCircuitModeEdit';
import { useIntervalListEdit } from './useIntervalListEdit';
import { useSpeedAndSpinEdit } from './useSpeedAndSpinEdit';
import { usePickerState, MIN_TARGET_DURATION_MINUTES, MAX_TARGET_DURATION_MINUTES, type EditSessionPicker, type PickerValues } from './usePickerState';

// Re-export shared types — EditSessionScreen imports these from here
export type { LocalInterval, TimeField, SavePayload, EditSessionPicker, PickerValues };
export { toLocal };

const PHASES: Phase[] = ['warmup', 'work', 'rest', 'cooldown'];
const CIRCUIT_PHASES: Phase[] = ['work', 'rest'];

export interface EditSessionDraft {
  name:                string;
  isAdvanced:          boolean;
  isCircuit:           boolean;
  isSpinning:          boolean;
  fieldValues:         Record<TimeField, number>;
  rounds:              number;
  intervals:           LocalInterval[];
  previewSegments:     Segment[];
  previewTotal:        number;
  activityType:        'run' | 'spinning' | undefined;
  runSpeeds:           RunSpeeds;
  runInclines:         RunInclines;
  inclineEnabled:      boolean;
  spinValues:          SpinValues;
  activeTimingPreset:  PresetLevel | null;
  targetLengthMinutes: number;
  activeSpeedPreset:   PresetLevel | null;
  activeInclinePreset: PresetLevel | null;
  activeSpinPreset:    PresetLevel | null;
  hasChanges:          boolean;
  circuitWarmup:       number;
  circuitCooldown:     number;
  circuitRest:         number;
  circuitCount:        number;
}

export interface EditSessionInterface {
  draft:   EditSessionDraft;
  picker:  EditSessionPicker | null;
  setName:                  (name: string) => void;
  setRunSpeed:              (field: keyof RunSpeeds, value: number) => void;
  toggleMode:               (advanced: boolean) => void;
  cyclePhase:               (key: string) => void;
  addInterval:              (type: Phase) => void;
  duplicateInterval:        (key: string) => void;
  removeInterval:           (key: string) => void;
  clearIntervals:           () => void;
  reorderIntervals:         (data: LocalInterval[]) => void;
  openFieldPicker:          (field: TimeField) => void;
  setFieldEnabled:          (field: TimeField, enabled: boolean) => void;
  openRoundsPicker:         () => void;
  openIntervalPicker:       (key: string) => void;
  openSpeedPicker:          (field: keyof RunSpeeds, displayValue: number, isMiles: boolean) => void;
  openIntervalSpeedPicker:  (key: string, isMiles: boolean) => void;
  clearIntervalSpeed:       (key: string) => void;
  commitPicker:             (values: PickerValues) => void;
  dismissPicker:            () => void;
  applyDurationPreset:      (level: PresetLevel) => void;
  openCustomLengthPicker:   () => void;
  applySpeedPreset:         (level: PresetLevel) => void;
  applyInclinePreset:       (level: PresetLevel) => void;
  applySpinPreset:          (level: PresetLevel) => void;
  setActivityLabel:         (key: string, label: string) => void;
  openCircuitWarmupPicker:  () => void;
  openCircuitCooldownPicker: () => void;
  openCircuitRestPicker:    () => void;
  openCircuitsPicker:       () => void;
  openSpinResistancePicker:    (field: keyof SpinValues) => void;
  openSpinPowerPicker:         (field: keyof SpinValues) => void;
  openIntervalResistancePicker: (key: string) => void;
  openIntervalPowerPicker:     (key: string) => void;
  clearIntervalResistance:     (key: string) => void;
  clearIntervalPower:          (key: string) => void;
  openInclinePicker:            (field: keyof RunInclines) => void;
  openIntervalInclinePicker:    (key: string) => void;
  clearIntervalIncline:         (key: string) => void;
  setInclineEnabled:            (enabled: boolean) => void;
  buildSavePayload:         () => SavePayload;
}

export function useEditSession(
  existing: Session | undefined,
  onBack: () => void,
  initialActivityType?: 'general' | 'run' | 'circuit' | 'spinning',
  folderId?: string,
): EditSessionInterface {
  const sessionFolderId = existing?.folderId ?? folderId ?? 'default';

  const [name, setName] = useState(existing?.name ?? '');
  const [mode, setMode] = useState<'easy' | 'advanced' | 'circuit'>(() => {
    if (existing) return existing.mode;
    if (initialActivityType === 'circuit') return 'circuit';
    return 'easy';
  });

  const [activityType] = useState<'run' | 'spinning' | undefined>(() => {
    if (existing && existing.mode !== 'circuit') return existing.activityType;
    if (!existing && initialActivityType === 'run') return 'run';
    if (!existing && initialActivityType === 'spinning') return 'spinning';
    return undefined;
  });
  const [targetLengthMinutes, setTargetLengthMinutes] = useState(15);
  // True once the session's length is considered established — either the session already had
  // a length over 10 minutes when opened, or the user has since picked a target length. Once
  // true, changing rounds directly (which drifts the length) warns instead of silently updating it.
  const [lengthIsSet, setLengthIsSet] = useState(() => {
    if (existing?.mode === 'easy') {
      const c = existing.config;
      return c.warmup + c.rounds * (c.high + c.low) + c.cooldown > 600;
    }
    return false;
  });
  // True when Easy-mode fields (warmup/work/rest/cooldown/rounds) have changed since the
  // Advanced interval list was last built from them — signals toggleMode() to rebuild.
  const [easyDirty, setEasyDirty] = useState(false);

  // Change tracking for coordinator-owned state
  const initialName = useRef(existing?.name ?? '').current;

  // Mode sub-hooks
  const easyEdit     = useEasyModeEdit(existing);
  const circuitEdit  = useCircuitModeEdit(existing);
  const intervalEdit = useIntervalListEdit(existing);
  const speedSpinEdit = useSpeedAndSpinEdit(existing);

  // Derived from each sub-hook's own preset checkpoint — not manually flagged at each call site.
  const timingDirty = mode === 'advanced' ? intervalEdit.isTimingDirty
                     : mode === 'easy'     ? easyEdit.isTimingDirty
                     : false;

  function warnIfShortDuration(secs: number) {
    if (secs < 300) {
      appAlert('warning', i18n.t('alerts.shortWarmupCooldownTitle'), i18n.t('alerts.shortWarmupCooldownMessage'));
    }
  }

  // Keeps total session length constant when warmup/work/rest/cooldown changes by re-solving
  // rounds against the pre-change total, using the field values as they stood before this edit.
  function recalcRoundsForFieldChange(field: TimeField, newSecs: number) {
    const { warmup, work, rest, cooldown } = easyEdit.fieldValues;
    const currentTotal = warmup + easyEdit.rounds * (work + rest) + cooldown;
    const newWarmup   = field === 'warmup'   ? newSecs : warmup;
    const newWork     = field === 'work'     ? newSecs : work;
    const newRest     = field === 'rest'     ? newSecs : rest;
    const newCooldown = field === 'cooldown' ? newSecs : cooldown;
    easyEdit.setRounds(computeRoundsForTargetDuration(newWarmup, newWork, newRest, newCooldown, currentTotal));
  }

  const pickerState = usePickerState(
    intervalEdit.intervals,
    easyEdit.fieldValues,
    {
      warmup:   circuitEdit.circuitWarmup,
      cooldown: circuitEdit.circuitCooldown,
      rest:     circuitEdit.circuitRest,
      count:    circuitEdit.circuitCount,
    },
    (result) => {
      if (result.type === 'rounds') {
        if (lengthIsSet && result.value !== easyEdit.rounds) {
          appAlert('warning', i18n.t('alerts.roundsChangeLengthTitle'), i18n.t('alerts.roundsChangeLengthMessage'));
          setLengthIsSet(false);
        }
        easyEdit.setRounds(result.value);
        setEasyDirty(true);
        setTargetLengthMinutes(nearestTargetMinutes(result.value));
      } else if (result.type === 'field') {
        easyEdit.setField(result.field, result.secs);
        setEasyDirty(true);
        recalcRoundsForFieldChange(result.field, result.secs);
        if (result.field === 'warmup' || result.field === 'cooldown') warnIfShortDuration(result.secs);
      } else if (result.type === 'targetDuration') {
        applyTimePresetMinutes(result.minutes);
      } else if (result.type === 'speed') {
        speedSpinEdit.setRunSpeed(result.field, result.kmh);
      } else if (result.type === 'intervalSpeed') {
        intervalEdit.setIntervalSpeed(result.key, result.kmh);
      } else if (result.type === 'spinResistance') {
        speedSpinEdit.setSpinValue(result.field, result.value);
      } else if (result.type === 'spinPower') {
        speedSpinEdit.setSpinValue(result.field, result.value);
      } else if (result.type === 'intervalResistance') {
        intervalEdit.setIntervalResistance(result.key, result.value);
      } else if (result.type === 'intervalPower') {
        intervalEdit.setIntervalPower(result.key, result.value);
      } else if (result.type === 'incline') {
        speedSpinEdit.setRunIncline(result.field, result.value);
      } else if (result.type === 'intervalIncline') {
        intervalEdit.setIntervalIncline(result.key, result.value);
      } else if (result.type === 'circuitWarmup') {
        circuitEdit.set('warmup', result.secs);
        warnIfShortDuration(result.secs);
      } else if (result.type === 'circuitCooldown') {
        circuitEdit.set('cooldown', result.secs);
        warnIfShortDuration(result.secs);
      } else if (result.type === 'circuitRest') {
        circuitEdit.set('rest', result.secs);
      } else if (result.type === 'circuitCount') {
        circuitEdit.set('count', result.value);
      } else if (result.type === 'interval') {
        intervalEdit.setIntervalDuration(result.key, result.secs);
      }
    },
  );

  function setRunSpeed(field: keyof RunSpeeds, value: number) {
    speedSpinEdit.setRunSpeed(field, value);
  }

  const previewSegments = useMemo(() => {
    const cleanIntervals: Interval[] = intervalEdit.intervals.map(({ _key, ...iv }) => iv);
    if (mode === 'circuit') {
      return expandCircuit(cleanIntervals, circuitEdit.circuitCount, circuitEdit.circuitWarmup, circuitEdit.circuitCooldown, circuitEdit.circuitRest);
    }
    const draft: Session = mode === 'easy'
      ? { id: '', name: '', folderId: sessionFolderId, mode: 'easy', config: easyEdit.easyConfig, activityType, runSpeeds: speedSpinEdit.runSpeeds, runInclines: speedSpinEdit.runInclines, inclineEnabled: speedSpinEdit.inclineEnabled, spinValues: speedSpinEdit.spinValues }
      : { id: '', name: '', folderId: sessionFolderId, mode: 'advanced', intervals: cleanIntervals, activityType, runSpeeds: speedSpinEdit.runSpeeds, runInclines: speedSpinEdit.runInclines, inclineEnabled: speedSpinEdit.inclineEnabled, spinValues: speedSpinEdit.spinValues };
    return getSessionSegments(draft);
  }, [mode, easyEdit.fieldValues, easyEdit.rounds, intervalEdit.intervals, activityType, speedSpinEdit.runSpeeds, speedSpinEdit.runInclines, speedSpinEdit.inclineEnabled, speedSpinEdit.spinValues,
      circuitEdit.circuitWarmup, circuitEdit.circuitCooldown, circuitEdit.circuitCount, circuitEdit.circuitRest]);

  function toggleMode(advanced: boolean) {
    if (advanced) {
      if (intervalEdit.intervals.length === 0 || easyDirty) {
        intervalEdit.buildFromEasy(easyEdit.easyConfig);
        setEasyDirty(false);
      }
      setMode('advanced');
    } else {
      const result = intervalEdit.tryConvertToEasy(intervalEdit.intervals);
      if (!result.ok) {
        appAlert(
          'error',
          i18n.t('alerts.cannotSwitchEasyTitle'),
          i18n.t(result.reasonKey, result.reasonParams?.phase !== undefined
            ? { ...result.reasonParams, phase: i18n.t('phases.' + result.reasonParams.phase) }
            : result.reasonParams),
        );
        return;
      }
      easyEdit.setField('warmup', result.warmup);
      easyEdit.setField('cooldown', result.cooldown);
      easyEdit.setField('work', result.work);
      easyEdit.setField('rest', result.rest);
      easyEdit.setRounds(result.rounds);
      setEasyDirty(false);
      setMode('easy');
    }
  }

  function cyclePhase(key: string) {
    const phases = mode === 'circuit' ? CIRCUIT_PHASES : PHASES;
    intervalEdit.cyclePhase(key, phases);
  }

  function addInterval(type: Phase) {
    intervalEdit.addInterval(type);
  }

  function duplicateInterval(key: string) {
    intervalEdit.duplicateInterval(key);
  }

  function removeInterval(key: string) {
    intervalEdit.removeInterval(key);
  }

  function applyDurationPreset(level: PresetLevel) {
    const p = INTENSITY_PRESETS[level];
    const doApply = () => {
      const rounds = computeRoundsForTargetDuration(
        easyEdit.fieldValues.warmup, p.work, p.rest, easyEdit.fieldValues.cooldown,
        targetLengthMinutes * 60,
      );
      easyEdit.applyIntensityPreset(p.work, p.rest, rounds, level);
      if (mode === 'advanced') {
        const config = { warmup: easyEdit.fieldValues.warmup, high: Math.max(1, p.work), low: p.rest, rounds, cooldown: easyEdit.fieldValues.cooldown };
        intervalEdit.buildFromEasy(config);
        setEasyDirty(false);
      } else {
        setEasyDirty(true);
      }
    };
    if (timingDirty) {
      appAlert(
        'warning',
        i18n.t('alerts.overwriteTitle'),
        i18n.t('alerts.overwriteTimingMessage'),
        [{ text: i18n.t('alerts.cancel'), style: 'cancel' }, { text: i18n.t('alerts.apply'), onPress: doApply }],
      );
    } else {
      doApply();
    }
  }

  function nearestTargetMinutes(rounds: number): number {
    const { warmup, work, rest, cooldown } = easyEdit.fieldValues;
    const totalSeconds = warmup + rounds * (work + rest) + cooldown;
    const minutes = Math.round(totalSeconds / 60);
    return Math.min(MAX_TARGET_DURATION_MINUTES, Math.max(MIN_TARGET_DURATION_MINUTES, minutes));
  }

  function applyTimePresetMinutes(minutes: number) {
    const rounds = computeRoundsForTargetDuration(
      easyEdit.fieldValues.warmup, easyEdit.fieldValues.work, easyEdit.fieldValues.rest, easyEdit.fieldValues.cooldown,
      minutes * 60,
    );
    easyEdit.setRounds(rounds);
    setTargetLengthMinutes(minutes);
    setLengthIsSet(true);
  }

  function openCustomLengthPicker() {
    pickerState.openTargetDurationPicker(targetLengthMinutes);
  }

  function openIntervalSpeedPicker(key: string, isMiles: boolean) {
    const iv = intervalEdit.intervals.find(i => i._key === key);
    if (!iv) return;
    const kmh = iv.speed ?? speedForPhase(iv.type, speedSpinEdit.runSpeeds);
    const displayVal = toDisplay(kmh, isMiles ? 'miles' : 'km');
    pickerState.openIntervalSpeedPicker(key, displayVal, isMiles);
  }

  function openIntervalResistancePicker(key: string) {
    const iv = intervalEdit.intervals.find(i => i._key === key);
    if (!iv) return;
    const current = iv.resistance ?? spinValueForPhase(iv.type, speedSpinEdit.spinValues).resistance;
    pickerState.openIntervalResistancePicker(key, current);
  }

  function openIntervalPowerPicker(key: string) {
    const iv = intervalEdit.intervals.find(i => i._key === key);
    if (!iv) return;
    const current = iv.power ?? spinValueForPhase(iv.type, speedSpinEdit.spinValues).power;
    pickerState.openIntervalPowerPicker(key, current);
  }

  function openIntervalInclinePicker(key: string) {
    const iv = intervalEdit.intervals.find(i => i._key === key);
    if (!iv) return;
    const current = iv.incline ?? inclineForPhase(iv.type, speedSpinEdit.runInclines);
    pickerState.openIntervalInclinePicker(key, current);
  }

  function buildSavePayload(): SavePayload {
    if (mode === 'circuit') {
      if (!name.trim()) {
        return { ok: false, titleKey: 'alerts.nameRequiredTitle', messageKey: 'alerts.nameRequiredMessage' };
      }
      const hasWork = intervalEdit.intervals.some(iv => iv.type === 'work');
      if (!hasWork) {
        return { ok: false, titleKey: 'alerts.noWorkIntervalsTitle', messageKey: 'alerts.noWorkIntervalsMessage' };
      }
      const cleanIntervals: Interval[] = intervalEdit.intervals.map(({ _key, ...iv }) => iv);
      const session: Session = {
        id: existing?.id ?? newId(),
        name: name.trim(),
        folderId: sessionFolderId,
        mode: 'circuit',
        intervals: cleanIntervals,
        circuits:    circuitEdit.circuitCount,
        warmup:      circuitEdit.circuitWarmup,
        cooldown:    circuitEdit.circuitCooldown,
        circuitRest: circuitEdit.circuitRest,
      };
      return { ok: true, session, isNew: !existing };
    }
    const validation = validateDraft(name, mode, intervalEdit.intervals);
    if (!validation.ok) {
      return { ok: false, titleKey: validation.titleKey, messageKey: validation.messageKey };
    }
    const cleanIntervals: Interval[] = intervalEdit.intervals.map(({ _key, ...iv }) => iv);
    const session = buildSessionFromDraft(
      mode, name.trim(), easyEdit.easyConfig, cleanIntervals, activityType, speedSpinEdit.runSpeeds, existing?.id,
      undefined, speedSpinEdit.spinValues, speedSpinEdit.runInclines, speedSpinEdit.inclineEnabled, sessionFolderId,
    );
    return { ok: true, session, isNew: !existing };
  }

  const hasChanges = useMemo(() => {
    if (mode === 'circuit') {
      return circuitEdit.hasChanges
        || name !== initialName
        || intervalEdit.hasChanges;
    }
    return easyEdit.hasChanges
      || name !== initialName
      || intervalEdit.hasChanges
      || speedSpinEdit.hasChanges;
  }, [
    mode, name, intervalEdit.hasChanges, speedSpinEdit.hasChanges,
    easyEdit.hasChanges, circuitEdit.hasChanges,
    initialName,
  ]);

  const activeTimingPreset: PresetLevel | null = mode === 'advanced'
    ? findMatchingIntensityPresetForIntervals(intervalEdit.intervals.map(({ _key, ...iv }) => iv))
    : easyEdit.activeTimingPreset;

  const draft: EditSessionDraft = {
    name,
    isAdvanced:  mode === 'advanced',
    isCircuit:   mode === 'circuit',
    isSpinning:  activityType === 'spinning',
    fieldValues: easyEdit.fieldValues,
    rounds:      easyEdit.rounds,
    intervals: intervalEdit.intervals,
    previewSegments,
    previewTotal: totalDuration(previewSegments),
    activityType,
    runSpeeds:  speedSpinEdit.runSpeeds,
    runInclines: speedSpinEdit.runInclines,
    inclineEnabled: speedSpinEdit.inclineEnabled,
    spinValues: speedSpinEdit.spinValues,
    activeTimingPreset,
    targetLengthMinutes,
    activeSpeedPreset: speedSpinEdit.activeSpeedPreset,
    activeInclinePreset: speedSpinEdit.activeInclinePreset,
    activeSpinPreset:  speedSpinEdit.activeSpinPreset,
    hasChanges,
    circuitWarmup:   circuitEdit.circuitWarmup,
    circuitCooldown: circuitEdit.circuitCooldown,
    circuitRest:     circuitEdit.circuitRest,
    circuitCount:    circuitEdit.circuitCount,
  };

  return {
    draft,
    picker: pickerState.picker,
    setName,
    setRunSpeed,
    toggleMode,
    cyclePhase,
    addInterval,
    duplicateInterval,
    removeInterval,
    clearIntervals:   intervalEdit.clearIntervals,
    reorderIntervals: intervalEdit.reorderIntervals,
    openFieldPicker:  pickerState.openFieldPicker,
    setFieldEnabled:  (field: TimeField, enabled: boolean) => {
      if (field === 'warmup' || field === 'cooldown') {
        const newSecs = easyEdit.setFieldEnabled(field, enabled);
        recalcRoundsForFieldChange(field, newSecs);
        warnIfShortDuration(newSecs);
      } else {
        easyEdit.setFieldEnabled(field, enabled);
      }
      setEasyDirty(true);
    },
    openRoundsPicker: () => pickerState.openRoundsPicker(easyEdit.rounds),
    openIntervalPicker: pickerState.openIntervalPicker,
    openSpeedPicker:    pickerState.openSpeedPicker,
    openIntervalSpeedPicker,
    clearIntervalSpeed: intervalEdit.clearIntervalSpeed,
    commitPicker:    pickerState.commitPicker,
    dismissPicker:   pickerState.dismissPicker,
    applyDurationPreset,
    openCustomLengthPicker,
    applySpeedPreset: speedSpinEdit.applySpeedPreset,
    applyInclinePreset: speedSpinEdit.applyInclinePreset,
    applySpinPreset:  speedSpinEdit.applySpinPreset,
    setActivityLabel: intervalEdit.setActivityLabel,
    openCircuitWarmupPicker:   pickerState.openCircuitWarmupPicker,
    openCircuitCooldownPicker: pickerState.openCircuitCooldownPicker,
    openCircuitRestPicker:     pickerState.openCircuitRestPicker,
    openCircuitsPicker:        pickerState.openCircuitCountPicker,
    openSpinResistancePicker:    (field) => pickerState.openSpinResistancePicker(field, speedSpinEdit.spinValues[field]),
    openSpinPowerPicker:         (field) => pickerState.openSpinPowerPicker(field, speedSpinEdit.spinValues[field]),
    openIntervalResistancePicker,
    openIntervalPowerPicker,
    clearIntervalResistance: intervalEdit.clearIntervalResistance,
    clearIntervalPower:      intervalEdit.clearIntervalPower,
    openInclinePicker:         (field) => pickerState.openInclinePicker(field, speedSpinEdit.runInclines[field]),
    openIntervalInclinePicker,
    clearIntervalIncline:      intervalEdit.clearIntervalIncline,
    setInclineEnabled:         speedSpinEdit.setInclineEnabled,
    buildSavePayload,
  };
}
