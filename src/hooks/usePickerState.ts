import { useState } from 'react';
import { i18n } from '../lib/i18n';
import { type RunSpeeds } from '../lib/sessions';
import { convertMphToKmh } from '../lib/workout';
import { type LocalInterval, type TimeField } from './editSessionTypes';

export type ActivePicker =
  | { type: 'field'; field: TimeField }
  | { type: 'interval'; key: string }
  | { type: 'rounds' }
  | { type: 'speed'; field: keyof RunSpeeds; isMiles: boolean }
  | { type: 'intervalSpeed'; key: string; isMiles: boolean }
  | { type: 'circuitWarmup' }
  | { type: 'circuitCooldown' }
  | { type: 'circuitRest' }
  | { type: 'circuitCount' };

export type CommitResult =
  | { type: 'field';           field: TimeField;       secs: number }
  | { type: 'interval';        key: string;            secs: number }
  | { type: 'rounds';          value: number }
  | { type: 'speed';           field: keyof RunSpeeds; kmh: number }
  | { type: 'intervalSpeed';   key: string;            kmh: number }
  | { type: 'circuitWarmup';   secs: number }
  | { type: 'circuitCooldown'; secs: number }
  | { type: 'circuitRest';     secs: number }
  | { type: 'circuitCount';    value: number };

export interface EditSessionPicker {
  title:        string;
  isRounds:     boolean;
  roundsLabel?: string;
  isSpeed:      boolean;
  speedUnit:    'km' | 'miles';
  minutes:      number;
  seconds:      number;
  rounds:       number;
  speedWhole:   number;
  speedDecimal: number;
}

export interface PickerValues {
  minutes:      number;
  seconds:      number;
  rounds:       number;
  speedWhole:   number;
  speedDecimal: number;
}

export function usePickerState(
  intervals:     LocalInterval[],
  fieldValues:   Record<TimeField, number>,
  circuitValues: { warmup: number; cooldown: number; rest: number; count: number },
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
    if (activePicker.type === 'circuitRest') return i18n.t('edit.circuitRest');
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

  function openCircuitRestPicker() {
    setPickerMinutes(Math.floor(circuitValues.rest / 60));
    setPickerSeconds(circuitValues.rest % 60);
    setActivePicker({ type: 'circuitRest' });
  }

  function openCircuitCountPicker() {
    setPickerRounds(circuitValues.count - 1);
    setActivePicker({ type: 'circuitCount' });
  }

  function commitPicker(values: PickerValues) {
    if (!activePicker) return;
    if (activePicker.type === 'rounds') {
      onCommit({ type: 'rounds', value: values.rounds + 1 });
    } else if (activePicker.type === 'speed') {
      const displayVal = values.speedWhole + values.speedDecimal / 10;
      const kmh = activePicker.isMiles ? convertMphToKmh(displayVal) : displayVal;
      onCommit({ type: 'speed', field: activePicker.field, kmh });
    } else if (activePicker.type === 'intervalSpeed') {
      const displayVal = values.speedWhole + values.speedDecimal / 10;
      const kmh = activePicker.isMiles ? convertMphToKmh(displayVal) : displayVal;
      onCommit({ type: 'intervalSpeed', key: activePicker.key, kmh });
    } else if (activePicker.type === 'circuitCount') {
      onCommit({ type: 'circuitCount', value: values.rounds + 1 });
    } else if (activePicker.type === 'circuitWarmup') {
      onCommit({ type: 'circuitWarmup', secs: values.minutes * 60 + values.seconds });
    } else if (activePicker.type === 'circuitCooldown') {
      onCommit({ type: 'circuitCooldown', secs: values.minutes * 60 + values.seconds });
    } else if (activePicker.type === 'circuitRest') {
      onCommit({ type: 'circuitRest', secs: values.minutes * 60 + values.seconds });
    } else {
      const secs = values.minutes * 60 + values.seconds;
      if (activePicker.type === 'field') {
        onCommit({ type: 'field', field: activePicker.field, secs });
      } else {
        onCommit({ type: 'interval', key: activePicker.key, secs });
      }
    }
    setActivePicker(null);
  }

  const picker: EditSessionPicker | null = activePicker ? {
    title:       pickerTitle,
    isRounds:    activePicker.type === 'rounds' || activePicker.type === 'circuitCount',
    roundsLabel: activePicker.type === 'circuitCount' ? i18n.t('picker.circuitsTitle')
               : activePicker.type === 'rounds'       ? i18n.t('picker.rounds')
               : undefined,
    isSpeed:     activePicker.type === 'speed' || activePicker.type === 'intervalSpeed',
    speedUnit:   (activePicker.type === 'speed' || activePicker.type === 'intervalSpeed') && activePicker.isMiles ? 'miles' : 'km',
    minutes:     pickerMinutes,
    seconds:     pickerSeconds,
    rounds:      pickerRounds,
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
    openCircuitRestPicker,
    openCircuitCountPicker,
    commitPicker,
    dismissPicker: () => setActivePicker(null),
  };
}
