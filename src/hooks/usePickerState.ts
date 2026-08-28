import { useState } from 'react';
import { i18n } from '../lib/i18n';
import { type RunSpeeds, type RunInclines, type SpinValues } from '../lib/sessions';
import { TABATA_WARMUP_COOLDOWN_STEPS } from '../lib/workout';
import { fromDisplay, pickerRange } from '../lib/speedUnit';
import { type LocalInterval, type TimeField } from './editSessionTypes';

export const MIN_TARGET_DURATION_MINUTES = 10;
const TARGET_DURATION_LABEL_COUNT = 171;
export const MAX_TARGET_DURATION_MINUTES = MIN_TARGET_DURATION_MINUTES + TARGET_DURATION_LABEL_COUNT - 1;

export interface PickerColumn {
  values:    string[];
  unitLabel: string;
}

// ── Shared wheel value arrays ────────────────────────────────────────────────
const MINUTE_LABELS          = Array.from({ length: 60 }, (_, i) => String(i));
const SECOND_LABELS          = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const ROUND_LABELS           = Array.from({ length: 99 }, (_, i) => String(i + 1));
const RESISTANCE_LABELS      = Array.from({ length: 10 }, (_, i) => String(i + 1));
const INCLINE_LABELS         = Array.from({ length: 31 }, (_, i) => String(i / 2)); // 0–15% in 0.5 steps
const POWER_LABELS           = Array.from({ length: 27 }, (_, i) => String(40 + i * 10));
const TARGET_DURATION_LABELS = Array.from({ length: TARGET_DURATION_LABEL_COUNT }, (_, i) => String(i + MIN_TARGET_DURATION_MINUTES));
const DECIMAL_LABELS         = Array.from({ length: 10 }, (_, i) => String(i));
const KMH_WHOLE              = Array.from({ length: pickerRange('km').max + 1 }, (_, i) => String(i));
const MPH_WHOLE              = Array.from({ length: pickerRange('miles').max + 1 }, (_, i) => String(i));

// ── Shared shape encode/decode — wheel index[] <-> real value ───────────────
// Every picker "kind" below picks one of these shapes instead of repeating the
// arithmetic; adding a kind means picking a shape, not re-deriving it.
const durationColumns = (): PickerColumn[] => [
  { values: MINUTE_LABELS, unitLabel: i18n.t('picker.min') },
  { values: SECOND_LABELS, unitLabel: i18n.t('picker.sec') },
];
const encodeDuration = (secs: number): number[] => [Math.floor(secs / 60), secs % 60];
const decodeDuration = (idx: number[]): number => idx[0] * 60 + idx[1];

const countColumns = (unitLabel: string): PickerColumn[] => [{ values: ROUND_LABELS, unitLabel }];
const encodeCount = (current: number): number[] => [current - 1];
const decodeCount = (idx: number[]): number => idx[0] + 1;

const minutesOnlyColumns = (): PickerColumn[] => [{ values: TARGET_DURATION_LABELS, unitLabel: i18n.t('picker.min') }];
const encodeMinutesOnly = (minutes: number): number[] => [minutes - MIN_TARGET_DURATION_MINUTES];
const decodeMinutesOnly = (idx: number[]): number => idx[0] + MIN_TARGET_DURATION_MINUTES;

// Tabata warmup/cooldown: a minutes-only wheel restricted to the 3/4/5-min steps.
const TABATA_MINUTE_LABELS = TABATA_WARMUP_COOLDOWN_STEPS.map(s => String(s / 60));
const tabataMinutesColumns = (): PickerColumn[] => [{ values: TABATA_MINUTE_LABELS, unitLabel: i18n.t('picker.min') }];
const encodeTabataMinutes = (secs: number): number[] => {
  const i = TABATA_WARMUP_COOLDOWN_STEPS.indexOf(secs);
  return [i < 0 ? TABATA_WARMUP_COOLDOWN_STEPS.length - 1 : i];
};
const decodeTabataMinutes = (idx: number[]): number =>
  TABATA_WARMUP_COOLDOWN_STEPS[idx[0]] ?? TABATA_WARMUP_COOLDOWN_STEPS[TABATA_WARMUP_COOLDOWN_STEPS.length - 1];

const resistanceColumns = (): PickerColumn[] => [{ values: RESISTANCE_LABELS, unitLabel: i18n.t('picker.resistanceTitle') }];
const encodeResistance = (current: number): number[] => [current - 1];
const decodeResistance = (idx: number[]): number => idx[0] + 1;

