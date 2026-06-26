import { useMemo, useRef, useState } from 'react';
import { i18n } from '../lib/i18n';
import { Alert } from 'react-native';
import { getSessionSegments, speedForPhase, type Session, type RunSpeeds, DEFAULT_RUN_SPEEDS, newId } from '../lib/sessions';
import { serializeDraft, buildSessionFromDraft, validateDraft } from '../lib/sessionDraft';
import { type PresetLevel, DURATION_PRESETS, SPEED_PRESETS, findMatchingDurationPreset, findMatchingDurationPresetForIntervals, findMatchingSpeedPreset } from '../lib/presets';
import {
  totalDuration, tryConvertToEasy, buildIntervalsFromEasy, convertKmhToMph, convertMphToKmh,
  expandCircuit,
  type Interval, type Phase, type Segment,
} from '../lib/workout';

export type LocalInterval = Interval & { _key: string };
export const toLocal = (iv: Interval): LocalInterval =>
  ({ ...iv, _key: Math.random().toString(36).slice(2) });

export type TimeField = 'warmup' | 'work' | 'rest' | 'cooldown';

type ActivePicker =
  | { type: 'field'; field: TimeField }
  | { type: 'interval'; key: string }
  | { type: 'rounds' }
  | { type: 'speed'; field: keyof RunSpeeds; isMiles: boolean }
  | { type: 'intervalSpeed'; key: string; isMiles: boolean }
  | { type: 'circuitWarmup' }
  | { type: 'circuitCooldown' }
  | { type: 'circuitCount' };

type CommitResult =
  | { type: 'field';          field: TimeField;       secs: number }
  | { type: 'interval';       key: string;            secs: number }
  | { type: 'rounds';         value: number }
  | { type: 'speed';          field: keyof RunSpeeds; kmh: number }
  | { type: 'intervalSpeed';  key: string;            kmh: number }
  | { type: 'circuitWarmup';  secs: number }
  | { type: 'circuitCooldown'; secs: number }
  | { type: 'circuitCount';   value: number };

export type SavePayload =
  | { ok: true; session: Session; isNew: boolean }
  | { ok: false; titleKey: string; messageKey: string };

const PHASES: Phase[] = ['warmup', 'work', 'rest', 'cooldown'];
const CIRCUIT_PHASES: Phase[] = ['work', 'rest'];

// All state the screen needs to render — no setters.
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
  circuitCount:        number;
}

// Picker modal state: null when closed.
export interface EditSessionPicker {
  title:        string;
  isRounds:     boolean;
  isSpeed:      boolean;
  speedUnit:    'km' | 'miles';
  minutes:      number;
  seconds:      number;
  rounds:       number;
  speedWhole:   number;
  speedDecimal: number;
}

export interface EditSessionInterface {
  draft:   EditSessionDraft;
  picker:  EditSessionPicker | null;
  // Field edits
  setName:          (name: string) => void;
  setActivityType:  (type: 'run' | undefined) => void;
  setRunSpeed:      (field: keyof RunSpeeds, value: number) => void;
  // Mode
  toggleMode:       (advanced: boolean) => void;
  // Interval list
  cyclePhase:         (key: string) => void;
  addInterval:        () => void;
  duplicateInterval:  (key: string) => void;
  removeInterval:     (key: string) => void;
  clearIntervals:     () => void;
  reorderIntervals:   (data: LocalInterval[]) => void;
  // Picker
  openFieldPicker:    (field: TimeField) => void;
  openRoundsPicker:   () => void;
  openIntervalPicker: (key: string) => void;
  openSpeedPicker:         (field: keyof RunSpeeds, displayValue: number, isMiles: boolean) => void;
  openIntervalSpeedPicker: (key: string, isMiles: boolean) => void;
  clearIntervalSpeed:      (key: string) => void;
  updatePicker:       (partial: { minutes?: number; seconds?: number; rounds?: number; speedWhole?: number; speedDecimal?: number }) => void;
  commitPicker:       () => void;
  dismissPicker:      () => void;
  // Presets
  applyDurationPreset: (level: PresetLevel) => void;
  applySpeedPreset:    (level: PresetLevel) => void;
  // Circuit
  setActivityLabel:         (key: string, label: string) => void;
  openCircuitWarmupPicker:  () => void;
  openCircuitCooldownPicker: () => void;
  openCircuitsPicker:       () => void;
  // Persistence
  buildSavePayload: () => SavePayload;
}

