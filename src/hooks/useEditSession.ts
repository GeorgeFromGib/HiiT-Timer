import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { loadSessions, saveSessions, newId, type Session, type Difficulty } from '../lib/sessions';
import { confirmDeleteSession } from '../lib/alerts';
import {
  expandWorkout, intervalsToSegments, totalDuration, tryConvertToEasy, buildIntervalsFromEasy,
  type Interval, type Phase, type Segment,
} from '../lib/workout';

export type LocalInterval = Interval & { _key: string };
export const toLocal = (iv: Interval): LocalInterval =>
  ({ ...iv, _key: Math.random().toString(36).slice(2) });

export type TimeField = 'warmup' | 'work' | 'rest' | 'cooldown';

type ActivePicker =
  | { type: 'field'; field: TimeField }
  | { type: 'interval'; key: string }
  | { type: 'rounds' };

type CommitResult =
  | { type: 'field';    field: TimeField; secs: number }
  | { type: 'interval'; key: string;      secs: number }
  | { type: 'rounds';   value: number };

const PHASES: Phase[] = ['warmup', 'work', 'rest', 'cooldown'];

// All state the screen needs to render — no setters.
export interface EditSessionDraft {
  name:            string;
  difficulty:      Difficulty;
  isAdvanced:      boolean;
  fieldValues:     Record<TimeField, number>;
  rounds:          number;
  intervals:       LocalInterval[];
  previewSegments: Segment[];
  previewTotal:    number;
}

// Picker modal state: null when closed.
export interface EditSessionPicker {
  title:    string;
  isRounds: boolean;
  minutes:  number;
  seconds:  number;
  rounds:   number;
}

export interface EditSessionInterface {
  draft:   EditSessionDraft;
  picker:  EditSessionPicker | null;
  // Field edits
  setName:          (name: string) => void;
  setDifficulty:    (d: Difficulty) => void;
  // Mode
  toggleMode:       (advanced: boolean) => void;
  // Interval list
  cyclePhase:       (key: string) => void;
  addInterval:      () => void;
  removeInterval:   (key: string) => void;
  clearIntervals:   () => void;
  reorderIntervals: (data: LocalInterval[]) => void;
  // Picker
  openFieldPicker:    (field: TimeField) => void;
  openRoundsPicker:   () => void;
  openIntervalPicker: (key: string) => void;
  updatePicker:       (partial: { minutes?: number; seconds?: number; rounds?: number }) => void;
  commitPicker:       () => void;
  dismissPicker:      () => void;
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

  const pickerTitle = (() => {
    if (!activePicker) return '';
    if (activePicker.type === 'rounds') return 'Rounds';
    if (activePicker.type === 'field')
      return activePicker.field.charAt(0).toUpperCase() + activePicker.field.slice(1);
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

  function commitPicker() {
    if (!activePicker) return;
    if (activePicker.type === 'rounds') {
      onCommit({ type: 'rounds', value: pickerRounds + 1 });
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
    title:    pickerTitle,
    isRounds: activePicker.type === 'rounds',
    minutes:  pickerMinutes,
    seconds:  pickerSeconds,
    rounds:   pickerRounds,
  } : null;

  return {
    picker,
    openFieldPicker,
    openRoundsPicker,
    openIntervalPicker,
    updatePicker: (partial: { minutes?: number; seconds?: number; rounds?: number }) => {
      if (partial.minutes !== undefined) setPickerMinutes(partial.minutes);
      if (partial.seconds !== undefined) setPickerSeconds(partial.seconds);
      if (partial.rounds  !== undefined) setPickerRounds(partial.rounds);
    },
    commitPicker,
    dismissPicker: () => setActivePicker(null),
  };
}

export function useEditSession(
  existing: Session | undefined,
  onBack: () => void,
): EditSessionInterface {
  const [name,       setName]       = useState(existing?.name       ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(existing?.difficulty ?? 'Medium');
  const [mode,       setMode]       = useState<'easy' | 'advanced'>(existing?.mode ?? 'easy');

  const [warmup,   setWarmup]   = useState(existing?.mode === 'easy' ? existing.config.warmup   : 30);
  const [work,     setWork]     = useState(existing?.mode === 'easy' ? existing.config.high     : 30);
  const [rest,     setRest]     = useState(existing?.mode === 'easy' ? existing.config.low      : 15);
  const [rounds,   setRounds]   = useState(existing?.mode === 'easy' ? existing.config.rounds   : 4);
  const [cooldown, setCooldown] = useState(existing?.mode === 'easy' ? existing.config.cooldown : 30);

  const [intervals, setIntervals] = useState<LocalInterval[]>(
    existing?.mode === 'advanced' ? existing.intervals.map(toLocal) : []
  );

  const easyConfig = {
    warmup,
    high:    Math.max(1, work),
    low:     rest,
    rounds:  Math.max(1, rounds),
    cooldown,
  };

  const previewSegments = useMemo(
    () => mode === 'easy' ? expandWorkout(easyConfig) : intervalsToSegments(intervals),
    [mode, warmup, work, rest, rounds, cooldown, intervals],
  );

  const fieldValues: Record<TimeField, number> = { warmup, work, rest, cooldown };
  const fieldSetters: Record<TimeField, (v: number) => void> = {
    warmup: setWarmup, work: setWork, rest: setRest, cooldown: setCooldown,
  };

  const {
    picker,
    openFieldPicker,
    openRoundsPicker: openRoundsPickerInner,
    openIntervalPicker,
    updatePicker,
    commitPicker,
    dismissPicker,
  } = usePickerState(intervals, fieldValues, (result) => {
    if (result.type === 'rounds') {
      setRounds(result.value);
    } else if (result.type === 'field') {
      fieldSetters[result.field](result.secs);
    } else {
      setIntervals(ivs =>
        ivs.map(iv => iv._key === result.key ? { ...iv, dur: result.secs } : iv)
      );
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
    setIntervals(ivs => ivs.map(iv =>
      iv._key === key
        ? { ...iv, type: PHASES[(PHASES.indexOf(iv.type) + 1) % PHASES.length] }
        : iv
    ));
  }

  function addInterval() {
    setIntervals(ivs => [...ivs, toLocal({ type: 'work', dur: 30 })]);
  }

  function removeInterval(key: string) {
    setIntervals(ivs => ivs.filter(iv => iv._key !== key));
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
    const base = { id: existing?.id ?? newId(), name: name.trim(), difficulty };
    const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
    const updated: Session = mode === 'easy'
      ? { ...base, mode: 'easy', config: easyConfig }
      : { ...base, mode: 'advanced', intervals: cleanIntervals };
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
      const sessions = await loadSessions();
      await saveSessions(sessions.filter(s => s.id !== existing.id));
      onBack();
    });
  }

  const draft: EditSessionDraft = {
    name, difficulty,
    isAdvanced: mode === 'advanced',
    fieldValues,
    rounds,
    intervals,
    previewSegments,
    previewTotal: totalDuration(previewSegments),
  };

  return {
    draft,
    picker,
    setName, setDifficulty,
    toggleMode,
    cyclePhase, addInterval, removeInterval,
    clearIntervals: () => setIntervals([]),
    reorderIntervals: setIntervals,
    openFieldPicker,
    openRoundsPicker: () => openRoundsPickerInner(rounds),
    openIntervalPicker,
    updatePicker,
    commitPicker,
    dismissPicker,
    save,
    deleteSession,
  };
}