const powerColumns = (): PickerColumn[] => [{ values: POWER_LABELS, unitLabel: 'W' }];
const encodePower = (current: number): number[] => [(current - 40) / 10];
const decodePower = (idx: number[]): number => 40 + idx[0] * 10;

const inclineColumns = (): PickerColumn[] => [{ values: INCLINE_LABELS, unitLabel: '%' }];
const encodeIncline = (current: number): number[] => [Math.round(current * 2)];
const decodeIncline = (idx: number[]): number => idx[0] / 2;

const speedColumns = (isMiles: boolean): PickerColumn[] => [
  { values: isMiles ? MPH_WHOLE : KMH_WHOLE, unitLabel: isMiles ? 'mph' : 'km/h' },
  { values: DECIMAL_LABELS, unitLabel: i18n.t('picker.dec') },
];
const encodeSpeedDisplay = (displayValue: number): number[] => {
  const whole = Math.floor(displayValue);
  const decimal = Math.min(9, Math.round((displayValue - whole) * 10));
  return [whole, decimal];
};
const decodeSpeedDisplay = (idx: number[]): number => idx[0] + idx[1] / 10;

export type ActivePicker =
  | { type: 'field'; field: TimeField }
  | { type: 'interval'; key: string }
  | { type: 'rounds' }
  | { type: 'targetDuration' }
  | { type: 'speed'; field: keyof RunSpeeds; isMiles: boolean }
  | { type: 'intervalSpeed'; key: string; isMiles: boolean }
  | { type: 'circuitWarmup' }
  | { type: 'circuitCooldown' }
  | { type: 'circuitRest' }
  | { type: 'circuitCount' }
  | { type: 'tabataWarmup' }
  | { type: 'tabataCooldown' }
  | { type: 'spinResistance';    field: keyof SpinValues }
  | { type: 'spinPower';         field: keyof SpinValues }
  | { type: 'intervalResistance'; key: string }
  | { type: 'intervalPower';      key: string }
  | { type: 'incline';           field: keyof RunInclines }
  | { type: 'intervalIncline';   key: string };

export type CommitResult =
  | { type: 'field';           field: TimeField;       secs: number }
  | { type: 'interval';        key: string;            secs: number }
  | { type: 'rounds';          value: number }
  | { type: 'targetDuration';  minutes: number }
  | { type: 'speed';           field: keyof RunSpeeds; kmh: number }
  | { type: 'intervalSpeed';   key: string;            kmh: number }
  | { type: 'circuitWarmup';   secs: number }
  | { type: 'circuitCooldown'; secs: number }
  | { type: 'circuitRest';     secs: number }
  | { type: 'circuitCount';    value: number }
  | { type: 'tabataWarmup';    secs: number }
  | { type: 'tabataCooldown';  secs: number }
  | { type: 'spinResistance';    field: keyof SpinValues; value: number }
  | { type: 'spinPower';         field: keyof SpinValues; value: number }
  | { type: 'intervalResistance'; key: string;            value: number }
  | { type: 'intervalPower';      key: string;            value: number }
  | { type: 'incline';           field: keyof RunInclines; value: number }
  | { type: 'intervalIncline';   key: string;               value: number };

export interface EditSessionPicker {
  title:      string;
  columns:    PickerColumn[];
  separator?: string;
  selected:   number[]; // current wheel index per column, used to seed the modal
}

export interface PickerValues {
  selected: number[];
}

const HAS_SEPARATOR: Partial<Record<ActivePicker['type'], string>> = {
  field: ':', interval: ':', circuitWarmup: ':', circuitCooldown: ':', circuitRest: ':',
  speed: '.', intervalSpeed: '.',
};

