import { i18n } from '../lib/i18n';
import { TABATA_WARMUP_COOLDOWN_STEPS } from '../lib/workout';
import { pickerRange } from '../lib/speedUnit';

export const MIN_TARGET_DURATION_MINUTES = 10;
const TARGET_DURATION_LABEL_COUNT = 171;
export const MAX_TARGET_DURATION_MINUTES = MIN_TARGET_DURATION_MINUTES + TARGET_DURATION_LABEL_COUNT - 1;

export interface PickerColumn {
  values:    string[];
  unitLabel: string;
}

// A wheel layout plus its wheel index[] <-> real value mapping. Every picker the
// editor opens is one of these shapes; a new picker picks a shape rather than
// re-deriving the arithmetic.
export interface PickerShape {
  columns:    () => PickerColumn[];
  encode:     (value: number) => number[];
  decode:     (idx: number[]) => number;
  separator?: string;
}

/** What opening a picker needs: the shape, what it's called, where it starts, and what committing does. */
export interface PickerSpec {
  title:    string;
  shape:    PickerShape;
  current:  number;
  onCommit: (value: number) => void;
}

const range = (length: number, label: (i: number) => string) => Array.from({ length }, (_, i) => label(i));

const MINUTE_LABELS          = range(60, i => String(i));
const SECOND_LABELS          = range(60, i => String(i).padStart(2, '0'));
const ROUND_LABELS           = range(99, i => String(i + 1));
const RESISTANCE_LABELS      = range(10, i => String(i + 1));
const INCLINE_LABELS         = range(31, i => String(i / 2)); // 0–15% in 0.5 steps
const POWER_LABELS           = range(27, i => String(40 + i * 10));
const TARGET_DURATION_LABELS = range(TARGET_DURATION_LABEL_COUNT, i => String(i + MIN_TARGET_DURATION_MINUTES));
const DECIMAL_LABELS         = range(10, i => String(i));
const KMH_WHOLE              = range(pickerRange('km').max + 1, i => String(i));
const MPH_WHOLE              = range(pickerRange('miles').max + 1, i => String(i));
const TABATA_MINUTE_LABELS   = TABATA_WARMUP_COOLDOWN_STEPS.map(s => String(s / 60));

const lastTabataStep = TABATA_WARMUP_COOLDOWN_STEPS[TABATA_WARMUP_COOLDOWN_STEPS.length - 1];

export const shapes = {
  /** Seconds as minutes : seconds. */
  duration: {
    columns: () => [
      { values: MINUTE_LABELS, unitLabel: i18n.t('picker.min') },
      { values: SECOND_LABELS, unitLabel: i18n.t('picker.sec') },
    ],
    encode: (secs: number) => [Math.floor(secs / 60), secs % 60],
    decode: (idx: number[]) => idx[0] * 60 + idx[1],
    separator: ':',
  } satisfies PickerShape,

  /** A 1-based whole count (rounds, circuits). */
  count: (unitLabel: string): PickerShape => ({
    columns: () => [{ values: ROUND_LABELS, unitLabel }],
    encode: current => [current - 1],
    decode: idx => idx[0] + 1,
  }),

  /** Session length in whole minutes, floored at the minimum. */
  targetMinutes: {
    columns: () => [{ values: TARGET_DURATION_LABELS, unitLabel: i18n.t('picker.min') }],
    encode: (minutes: number) => [Math.max(MIN_TARGET_DURATION_MINUTES, minutes) - MIN_TARGET_DURATION_MINUTES],
    decode: (idx: number[]) => idx[0] + MIN_TARGET_DURATION_MINUTES,
  } satisfies PickerShape,

  /** Tabata warmup/cooldown: seconds, restricted to the 3/4/5-minute steps. */
  tabataMinutes: {
    columns: () => [{ values: TABATA_MINUTE_LABELS, unitLabel: i18n.t('picker.min') }],
    encode: (secs: number) => {
      const i = TABATA_WARMUP_COOLDOWN_STEPS.indexOf(secs);
      return [i < 0 ? TABATA_WARMUP_COOLDOWN_STEPS.length - 1 : i];
    },
    decode: (idx: number[]) => TABATA_WARMUP_COOLDOWN_STEPS[idx[0]] ?? lastTabataStep,
  } satisfies PickerShape,

  resistance: {
    columns: () => [{ values: RESISTANCE_LABELS, unitLabel: i18n.t('picker.resistanceTitle') }],
    encode: (current: number) => [current - 1],
    decode: (idx: number[]) => idx[0] + 1,
  } satisfies PickerShape,

  power: {
    columns: () => [{ values: POWER_LABELS, unitLabel: 'W' }],
    encode: (current: number) => [(current - 40) / 10],
    decode: (idx: number[]) => 40 + idx[0] * 10,
  } satisfies PickerShape,

  incline: {
    columns: () => [{ values: INCLINE_LABELS, unitLabel: '%' }],
    encode: (current: number) => [Math.round(current * 2)],
    decode: (idx: number[]) => idx[0] / 2,
  } satisfies PickerShape,

  /** Speed in the user's display unit (km/h or mph) as whole . tenths; callers convert to km/h. */
  speed: (isMiles: boolean): PickerShape => ({
    columns: () => [
      { values: isMiles ? MPH_WHOLE : KMH_WHOLE, unitLabel: isMiles ? 'mph' : 'km/h' },
      { values: DECIMAL_LABELS, unitLabel: i18n.t('picker.dec') },
    ],
    encode: display => {
      const whole = Math.floor(display);
      return [whole, Math.min(9, Math.round((display - whole) * 10))];
    },
    decode: idx => idx[0] + idx[1] / 10,
    separator: '.',
  }),
};
