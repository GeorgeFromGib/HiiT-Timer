import { useMemo, useRef, useState } from 'react';
import { useDraft } from './useDraft';
import { i18n } from '../lib/i18n';
import { Alert } from 'react-native';
import {
  getSessionSegments, speedForPhase,
  type Session, type RunSpeeds, DEFAULT_RUN_SPEEDS, newId,
} from '../lib/sessions';
import { buildSessionFromDraft, validateDraft } from '../lib/sessionDraft';
import {
  type PresetLevel, DURATION_PRESETS, SPEED_PRESETS,
  findMatchingDurationPresetForIntervals, findMatchingSpeedPreset,
} from '../lib/presets';
import {
  totalDuration, expandCircuit,
  type Interval, type Phase, type Segment,
} from '../lib/workout';
import { toDisplay } from '../lib/speedUnit';

import { type LocalInterval, toLocal, type TimeField, type SavePayload } from './editSessionTypes';
import { useEasyModeEdit } from './useEasyModeEdit';
import { useCircuitModeEdit } from './useCircuitModeEdit';
import { useAdvancedModeEdit } from './useAdvancedModeEdit';
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
  fieldValues:         Record<TimeField, number>;
  rounds:              number;
  intervals:           LocalInterval[];
  previewSegments:     Segment[];
  previewTotal:        number;
  activityType:        'run' | undefined;
  runSpeeds:           RunSpeeds;
  activeTimingPreset:  PresetLevel | null;
  activeSpeedPreset:   PresetLevel | null;
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
  setActivityType:          (type: 'run' | undefined) => void;
  setDisplayActivityType:   (type: 'general' | 'run' | 'circuit') => void;
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
  setActivityLabel:         (key: string, label: string) => void;
  openCircuitWarmupPicker:  () => void;
  openCircuitCooldownPicker: () => void;
  openCircuitRestPicker:    () => void;
  openCircuitsPicker:       () => void;
  buildSavePayload:         () => SavePayload;
}

