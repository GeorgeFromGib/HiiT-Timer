import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { loadSessions, saveSessions, deleteSessionById, newId, getSessionSegments, speedForPhase, type Session, type RunSpeeds, DEFAULT_RUN_SPEEDS } from '../lib/sessions';
import { type PresetLevel, DURATION_PRESETS, SPEED_PRESETS } from '../lib/presets';
import { confirmDeleteSession } from '../lib/alerts';
import {
  totalDuration, tryConvertToEasy, buildIntervalsFromEasy,
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
  | { type: 'intervalSpeed'; key: string; isMiles: boolean };

type CommitResult =
  | { type: 'field';         field: TimeField;       secs: number }
  | { type: 'interval';      key: string;            secs: number }
  | { type: 'rounds';        value: number }
  | { type: 'speed';         field: keyof RunSpeeds; kmh: number }
  | { type: 'intervalSpeed'; key: string;            kmh: number };

const PHASES: Phase[] = ['warmup', 'work', 'rest', 'cooldown'];

function findMatchingDurationPreset(warmup: number, work: number, rest: number, rounds: number, cooldown: number): PresetLevel | null {
  const levels: PresetLevel[] = ['easy', 'medium', 'hard'];
  return levels.find(level => {
    const p = DURATION_PRESETS[level];
    return p.warmup === warmup && p.work === work && p.rest === rest && p.rounds === rounds && p.cooldown === cooldown;
  }) ?? null;
}

function findMatchingSpeedPreset(speeds: RunSpeeds): PresetLevel | null {
  const levels: PresetLevel[] = ['easy', 'medium', 'hard'];
  return levels.find(level => {
    const p = SPEED_PRESETS[level];
    return p.warmupSpeed === speeds.warmupSpeed && p.workSpeed === speeds.workSpeed &&
           p.restSpeed === speeds.restSpeed && p.cooldownSpeed === speeds.cooldownSpeed;
  }) ?? null;
}

// All state the screen needs to render — no setters.
export interface EditSessionDraft {
  name:                string;
  isAdvanced:          boolean;
  fieldValues:         Record<TimeField, number>;
  rounds:              number;
  intervals:           LocalInterval[];
  previewSegments:     Segment[];
  previewTotal:        number;
  activityType:        'run' | undefined;
  runSpeeds:           RunSpeeds;
  activeTimingPreset:  PresetLevel | null;
  activeSpeedPreset:   PresetLevel | null;
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
  // Persistence
  save:          () => Promise<void>;
  deleteSession: () => void;
}

function usePickerState(
  intervals:   LocalInterval[],
  fieldValues: Record<TimeField, number>,
  onCommit:    (result: CommitResult) => void,
) {
  const [activePicker,  setActivePicker]  = useState<ActivePicker | null>(null);
  const [pickerMinutes, setPickerMinutes] = useState(0);
  const [pickerSeconds, setPickerSeconds] = useState(0);
  const [pickerRounds,  setPickerRounds]  = useState(0);
  const [speedWhole,    setSpeedWhole]    = useState(0);
  const [speedDecimal,  setSpeedDecimal]  = useState(0);

  const pickerTitle = (() => {
    if (!activePicker) return '';
    if (activePicker.type === 'rounds') return 'Rounds';
    if (activePicker.type === 'field')
      return activePicker.field.charAt(0).toUpperCase() + activePicker.field.slice(1);
    if (activePicker.type === 'speed') {
      const phase = activePicker.field.replace('Speed', '');
      return phase.charAt(0).toUpperCase() + phase.slice(1) + ' Speed';
    }
    if (activePicker.type === 'intervalSpeed') {
      const idx = intervals.findIndex(iv => iv._key === activePicker.key);
      return `Interval ${idx + 1} Speed`;
    }
    const idx = intervals.findIndex(iv => iv._key === activePicker.key);
    return `Interval ${idx + 1}`;
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

  function commitPicker() {
    if (!activePicker) return;
    if (activePicker.type === 'rounds') {
      onCommit({ type: 'rounds', value: pickerRounds + 1 });
    } else if (activePicker.type === 'speed') {
      const displayVal = speedWhole + speedDecimal / 10;
      const kmh = activePicker.isMiles ? displayVal / 0.621371 : displayVal;
      onCommit({ type: 'speed', field: activePicker.field, kmh });
    } else if (activePicker.type === 'intervalSpeed') {
      const displayVal = speedWhole + speedDecimal / 10;
      const kmh = activePicker.isMiles ? displayVal / 0.621371 : displayVal;
      onCommit({ type: 'intervalSpeed', key: activePicker.key, kmh });
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
    isRounds:     activePicker.type === 'rounds',
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
): EditSessionInterface {
  const [name, setName] = useState(existing?.name ?? '');
  const [mode, setMode] = useState<'easy' | 'advanced'>(existing?.mode ?? 'easy');

  const [warmup,   setWarmup]   = useState(existing?.mode === 'easy' ? existing.config.warmup   : 30);
  const [work,     setWork]     = useState(existing?.mode === 'easy' ? existing.config.high     : 30);
  const [rest,     setRest]     = useState(existing?.mode === 'easy' ? existing.config.low      : 15);
  const [rounds,   setRounds]   = useState(existing?.mode === 'easy' ? existing.config.rounds   : 4);
  const [cooldown, setCooldown] = useState(existing?.mode === 'easy' ? existing.config.cooldown : 30);

  const [intervals, setIntervals] = useState<LocalInterval[]>(
    existing?.mode === 'advanced' ? existing.intervals.map(toLocal) : []
  );

  const [activityType, setActivityType] = useState<'run' | undefined>(
    existing?.activityType
  );
  const [runSpeeds, setRunSpeeds] = useState<RunSpeeds>(
    existing?.runSpeeds ?? DEFAULT_RUN_SPEEDS
  );

  const [timingDirty, setTimingDirty] = useState(false);
  const [speedsDirty, setSpeedsDirty] = useState(false);

  const [activeTimingPreset, setActiveTimingPreset] = useState<PresetLevel | null>(() =>
    existing?.mode === 'easy'
      ? findMatchingDurationPreset(
          existing.config.warmup, existing.config.high, existing.config.low,
          existing.config.rounds, existing.config.cooldown,
        )
      : null
  );
  const [activeSpeedPreset, setActiveSpeedPreset] = useState<PresetLevel | null>(() =>
    existing?.runSpeeds ? findMatchingSpeedPreset(existing.runSpeeds) : null
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
    const draft: Session = mode === 'easy'
      ? { id: '', name: '', mode: 'easy', config: easyConfig, activityType, runSpeeds }
      : { id: '', name: '', mode: 'advanced', intervals: cleanIntervals, activityType, runSpeeds };
    return getSessionSegments(draft);
  }, [mode, warmup, work, rest, rounds, cooldown, intervals, activityType, runSpeeds]);

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
    updatePicker,
    commitPicker,
    dismissPicker,
  } = usePickerState(intervals, fieldValues, (result) => {
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
        Alert.alert('Cannot switch to Easy', result.reason);
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
    setIntervals(ivs => ivs.map(iv =>
      iv._key === key
        ? { ...iv, type: PHASES[(PHASES.indexOf(iv.type) + 1) % PHASES.length] }
        : iv
    ));
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
        'Overwrite settings?',
        'Applying this preset will replace your current timing settings.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Apply', onPress: doApply }],
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
        'Overwrite settings?',
        'Applying this preset will replace your current speed settings.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Apply', onPress: doApply }],
      );
    } else {
      doApply();
    }
  }

  function openIntervalSpeedPicker(key: string, isMiles: boolean) {
    const iv = intervals.find(i => i._key === key);
    if (!iv) return;
    const kmh = iv.speed ?? speedForPhase(iv.type, runSpeeds);
    const displayVal = isMiles ? kmh * 0.621371 : kmh;
    openIntervalSpeedPickerInner(key, displayVal, isMiles);
  }

  function clearIntervalSpeed(key: string) {
    setIntervals(ivs =>
      ivs.map(iv => iv._key === key ? { ...iv, speed: undefined } : iv)
    );
  }

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a session name.');
      return;
    }
    if (mode === 'advanced' && intervals.length === 0) {
      Alert.alert('No intervals', 'Add at least one interval.');
      return;
    }
    const base = { id: existing?.id ?? newId(), name: name.trim() };
    const speedProps = activityType === 'run'
      ? { activityType: 'run' as const, runSpeeds }
      : {};
    const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
    const updated: Session = mode === 'easy'
      ? { ...base, ...speedProps, mode: 'easy', config: easyConfig }
      : { ...base, ...speedProps, mode: 'advanced', intervals: cleanIntervals };
    const sessions = await loadSessions();
    const next = existing
      ? sessions.map(s => (s.id === updated.id ? updated : s))
      : [...sessions, updated];
    await saveSessions(next);
    onBack();
  };

  function deleteSession() {
    if (!existing) return;
    confirmDeleteSession(existing.name, async () => {
      await deleteSessionById(existing.id);
      onBack();
    });
  }

  const draft: EditSessionDraft = {
    name,
    isAdvanced: mode === 'advanced',
    fieldValues,
    rounds,
    intervals,
    previewSegments,
    previewTotal: totalDuration(previewSegments),
    activityType,
    runSpeeds,
    activeTimingPreset,
    activeSpeedPreset,
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
    save,
    deleteSession,
  };
}