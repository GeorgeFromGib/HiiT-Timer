import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { loadSessions, saveSessions, newId, type Session, type Difficulty } from '../lib/sessions';
import { confirmDeleteSession } from '../lib/alerts';
import {
  expandWorkout, intervalsToSegments, totalDuration, tryConvertToEasy,
  type Interval, type Phase, type Segment,
} from '../lib/workout';

export type LocalInterval = Interval & { _key: string };
export const toLocal = (iv: Interval): LocalInterval =>
  ({ ...iv, _key: Math.random().toString(36).slice(2) });

export type TimeField = 'warmup' | 'work' | 'rest' | 'cooldown';
export type ActivePicker =
  | { type: 'field'; field: TimeField }
  | { type: 'interval'; key: string }
  | { type: 'rounds' };

const PHASES: Phase[] = ['warmup', 'work', 'rest', 'cooldown'];

export interface EditSessionState {
  name:             string;
  difficulty:       Difficulty;
  isAdvanced:       boolean;
  warmup:           number;
  work:             number;
  rest:             number;
  rounds:           number;
  cooldown:         number;
  intervals:        LocalInterval[];
  activePicker:     ActivePicker | null;
  pickerMinutes:    number;
  pickerSeconds:    number;
  pickerRounds:     number;
  previewSegments:  Segment[];
  previewTotal:     number;
  fieldValues:      Record<TimeField, number>;
  pickerTitle:      string;
}

export interface EditSessionCommands {
  setName:             (name: string) => void;
  setDifficulty:       (d: Difficulty) => void;
  handleModeToggle:    (advanced: boolean) => void;
  openFieldPicker:     (field: TimeField) => void;
  openRoundsPicker:    () => void;
  openIntervalPicker:  (key: string) => void;
  cyclePhase:          (key: string) => void;
  addInterval:         () => void;
  removeInterval:      (key: string) => void;
  setIntervals:        (data: LocalInterval[]) => void;
  setPickerMinutes:    (v: number) => void;
  setPickerSeconds:    (v: number) => void;
  setPickerRounds:     (v: number) => void;
  handlePickerDone:    () => void;
  dismissPicker:       () => void;
  handleSave:          () => Promise<void>;
  handleDelete:        () => void;
}

export function useEditSession(
  existing: Session | undefined,
  onBack: () => void,
): EditSessionState & EditSessionCommands {
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

  const [activePicker,  setActivePicker]  = useState<ActivePicker | null>(null);
  const [pickerMinutes, setPickerMinutes] = useState(0);
  const [pickerSeconds, setPickerSeconds] = useState(0);
  const [pickerRounds,  setPickerRounds]  = useState(0);

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
  const previewTotal = totalDuration(previewSegments);

  const fieldValues: Record<TimeField, number> = { warmup, work, rest, cooldown };
  const fieldSetters: Record<TimeField, (v: number) => void> = {
    warmup: setWarmup, work: setWork, rest: setRest, cooldown: setCooldown,
  };

  const isAdvanced = mode === 'advanced';

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

  function openRoundsPicker() {
    setPickerRounds(rounds - 1);
    setActivePicker({ type: 'rounds' });
  }

  function handleModeToggle(advanced: boolean) {
    if (advanced) {
      if (intervals.length === 0) {
        const built: LocalInterval[] = [];
        if (warmup > 0)   built.push(toLocal({ type: 'warmup', dur: warmup }));
        for (let i = 0; i < rounds; i++) {
          built.push(toLocal({ type: 'work', dur: Math.max(1, work) }));
          if (rest > 0)   built.push(toLocal({ type: 'rest', dur: rest }));
        }
        if (cooldown > 0) built.push(toLocal({ type: 'cooldown', dur: cooldown }));
        setIntervals(built);
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

  function openIntervalPicker(key: string) {
    const iv = intervals.find(i => i._key === key);
    if (!iv) return;
    setPickerMinutes(Math.floor(iv.dur / 60));
    setPickerSeconds(iv.dur % 60);
    setActivePicker({ type: 'interval', key });
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

  function handlePickerDone() {
    if (!activePicker) return;
    if (activePicker.type === 'rounds') {
      setRounds(pickerRounds + 1);
    } else {
      const secs = pickerMinutes * 60 + pickerSeconds;
      if (activePicker.type === 'field') {
        fieldSetters[activePicker.field](secs);
      } else {
        setIntervals(ivs =>
          ivs.map(iv => iv._key === activePicker.key ? { ...iv, dur: secs } : iv)
        );
      }
    }
    setActivePicker(null);
  }

  const handleSave = async () => {
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

  function handleDelete() {
    if (!existing) return;
    confirmDeleteSession(existing.name, async () => {
      const sessions = await loadSessions();
      await saveSessions(sessions.filter(s => s.id !== existing.id));
      onBack();
    });
  }

  return {
    name, difficulty, isAdvanced,
    warmup, work, rest, rounds, cooldown,
    intervals, setIntervals,
    activePicker, pickerMinutes, pickerSeconds, pickerRounds,
    previewSegments, previewTotal,
    fieldValues, pickerTitle,
    setName, setDifficulty,
    handleModeToggle,
    openFieldPicker, openRoundsPicker, openIntervalPicker,
    cyclePhase, addInterval, removeInterval,
    setPickerMinutes, setPickerSeconds, setPickerRounds,
    handlePickerDone, dismissPicker: () => setActivePicker(null),
    handleSave, handleDelete,
  };
}