function usePickerState(
  intervals:     LocalInterval[],
  fieldValues:   Record<TimeField, number>,
  circuitValues: { warmup: number; cooldown: number; count: number },
  onCommit:      (result: CommitResult) => void,
) {
  const [activePicker,  setActivePicker]  = useState<ActivePicker | null>(null);
  const [pickerMinutes, setPickerMinutes] = useState(0);
  const [pickerSeconds, setPickerSeconds] = useState(0);
  const [pickerRounds,  setPickerRounds]  = useState(0);
  const [speedWhole,    setSpeedWhole]    = useState(0);
  const [speedDecimal,  setSpeedDecimal]  = useState(0);

  const pickerTitle = (() => {
    if (!activePicker) return '';
    if (activePicker.type === 'circuitCount') return i18n.t('picker.circuitsTitle');
    if (activePicker.type === 'circuitWarmup') return i18n.t('phases.warmup');
    if (activePicker.type === 'circuitCooldown') return i18n.t('phases.cooldown');
    if (activePicker.type === 'rounds') return i18n.t('picker.roundsTitle');
    if (activePicker.type === 'field') return i18n.t('phases.' + activePicker.field);
    if (activePicker.type === 'speed') {
      const phase = activePicker.field.replace('Speed', '');
      return i18n.t('picker.speedSuffix', { phase: i18n.t('phases.' + phase) });
    }
    if (activePicker.type === 'intervalSpeed') {
      const idx = intervals.findIndex(iv => iv._key === activePicker.key);
      return i18n.t('picker.intervalSpeedTitle', { n: idx + 1 });
    }
    const idx = intervals.findIndex(iv => iv._key === activePicker.key);
    return i18n.t('picker.intervalTitle', { n: idx + 1 });
  })();

  function openFieldPicker(field: TimeField) {
    const secs = fieldValues[field];
    setPickerMinutes(Math.floor(secs / 60));
    setPickerSeconds(secs % 60);
    setActivePicker({ type: 'field', field });
  }

  function openRoundsPicker(currentRounds: number) {
    setPickerRounds(currentRounds - 1);
    setActivePicker({ type: 'rounds' });
  }

  function openIntervalPicker(key: string) {
    const iv = intervals.find(i => i._key === key);
    if (!iv) return;
    setPickerMinutes(Math.floor(iv.dur / 60));
    setPickerSeconds(iv.dur % 60);
    setActivePicker({ type: 'interval', key });
  }

  function openSpeedPicker(field: keyof RunSpeeds, displayValue: number, isMiles: boolean) {
    const whole = Math.floor(displayValue);
    const decimal = Math.min(9, Math.round((displayValue - whole) * 10));
    setSpeedWhole(whole);
    setSpeedDecimal(decimal);
    setActivePicker({ type: 'speed', field, isMiles });
  }

  function openIntervalSpeedPicker(key: string, displayValue: number, isMiles: boolean) {
    const whole = Math.floor(displayValue);
    const decimal = Math.min(9, Math.round((displayValue - whole) * 10));
    setSpeedWhole(whole);
    setSpeedDecimal(decimal);
    setActivePicker({ type: 'intervalSpeed', key, isMiles });
  }

  function openCircuitWarmupPicker() {
    setPickerMinutes(Math.floor(circuitValues.warmup / 60));
    setPickerSeconds(circuitValues.warmup % 60);
    setActivePicker({ type: 'circuitWarmup' });
  }

  function openCircuitCooldownPicker() {
    setPickerMinutes(Math.floor(circuitValues.cooldown / 60));
    setPickerSeconds(circuitValues.cooldown % 60);
    setActivePicker({ type: 'circuitCooldown' });
  }

  function openCircuitCountPicker() {
    setPickerRounds(circuitValues.count - 1);
    setActivePicker({ type: 'circuitCount' });
  }

  function commitPicker() {
    if (!activePicker) return;
    if (activePicker.type === 'rounds') {
      onCommit({ type: 'rounds', value: pickerRounds + 1 });
    } else if (activePicker.type === 'speed') {
      const displayVal = speedWhole + speedDecimal / 10;
      const kmh = activePicker.isMiles ? convertMphToKmh(displayVal) : displayVal;
      onCommit({ type: 'speed', field: activePicker.field, kmh });
    } else if (activePicker.type === 'intervalSpeed') {
      const displayVal = speedWhole + speedDecimal / 10;
      const kmh = activePicker.isMiles ? convertMphToKmh(displayVal) : displayVal;
      onCommit({ type: 'intervalSpeed', key: activePicker.key, kmh });
    } else if (activePicker.type === 'circuitCount') {
      onCommit({ type: 'circuitCount', value: pickerRounds + 1 });
    } else if (activePicker.type === 'circuitWarmup') {
      onCommit({ type: 'circuitWarmup', secs: pickerMinutes * 60 + pickerSeconds });
    } else if (activePicker.type === 'circuitCooldown') {
      onCommit({ type: 'circuitCooldown', secs: pickerMinutes * 60 + pickerSeconds });
    } else {
      const secs = pickerMinutes * 60 + pickerSeconds;
      if (activePicker.type === 'field') {
        onCommit({ type: 'field', field: activePicker.field, secs });
      } else {
        onCommit({ type: 'interval', key: activePicker.key, secs });
      }
    }
    setActivePicker(null);
  }

  const picker: EditSessionPicker | null = activePicker ? {
    title:        pickerTitle,
    isRounds:     activePicker.type === 'rounds' || activePicker.type === 'circuitCount',
    isSpeed:      activePicker.type === 'speed' || activePicker.type === 'intervalSpeed',
    speedUnit:    (activePicker.type === 'speed' || activePicker.type === 'intervalSpeed') && activePicker.isMiles ? 'miles' : 'km',
    minutes:      pickerMinutes,
    seconds:      pickerSeconds,
    rounds:       pickerRounds,
    speedWhole,
    speedDecimal,
  } : null;

  return {
    picker,
    openFieldPicker,
    openRoundsPicker,
    openIntervalPicker,
    openSpeedPicker,
    openIntervalSpeedPicker,
    openCircuitWarmupPicker,
    openCircuitCooldownPicker,
    openCircuitCountPicker,
    updatePicker: (partial: { minutes?: number; seconds?: number; rounds?: number; speedWhole?: number; speedDecimal?: number }) => {
      if (partial.minutes      !== undefined) setPickerMinutes(partial.minutes);
      if (partial.seconds      !== undefined) setPickerSeconds(partial.seconds);
      if (partial.rounds       !== undefined) setPickerRounds(partial.rounds);
      if (partial.speedWhole   !== undefined) setSpeedWhole(partial.speedWhole);
      if (partial.speedDecimal !== undefined) setSpeedDecimal(partial.speedDecimal);
    },
    commitPicker,
    dismissPicker: () => setActivePicker(null),
  };
}

