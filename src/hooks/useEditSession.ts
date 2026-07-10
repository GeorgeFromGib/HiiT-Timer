import { useMemo, useRef, useState } from 'react';
import { i18n } from '../lib/i18n';
import { Alert } from 'react-native';
import {
  getSessionSegments, speedForPhase, spinValueForPhase,
  type Session, type RunSpeeds, type SpinValues,
  newId,
} from '../lib/sessions';
import { buildSessionFromDraft, validateDraft } from '../lib/sessionDraft';
import {
  type PresetLevel, DURATION_PRESETS,
  findMatchingDurationPresetForIntervals,
} from '../lib/presets';
import {
  totalDuration, expandCircuit,
  type Interval, type Phase, type Segment,
} from '../lib/workout';
import { toDisplay } from '../lib/speedUnit';

import { type LocalInterval, toLocal, type TimeField, type SavePayload } from './editSessionTypes';
import { useEasyModeEdit } from './useEasyModeEdit';
import { useCircuitModeEdit } from './useCircuitModeEdit';
import { useIntervalListEdit } from './useIntervalListEdit';
import { useSpeedAndSpinEdit } from './useSpeedAndSpinEdit';
import { usePickerState, type EditSessionPicker, type PickerValues } from './usePickerState';

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
  spinValues:          SpinValues;
  activeTimingPreset:  PresetLevel | null;
  activeSpeedPreset:   PresetLevel | null;
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
  openRoundsPicker:         () => void;
  openIntervalPicker:       (key: string) => void;
  openSpeedPicker:          (field: keyof RunSpeeds, displayValue: number, isMiles: boolean) => void;
  openIntervalSpeedPicker:  (key: string, isMiles: boolean) => void;
  clearIntervalSpeed:       (key: string) => void;
  commitPicker:             (values: PickerValues) => void;
  dismissPicker:            () => void;
  applyDurationPreset:      (level: PresetLevel) => void;
  applySpeedPreset:         (level: PresetLevel) => void;
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
  const [timingDirty, setTimingDirty] = useState(false);

  // Change tracking for coordinator-owned state
  const initialName            = useRef(existing?.name ?? '').current;
  const initialActivityTypeRef = useRef<'run' | 'spinning' | undefined>(
    existing && existing.mode !== 'circuit'
      ? existing.activityType
      : (initialActivityType === 'run' ? 'run' : initialActivityType === 'spinning' ? 'spinning' : undefined)
  ).current;

  // Mode sub-hooks
  const easyEdit     = useEasyModeEdit(existing);
  const circuitEdit  = useCircuitModeEdit(existing);
  const intervalEdit = useIntervalListEdit(existing);
  const speedSpinEdit = useSpeedAndSpinEdit(existing);

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
        easyEdit.setRounds(result.value);
        setTimingDirty(true);
      } else if (result.type === 'field') {
        easyEdit.setField(result.field, result.secs);
        setTimingDirty(true);
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
      } else if (result.type === 'circuitWarmup') {
        circuitEdit.set('warmup', result.secs);
        setTimingDirty(true);
      } else if (result.type === 'circuitCooldown') {
        circuitEdit.set('cooldown', result.secs);
        setTimingDirty(true);
      } else if (result.type === 'circuitRest') {
        circuitEdit.set('rest', result.secs);
        setTimingDirty(true);
      } else if (result.type === 'circuitCount') {
        circuitEdit.set('count', result.value);
        setTimingDirty(true);
      } else if (result.type === 'interval') {
        intervalEdit.setIntervalDuration(result.key, result.secs);
        setTimingDirty(true);
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
      ? { id: '', name: '', folderId: sessionFolderId, mode: 'easy', config: easyEdit.easyConfig, activityType, runSpeeds: speedSpinEdit.runSpeeds, spinValues: speedSpinEdit.spinValues }
      : { id: '', name: '', folderId: sessionFolderId, mode: 'advanced', intervals: cleanIntervals, activityType, runSpeeds: speedSpinEdit.runSpeeds, spinValues: speedSpinEdit.spinValues };
    return getSessionSegments(draft);
  }, [mode, easyEdit.fieldValues, easyEdit.rounds, intervalEdit.intervals, activityType, speedSpinEdit.runSpeeds, speedSpinEdit.spinValues,
      circuitEdit.circuitWarmup, circuitEdit.circuitCooldown, circuitEdit.circuitCount, circuitEdit.circuitRest]);

  function toggleMode(advanced: boolean) {
    if (advanced) {
      if (intervalEdit.intervals.length === 0) {
        intervalEdit.buildFromEasy(easyEdit.easyConfig);
      }
      setMode('advanced');
    } else {
      const result = intervalEdit.tryConvertToEasy(intervalEdit.intervals);
      if (!result.ok) {
        Alert.alert(
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
      setMode('easy');
    }
  }

  function cyclePhase(key: string) {
    setTimingDirty(true);
    const phases = mode === 'circuit' ? CIRCUIT_PHASES : PHASES;
    intervalEdit.cyclePhase(key, phases);
  }

  function addInterval(type: Phase) {
    setTimingDirty(true);
    intervalEdit.addInterval(type);
  }

  function duplicateInterval(key: string) {
    setTimingDirty(true);
    intervalEdit.duplicateInterval(key);
  }

  function removeInterval(key: string) {
    setTimingDirty(true);
    intervalEdit.removeInterval(key);
  }

  function applyDurationPreset(level: PresetLevel) {
    const p = DURATION_PRESETS[level];
    const doApply = () => {
      easyEdit.applyPresetValues(p.warmup, p.work, p.rest, p.rounds, p.cooldown, level);
      setTimingDirty(false);
      if (mode === 'advanced') {
        const config = { warmup: p.warmup, high: Math.max(1, p.work), low: p.rest, rounds: Math.max(1, p.rounds), cooldown: p.cooldown };
        intervalEdit.buildFromEasy(config);
      }
    };
    if (timingDirty) {
      Alert.alert(
        i18n.t('alerts.overwriteTitle'),
        i18n.t('alerts.overwriteTimingMessage'),
        [{ text: i18n.t('alerts.cancel'), style: 'cancel' }, { text: i18n.t('alerts.apply'), onPress: doApply }],
      );
    } else {
      doApply();
    }
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
      undefined, speedSpinEdit.spinValues, sessionFolderId,
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
      || activityType !== initialActivityTypeRef
      || speedSpinEdit.hasChanges;
  }, [
    mode, name, intervalEdit.hasChanges, activityType, speedSpinEdit.hasChanges,
    easyEdit.hasChanges, circuitEdit.hasChanges,
    initialName, initialActivityTypeRef,
  ]);

  const activeTimingPreset: PresetLevel | null = mode === 'advanced'
    ? findMatchingDurationPresetForIntervals(intervalEdit.intervals.map(({ _key, ...iv }) => iv))
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
    spinValues: speedSpinEdit.spinValues,
    activeTimingPreset,
    activeSpeedPreset: speedSpinEdit.activeSpeedPreset,
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
    clearIntervals:   () => { setTimingDirty(true); intervalEdit.clearIntervals(); },
    reorderIntervals: (data: LocalInterval[]) => { setTimingDirty(true); intervalEdit.reorderIntervals(data); },
    openFieldPicker:  pickerState.openFieldPicker,
    openRoundsPicker: () => pickerState.openRoundsPicker(easyEdit.rounds),
    openIntervalPicker: pickerState.openIntervalPicker,
    openSpeedPicker:    pickerState.openSpeedPicker,
    openIntervalSpeedPicker,
    clearIntervalSpeed: intervalEdit.clearIntervalSpeed,
    commitPicker:    pickerState.commitPicker,
    dismissPicker:   pickerState.dismissPicker,
    applyDurationPreset,
    applySpeedPreset: speedSpinEdit.applySpeedPreset,
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
    buildSavePayload,
  };
}