export function useEditSession(
  existing: Session | undefined,
  onBack: () => void,
): EditSessionInterface {
  const [name, setName] = useState(existing?.name ?? '');
  const [mode, setMode] = useState<'easy' | 'advanced' | 'circuit'>(existing?.mode ?? 'easy');

  const [intervals, setIntervals] = useState<LocalInterval[]>(
    existing?.mode === 'advanced' || existing?.mode === 'circuit'
      ? existing.intervals.map(toLocal) : []
  );
  const [activityType, setActivityType] = useState<'run' | undefined>(
    existing && existing.mode !== 'circuit' ? existing.activityType : undefined
  );
  const [runSpeeds, setRunSpeeds] = useState<RunSpeeds>(
    existing && existing.mode !== 'circuit' ? (existing.runSpeeds ?? DEFAULT_RUN_SPEEDS) : DEFAULT_RUN_SPEEDS
  );
  const [timingDirty, setTimingDirty] = useState(false);
  const [speedsDirty, setSpeedsDirty] = useState(false);
  const [activeSpeedPreset, setActiveSpeedPreset] = useState<PresetLevel | null>(() =>
    existing && existing.mode !== 'circuit' && existing.runSpeeds
      ? findMatchingSpeedPreset(existing.runSpeeds) : null
  );

  // Change tracking for coordinator-owned state
  const initialName         = useRef(existing?.name ?? '').current;
  const initialActivityType = useRef(existing && existing.mode !== 'circuit' ? existing.activityType : undefined).current;
  const intervalsDraft      = useDraft<Interval[]>(
    existing?.mode === 'advanced' || existing?.mode === 'circuit' ? existing.intervals : []
  );
  const runSpeedsDraft      = useDraft(
    existing && existing.mode !== 'circuit' ? (existing.runSpeeds ?? DEFAULT_RUN_SPEEDS) : DEFAULT_RUN_SPEEDS
  );

  // Mode sub-hooks
  const easyEdit    = useEasyModeEdit(existing);
  const circuitEdit = useCircuitModeEdit(existing);
  const advanced    = useAdvancedModeEdit();

  const pickerState = usePickerState(
    intervals,
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
        setRunSpeed(result.field, result.kmh);
      } else if (result.type === 'intervalSpeed') {
        setIntervals(ivs =>
          ivs.map(iv => iv._key === result.key ? { ...iv, speed: result.kmh } : iv)
        );
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
      } else {
        // type === 'interval'
        setIntervals(ivs =>
          ivs.map(iv => iv._key === result.key ? { ...iv, dur: result.secs } : iv)
        );
        setTimingDirty(true);
      }
    },
  );

  function setRunSpeed(field: keyof RunSpeeds, value: number) {
    setRunSpeeds(prev => ({ ...prev, [field]: value }));
    setSpeedsDirty(true);
    setActiveSpeedPreset(null);
  }

  function resetToDefaults(type: 'general' | 'run' | 'circuit') {
    setName('');
    setIntervals([]);
    setTimingDirty(false);
    if (type === 'circuit') {
      setMode('circuit');
      setActivityType(undefined);
      circuitEdit.reset();
    } else {
      setMode('easy');
      setActivityType(type === 'run' ? 'run' : undefined);
      setSpeedsDirty(false);
      setActiveSpeedPreset(null);
      easyEdit.reset();
    }
  }

  function setDisplayActivityType(type: 'general' | 'run' | 'circuit') {
    const currentType = mode === 'circuit' ? 'circuit' : activityType === 'run' ? 'run' : 'general';
    if (currentType === type) return;
    if (!hasChanges) {
      resetToDefaults(type);
      return;
    }
    Alert.alert(
      i18n.t('alerts.switchTypeTitle'),
      i18n.t('alerts.switchTypeMessage'),
      [
        { text: i18n.t('alerts.cancel'), style: 'cancel' },
        { text: i18n.t('alerts.discard'), style: 'destructive', onPress: () => resetToDefaults(type) },
      ],
    );
  }

  const previewSegments = useMemo(() => {
    const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
    if (mode === 'circuit') {
      return expandCircuit(cleanIntervals, circuitEdit.circuitCount, circuitEdit.circuitWarmup, circuitEdit.circuitCooldown, circuitEdit.circuitRest);
    }
    const draft: Session = mode === 'easy'
      ? { id: '', name: '', mode: 'easy', config: easyEdit.easyConfig, activityType, runSpeeds }
      : { id: '', name: '', mode: 'advanced', intervals: cleanIntervals, activityType, runSpeeds };
    return getSessionSegments(draft);
  }, [mode, easyEdit.fieldValues, easyEdit.rounds, intervals, activityType, runSpeeds,
      circuitEdit.circuitWarmup, circuitEdit.circuitCooldown, circuitEdit.circuitCount, circuitEdit.circuitRest]);

  function toggleMode(advanced_: boolean) {
    if (advanced_) {
      if (intervals.length === 0) {
        setIntervals(advanced.buildFromEasy(easyEdit.easyConfig));
      }
      setMode('advanced');
    } else {
      const result = advanced.tryConvertToEasy(intervals);
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
    setIntervals(ivs => ivs.map(iv => {
      if (iv._key !== key) return iv;
      const currentIdx = phases.indexOf(iv.type);
      const nextType = currentIdx >= 0
        ? phases[(currentIdx + 1) % phases.length]
        : phases[0];
      return { ...iv, type: nextType };
    }));
  }

  function addInterval(type: Phase) {
    setTimingDirty(true);
    const last = [...intervals].reverse().find(iv => iv.type === type);
    setIntervals(ivs => [...ivs, toLocal({
      type,
      dur:           last?.dur ?? 30,
      activityLabel: last?.activityLabel,
    })]);
  }

  function duplicateInterval(key: string) {
    setTimingDirty(true);
    setIntervals(ivs => {
      const idx = ivs.findIndex(iv => iv._key === key);
      if (idx === -1) return ivs;
      const copy = toLocal(ivs[idx]);
      return [...ivs.slice(0, idx + 1), copy, ...ivs.slice(idx + 1)];
    });
  }

  function removeInterval(key: string) {
    setTimingDirty(true);
    setIntervals(ivs => ivs.filter(iv => iv._key !== key));
  }

  function applyDurationPreset(level: PresetLevel) {
    const p = DURATION_PRESETS[level];
    const doApply = () => {
      easyEdit.applyPresetValues(p.warmup, p.work, p.rest, p.rounds, p.cooldown, level);
      setTimingDirty(false);
      if (mode === 'advanced') {
        const config = { warmup: p.warmup, high: Math.max(1, p.work), low: p.rest, rounds: Math.max(1, p.rounds), cooldown: p.cooldown };
        setIntervals(advanced.buildFromEasy(config));
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

  function applySpeedPreset(level: PresetLevel) {
    const doApply = () => {
      setRunSpeeds(SPEED_PRESETS[level]);
      setSpeedsDirty(false);
      setActiveSpeedPreset(level);
    };
    if (speedsDirty) {
      Alert.alert(
        i18n.t('alerts.overwriteTitle'),
        i18n.t('alerts.overwriteSpeedMessage'),
        [{ text: i18n.t('alerts.cancel'), style: 'cancel' }, { text: i18n.t('alerts.apply'), onPress: doApply }],
      );
    } else {
      doApply();
    }
  }

  function openIntervalSpeedPicker(key: string, isMiles: boolean) {
    const iv = intervals.find(i => i._key === key);
    if (!iv) return;
    const kmh = iv.speed ?? speedForPhase(iv.type, runSpeeds);
    const displayVal = toDisplay(kmh, isMiles ? 'miles' : 'km');
    pickerState.openIntervalSpeedPicker(key, displayVal, isMiles);
  }

  function clearIntervalSpeed(key: string) {
    setIntervals(ivs =>
      ivs.map(iv => iv._key === key ? { ...iv, speed: undefined } : iv)
    );
  }

  function setActivityLabel(key: string, label: string) {
    setIntervals(ivs => ivs.map(iv =>
      iv._key === key ? { ...iv, activityLabel: label } : iv
    ));
  }

  function buildSavePayload(): SavePayload {
    if (mode === 'circuit') {
      if (!name.trim()) {
        return { ok: false, titleKey: 'alerts.nameRequiredTitle', messageKey: 'alerts.nameRequiredMessage' };
      }
      const hasWork = intervals.some(iv => iv.type === 'work');
      if (!hasWork) {
        return { ok: false, titleKey: 'alerts.noWorkIntervalsTitle', messageKey: 'alerts.noWorkIntervalsMessage' };
      }
      const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
      const session: Session = {
        id: existing?.id ?? newId(),
        name: name.trim(),
        mode: 'circuit',
        intervals: cleanIntervals,
        circuits:    circuitEdit.circuitCount,
        warmup:      circuitEdit.circuitWarmup,
        cooldown:    circuitEdit.circuitCooldown,
        circuitRest: circuitEdit.circuitRest,
      };
      return { ok: true, session, isNew: !existing };
    }
    const validation = validateDraft(name, mode, intervals);
    if (!validation.ok) {
      return { ok: false, titleKey: validation.titleKey, messageKey: validation.messageKey };
    }
    const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
    const session = buildSessionFromDraft(
      mode, name.trim(), easyEdit.easyConfig, cleanIntervals, activityType, runSpeeds, existing?.id,
    );
    return { ok: true, session, isNew: !existing };
  }

  const hasChanges = useMemo(() => {
    const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
    if (mode === 'circuit') {
      return circuitEdit.hasChanges
        || name !== initialName
        || intervalsDraft.isDirty(cleanIntervals);
    }
    return easyEdit.hasChanges
      || name !== initialName
      || intervalsDraft.isDirty(cleanIntervals)
      || activityType !== initialActivityType
      || runSpeedsDraft.isDirty(runSpeeds);
  }, [
    mode, name, intervals, activityType, runSpeeds,
    easyEdit.hasChanges, circuitEdit.hasChanges,
    initialName, initialActivityType,
  ]);

  const activeTimingPreset: PresetLevel | null = mode === 'advanced'
    ? findMatchingDurationPresetForIntervals(intervals.map(({ _key, ...iv }) => iv))
    : easyEdit.activeTimingPreset;

  const draft: EditSessionDraft = {
    name,
    isAdvanced:  mode === 'advanced',
    isCircuit:   mode === 'circuit',
    fieldValues: easyEdit.fieldValues,
    rounds:      easyEdit.rounds,
    intervals,
    previewSegments,
    previewTotal: totalDuration(previewSegments),
    activityType,
    runSpeeds,
    activeTimingPreset,
    activeSpeedPreset,
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
    setActivityType,
    setDisplayActivityType,
    setRunSpeed,
    toggleMode,
    cyclePhase,
    addInterval,
    duplicateInterval,
    removeInterval,
    clearIntervals:   () => { setTimingDirty(true); setIntervals([]); },
    reorderIntervals: (data: LocalInterval[]) => { setTimingDirty(true); setIntervals(data); },
    openFieldPicker:  pickerState.openFieldPicker,
    openRoundsPicker: () => pickerState.openRoundsPicker(easyEdit.rounds),
    openIntervalPicker: pickerState.openIntervalPicker,
    openSpeedPicker:    pickerState.openSpeedPicker,
    openIntervalSpeedPicker,
    clearIntervalSpeed,
    commitPicker:    pickerState.commitPicker,
    dismissPicker:   pickerState.dismissPicker,
    applyDurationPreset,
    applySpeedPreset,
    setActivityLabel,
    openCircuitWarmupPicker:   pickerState.openCircuitWarmupPicker,
    openCircuitCooldownPicker: pickerState.openCircuitCooldownPicker,
    openCircuitRestPicker:     pickerState.openCircuitRestPicker,
    openCircuitsPicker:        pickerState.openCircuitCountPicker,
    buildSavePayload,
  };
}