export function useEditSession(
  existing: Session | undefined,
  onBack: () => void,
  newMode?: 'circuit',
): EditSessionInterface {
  const [name, setName] = useState(existing?.name ?? '');
  const [mode, setMode] = useState<'easy' | 'advanced' | 'circuit'>(existing?.mode ?? newMode ?? 'easy');

  const [warmup,   setWarmup]   = useState(existing?.mode === 'easy' ? existing.config.warmup   : 30);
  const [work,     setWork]     = useState(existing?.mode === 'easy' ? existing.config.high     : 30);
  const [rest,     setRest]     = useState(existing?.mode === 'easy' ? existing.config.low      : 15);
  const [rounds,   setRounds]   = useState(existing?.mode === 'easy' ? existing.config.rounds   : 4);
  const [cooldown, setCooldown] = useState(existing?.mode === 'easy' ? existing.config.cooldown : 30);

  const [circuitWarmup,   setCircuitWarmup]   = useState(existing?.mode === 'circuit' ? existing.warmup    : 60);
  const [circuitCooldown, setCircuitCooldown] = useState(existing?.mode === 'circuit' ? existing.cooldown  : 60);
  const [circuitCount,    setCircuitCount]    = useState(existing?.mode === 'circuit' ? existing.circuits  : 3);

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

  const initialSnapshot = useRef(serializeDraft(
    existing?.name ?? '',
    existing?.mode === 'circuit' ? 'easy' : (existing?.mode ?? 'easy'),
    existing?.mode === 'easy' ? existing.config.warmup   : 30,
    existing?.mode === 'easy' ? existing.config.high     : 30,
    existing?.mode === 'easy' ? existing.config.low      : 15,
    existing?.mode === 'easy' ? existing.config.cooldown : 30,
    existing?.mode === 'easy' ? existing.config.rounds   : 4,
    existing?.mode === 'advanced' ? existing.intervals   : [],
    existing && existing.mode !== 'circuit' ? existing.activityType : undefined,
    existing && existing.mode !== 'circuit' ? (existing.runSpeeds ?? DEFAULT_RUN_SPEEDS) : DEFAULT_RUN_SPEEDS,
  )).current;

  const initialCircuitSnapshot = useRef(
    existing?.mode === 'circuit'
      ? JSON.stringify({ name: existing.name, warmup: existing.warmup, cooldown: existing.cooldown, circuits: existing.circuits, intervals: existing.intervals })
      : JSON.stringify({ name: '', warmup: 60, cooldown: 60, circuits: 3, intervals: [] })
  ).current;

  const [activeTimingPreset, setActiveTimingPreset] = useState<PresetLevel | null>(() => {
    if (!existing) return null;
    if (existing.mode === 'easy') {
      return findMatchingDurationPreset(
        existing.config.warmup, existing.config.high, existing.config.low,
        existing.config.rounds, existing.config.cooldown,
      );
    }
    return findMatchingDurationPresetForIntervals(existing.intervals);
  });
  const [activeSpeedPreset, setActiveSpeedPreset] = useState<PresetLevel | null>(() =>
    existing && existing.mode !== 'circuit' && existing.runSpeeds ? findMatchingSpeedPreset(existing.runSpeeds) : null
  );

  function setRunSpeed(field: keyof RunSpeeds, value: number) {
    setRunSpeeds(prev => ({ ...prev, [field]: value }));
    setSpeedsDirty(true);
    setActiveSpeedPreset(null);
  }

  const easyConfig = {
    warmup,
    high:    Math.max(1, work),
    low:     rest,
    rounds:  Math.max(1, rounds),
    cooldown,
  };

  const previewSegments = useMemo(() => {
    const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
    if (mode === 'circuit') {
      return expandCircuit(cleanIntervals, circuitCount, circuitWarmup, circuitCooldown);
    }
    const draft: Session = mode === 'easy'
      ? { id: '', name: '', mode: 'easy', config: easyConfig, activityType, runSpeeds }
      : { id: '', name: '', mode: 'advanced', intervals: cleanIntervals, activityType, runSpeeds };
    return getSessionSegments(draft);
  }, [mode, warmup, work, rest, rounds, cooldown, intervals, activityType, runSpeeds, circuitWarmup, circuitCooldown, circuitCount]);

  const fieldValues: Record<TimeField, number> = { warmup, work, rest, cooldown };
  const fieldSetters: Record<TimeField, (v: number) => void> = {
    warmup: setWarmup, work: setWork, rest: setRest, cooldown: setCooldown,
  };

  const {
    picker,
    openFieldPicker,
    openRoundsPicker: openRoundsPickerInner,
    openIntervalPicker,
    openSpeedPicker,
    openIntervalSpeedPicker: openIntervalSpeedPickerInner,
    openCircuitWarmupPicker,
    openCircuitCooldownPicker,
    openCircuitCountPicker,
    updatePicker,
    commitPicker,
    dismissPicker,
  } = usePickerState(intervals, fieldValues, { warmup: circuitWarmup, cooldown: circuitCooldown, count: circuitCount }, (result) => {
    if (result.type === 'rounds') {
      setRounds(result.value);
      setTimingDirty(true);
      setActiveTimingPreset(null);
    } else if (result.type === 'field') {
      fieldSetters[result.field](result.secs);
      setTimingDirty(true);
      setActiveTimingPreset(null);
    } else if (result.type === 'speed') {
      setRunSpeed(result.field, result.kmh);
      setSpeedsDirty(true);
    } else if (result.type === 'intervalSpeed') {
      setIntervals(ivs =>
        ivs.map(iv => iv._key === result.key ? { ...iv, speed: result.kmh } : iv)
      );
    } else if (result.type === 'circuitWarmup') {
      setCircuitWarmup(result.secs);
      setTimingDirty(true);
    } else if (result.type === 'circuitCooldown') {
      setCircuitCooldown(result.secs);
      setTimingDirty(true);
    } else if (result.type === 'circuitCount') {
      setCircuitCount(result.value);
      setTimingDirty(true);
    } else {
      setIntervals(ivs =>
        ivs.map(iv => iv._key === result.key ? { ...iv, dur: result.secs } : iv)
      );
      setTimingDirty(true);
      setActiveTimingPreset(null);
    }
  });

  function toggleMode(advanced: boolean) {
    if (advanced) {
      if (intervals.length === 0) {
        setIntervals(buildIntervalsFromEasy(easyConfig).map(toLocal));
      }
      setMode('advanced');
    } else {
      const result = tryConvertToEasy(intervals);
      if (!result.ok) {
        Alert.alert(
          i18n.t('alerts.cannotSwitchEasyTitle'),
          i18n.t(result.reasonKey, result.reasonParams?.phase !== undefined
            ? { ...result.reasonParams, phase: i18n.t('phases.' + result.reasonParams.phase) }
            : result.reasonParams),
        );
        return;
      }
      setWarmup(result.warmup);
      setWork(result.work);
      setRest(result.rest);
      setRounds(result.rounds);
      setCooldown(result.cooldown);
      setMode('easy');
    }
  }

  function cyclePhase(key: string) {
    setTimingDirty(true);
    setActiveTimingPreset(null);
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

  function addInterval() {
    setTimingDirty(true);
    setActiveTimingPreset(null);
    setIntervals(ivs => [...ivs, toLocal({ type: 'work', dur: 30 })]);
  }

  function duplicateInterval(key: string) {
    setTimingDirty(true);
    setActiveTimingPreset(null);
    setIntervals(ivs => {
      const idx = ivs.findIndex(iv => iv._key === key);
      if (idx === -1) return ivs;
      const copy = toLocal(ivs[idx]);
      return [...ivs.slice(0, idx + 1), copy, ...ivs.slice(idx + 1)];
    });
  }

  function removeInterval(key: string) {
    setTimingDirty(true);
    setActiveTimingPreset(null);
    setIntervals(ivs => ivs.filter(iv => iv._key !== key));
  }

  function applyDurationPreset(level: PresetLevel): void {
    const doApply = () => {
      const p = DURATION_PRESETS[level];
      setWarmup(p.warmup);
      setWork(p.work);
      setRest(p.rest);
      setRounds(p.rounds);
      setCooldown(p.cooldown);
      if (mode === 'advanced') {
        setIntervals(
          buildIntervalsFromEasy({
            warmup: p.warmup, high: p.work, low: p.rest,
            rounds: p.rounds, cooldown: p.cooldown,
          }).map(toLocal)
        );
      }
      setTimingDirty(false);
      setActiveTimingPreset(level);
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

  function applySpeedPreset(level: PresetLevel): void {
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
    const displayVal = isMiles ? convertKmhToMph(kmh) : kmh;
    openIntervalSpeedPickerInner(key, displayVal, isMiles);
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
        circuits: circuitCount,
        warmup: circuitWarmup,
        cooldown: circuitCooldown,
      };
      return { ok: true, session, isNew: !existing };
    }
    const validation = validateDraft(name, mode, intervals);
    if (!validation.ok) {
      return { ok: false, titleKey: validation.titleKey, messageKey: validation.messageKey };
    }
    const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
    const session = buildSessionFromDraft(mode, name.trim(), easyConfig, cleanIntervals, activityType, runSpeeds, existing?.id);
    return { ok: true, session, isNew: !existing };
  }

  const hasChanges = useMemo(() => {
    const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
    if (mode === 'circuit') {
      const current = JSON.stringify({ name, warmup: circuitWarmup, cooldown: circuitCooldown, circuits: circuitCount, intervals: cleanIntervals });
      return current !== initialCircuitSnapshot;
    }
    const current = serializeDraft(name, mode, warmup, work, rest, cooldown, rounds, cleanIntervals, activityType, runSpeeds);
    return current !== initialSnapshot;
  }, [name, mode, warmup, work, rest, cooldown, rounds, intervals, activityType, runSpeeds, circuitWarmup, circuitCooldown, circuitCount]);

  const draft: EditSessionDraft = {
    name,
    isAdvanced: mode === 'advanced',
    isCircuit:  mode === 'circuit',
    fieldValues,
    rounds,
    intervals,
    previewSegments,
    previewTotal: totalDuration(previewSegments),
    activityType,
    runSpeeds,
    activeTimingPreset,
    activeSpeedPreset,
    hasChanges,
    circuitWarmup,
    circuitCooldown,
    circuitCount,
  };

  return {
    draft,
    picker,
    setName,
    setActivityType,
    setRunSpeed,
    toggleMode,
    cyclePhase, addInterval, duplicateInterval, removeInterval,
    clearIntervals: () => { setTimingDirty(true); setActiveTimingPreset(null); setIntervals([]); },
    reorderIntervals: (data: LocalInterval[]) => { setTimingDirty(true); setActiveTimingPreset(null); setIntervals(data); },
    openFieldPicker,
    openRoundsPicker: () => openRoundsPickerInner(rounds),
    openIntervalPicker,
    openSpeedPicker,
    openIntervalSpeedPicker,
    clearIntervalSpeed,
    updatePicker,
    commitPicker,
    dismissPicker,
    applyDurationPreset,
    applySpeedPreset,
    setActivityLabel,
    openCircuitWarmupPicker,
    openCircuitCooldownPicker,
    openCircuitsPicker: openCircuitCountPicker,
    buildSavePayload,
  };
}