export function usePickerState(
  intervals:     LocalInterval[],
  fieldValues:   Record<TimeField, number>,
  circuitValues: { warmup: number; cooldown: number; rest: number; count: number },
  onCommit:      (result: CommitResult) => void,
) {
  const [activePicker, setActivePicker] = useState<ActivePicker | null>(null);
  const [selected,      setSelected]    = useState<number[]>([]);

  const pickerTitle = (() => {
    if (!activePicker) return '';
    if (activePicker.type === 'circuitCount') return i18n.t('picker.circuitsTitle');
    if (activePicker.type === 'circuitWarmup' || activePicker.type === 'tabataWarmup') return i18n.t('phases.warmup');
    if (activePicker.type === 'circuitCooldown' || activePicker.type === 'tabataCooldown') return i18n.t('phases.cooldown');
    if (activePicker.type === 'circuitRest') return i18n.t('edit.circuitRest');
    if (activePicker.type === 'rounds') return i18n.t('picker.roundsTitle');
    if (activePicker.type === 'targetDuration') return i18n.t('picker.sessionLengthTitle');
    if (activePicker.type === 'field') return i18n.t('phases.' + activePicker.field);
    if (activePicker.type === 'speed') {
      const phase = activePicker.field.replace('Speed', '');
      return i18n.t('picker.speedSuffix', { phase: i18n.t('phases.' + phase) });
    }
    if (activePicker.type === 'intervalSpeed') {
      const idx = intervals.findIndex(iv => iv._key === activePicker.key);
      return i18n.t('picker.intervalSpeedTitle', { n: idx + 1 });
    }
    if (activePicker.type === 'spinResistance' || activePicker.type === 'intervalResistance') return i18n.t('picker.resistanceTitle');
    if (activePicker.type === 'spinPower'      || activePicker.type === 'intervalPower')      return i18n.t('picker.powerTitle');
    if (activePicker.type === 'incline'        || activePicker.type === 'intervalIncline')    return i18n.t('picker.inclineTitle');
    const idx = intervals.findIndex(iv => iv._key === activePicker.key);
    return i18n.t('picker.intervalTitle', { n: idx + 1 });
  })();

  const columns: PickerColumn[] = (() => {
    if (!activePicker) return [];
    switch (activePicker.type) {
      case 'rounds':              return countColumns(i18n.t('picker.rounds'));
      case 'circuitCount':        return countColumns(i18n.t('picker.circuitsTitle'));
      case 'targetDuration':      return minutesOnlyColumns();
      case 'tabataWarmup':
      case 'tabataCooldown':      return tabataMinutesColumns();
      case 'spinResistance':
      case 'intervalResistance':  return resistanceColumns();
      case 'spinPower':
      case 'intervalPower':       return powerColumns();
      case 'incline':
      case 'intervalIncline':     return inclineColumns();
      case 'speed':
      case 'intervalSpeed':       return speedColumns(activePicker.isMiles);
      default:                    return durationColumns();
    }
  })();

  function openFieldPicker(field: TimeField) {
    setSelected(encodeDuration(fieldValues[field]));
    setActivePicker({ type: 'field', field });
  }

  function openRoundsPicker(currentRounds: number) {
    setSelected(encodeCount(currentRounds));
    setActivePicker({ type: 'rounds' });
  }

  function openTargetDurationPicker(currentMinutes: number) {
    setSelected(encodeMinutesOnly(Math.max(MIN_TARGET_DURATION_MINUTES, currentMinutes)));
    setActivePicker({ type: 'targetDuration' });
  }

  function openIntervalPicker(key: string) {
    const iv = intervals.find(i => i._key === key);
    if (!iv) return;
    setSelected(encodeDuration(iv.dur));
    setActivePicker({ type: 'interval', key });
  }

  function openSpeedPicker(field: keyof RunSpeeds, displayValue: number, isMiles: boolean) {
    setSelected(encodeSpeedDisplay(displayValue));
    setActivePicker({ type: 'speed', field, isMiles });
  }

  function openIntervalSpeedPicker(key: string, displayValue: number, isMiles: boolean) {
    setSelected(encodeSpeedDisplay(displayValue));
    setActivePicker({ type: 'intervalSpeed', key, isMiles });
  }

  function openCircuitWarmupPicker() {
    setSelected(encodeDuration(circuitValues.warmup));
    setActivePicker({ type: 'circuitWarmup' });
  }

  function openCircuitCooldownPicker() {
    setSelected(encodeDuration(circuitValues.cooldown));
    setActivePicker({ type: 'circuitCooldown' });
  }

  function openCircuitRestPicker() {
    setSelected(encodeDuration(circuitValues.rest));
    setActivePicker({ type: 'circuitRest' });
  }

  function openCircuitCountPicker() {
    setSelected(encodeCount(circuitValues.count));
    setActivePicker({ type: 'circuitCount' });
  }

  function openTabataWarmupPicker() {
    setSelected(encodeTabataMinutes(circuitValues.warmup));
    setActivePicker({ type: 'tabataWarmup' });
  }

  function openTabataCooldownPicker() {
    setSelected(encodeTabataMinutes(circuitValues.cooldown));
    setActivePicker({ type: 'tabataCooldown' });
  }

  function openSpinResistancePicker(field: keyof SpinValues, currentValue: number) {
    setSelected(encodeResistance(currentValue));
    setActivePicker({ type: 'spinResistance', field });
  }

  function openSpinPowerPicker(field: keyof SpinValues, currentValue: number) {
    setSelected(encodePower(currentValue));
    setActivePicker({ type: 'spinPower', field });
  }

  function openIntervalResistancePicker(key: string, currentValue: number) {
    setSelected(encodeResistance(currentValue));
    setActivePicker({ type: 'intervalResistance', key });
  }

  function openIntervalPowerPicker(key: string, currentValue: number) {
    setSelected(encodePower(currentValue));
    setActivePicker({ type: 'intervalPower', key });
  }

  function openInclinePicker(field: keyof RunInclines, currentValue: number) {
    setSelected(encodeIncline(currentValue));
    setActivePicker({ type: 'incline', field });
  }

  function openIntervalInclinePicker(key: string, currentValue: number) {
    setSelected(encodeIncline(currentValue));
    setActivePicker({ type: 'intervalIncline', key });
  }

  function commitPicker(values: PickerValues) {
    if (!activePicker) return;
    const idx = values.selected;
    if (activePicker.type === 'rounds') {
      onCommit({ type: 'rounds', value: decodeCount(idx) });
    } else if (activePicker.type === 'targetDuration') {
      onCommit({ type: 'targetDuration', minutes: decodeMinutesOnly(idx) });
    } else if (activePicker.type === 'speed') {
      onCommit({ type: 'speed', field: activePicker.field, kmh: fromDisplay(decodeSpeedDisplay(idx), activePicker.isMiles ? 'miles' : 'km') });
    } else if (activePicker.type === 'intervalSpeed') {
      onCommit({ type: 'intervalSpeed', key: activePicker.key, kmh: fromDisplay(decodeSpeedDisplay(idx), activePicker.isMiles ? 'miles' : 'km') });
    } else if (activePicker.type === 'circuitCount') {
      onCommit({ type: 'circuitCount', value: decodeCount(idx) });
    } else if (activePicker.type === 'spinResistance') {
      onCommit({ type: 'spinResistance', field: activePicker.field, value: decodeResistance(idx) });
    } else if (activePicker.type === 'spinPower') {
      onCommit({ type: 'spinPower', field: activePicker.field, value: decodePower(idx) });
    } else if (activePicker.type === 'intervalResistance') {
      onCommit({ type: 'intervalResistance', key: activePicker.key, value: decodeResistance(idx) });
    } else if (activePicker.type === 'intervalPower') {
      onCommit({ type: 'intervalPower', key: activePicker.key, value: decodePower(idx) });
    } else if (activePicker.type === 'incline') {
      onCommit({ type: 'incline', field: activePicker.field, value: decodeIncline(idx) });
    } else if (activePicker.type === 'intervalIncline') {
      onCommit({ type: 'intervalIncline', key: activePicker.key, value: decodeIncline(idx) });
    } else if (activePicker.type === 'circuitWarmup') {
      onCommit({ type: 'circuitWarmup', secs: decodeDuration(idx) });
    } else if (activePicker.type === 'circuitCooldown') {
      onCommit({ type: 'circuitCooldown', secs: decodeDuration(idx) });
    } else if (activePicker.type === 'circuitRest') {
      onCommit({ type: 'circuitRest', secs: decodeDuration(idx) });
    } else if (activePicker.type === 'tabataWarmup') {
      onCommit({ type: 'tabataWarmup', secs: decodeTabataMinutes(idx) });
    } else if (activePicker.type === 'tabataCooldown') {
      onCommit({ type: 'tabataCooldown', secs: decodeTabataMinutes(idx) });
    } else if (activePicker.type === 'field') {
      onCommit({ type: 'field', field: activePicker.field, secs: decodeDuration(idx) });
    } else {
      onCommit({ type: 'interval', key: activePicker.key, secs: decodeDuration(idx) });
    }
    setActivePicker(null);
  }

  const picker: EditSessionPicker | null = activePicker ? {
    title: pickerTitle,
    columns,
    separator: HAS_SEPARATOR[activePicker.type],
    selected,
  } : null;

  return {
    picker,
    openFieldPicker,
    openRoundsPicker,
    openTargetDurationPicker,
    openIntervalPicker,
    openSpeedPicker,
    openIntervalSpeedPicker,
    openCircuitWarmupPicker,
    openCircuitCooldownPicker,
    openCircuitRestPicker,
    openCircuitCountPicker,
    openTabataWarmupPicker,
    openTabataCooldownPicker,
    openSpinResistancePicker,
    openSpinPowerPicker,
    openIntervalResistancePicker,
    openIntervalPowerPicker,
    openInclinePicker,
    openIntervalInclinePicker,
    commitPicker,
    dismissPicker: () => setActivePicker(null),
  };
}
