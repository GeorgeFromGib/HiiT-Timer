import { i18n } from '../lib/i18n';
import { warnIfShortDuration } from '../lib/appAlert';
import { speedForPhase, spinValueForPhase, inclineForPhase, type RunSpeeds, type RunInclines, type SpinValues } from '../lib/sessions';
import { fromDisplay, toDisplay } from '../lib/speedUnit';
import { type LocalInterval, type TimeField } from './editSessionTypes';
import { type CircuitModeEdit } from './useCircuitModeEdit';
import { type IntervalListEdit } from './useIntervalListEdit';
import { type SpeedAndSpinEdit } from './useSpeedAndSpinEdit';
import { shapes, type PickerSpec } from './pickerShapes';

interface Deps {
  intervals:   LocalInterval[];
  fieldValues: Record<TimeField, number>;
  circuit:     CircuitModeEdit;
  speedSpin:   SpeedAndSpinEdit;
  intervalEdit: IntervalListEdit;
  // These three touch coordinator-level state (lengthIsSet, easyDirty, target length)
  // that no single mode hook owns, so the coordinator supplies what committing them does.
  onField:          (field: TimeField, secs: number) => void;
  onRounds:         (rounds: number) => void;
  onTargetDuration: (minutes: number) => void;
}

/**
 * Builds the PickerSpec for every picker the editor can open. Each spec is the one
 * place that says what the picker is called, where it starts and what committing it
 * does — add a picker by adding a builder here, not a union variant and a switch case.
 */
export function editPickers(d: Deps) {
  const unit = (isMiles: boolean) => (isMiles ? 'miles' : 'km');
  const intervalPosition = (key: string) => d.intervals.findIndex(iv => iv._key === key) + 1;
  // Per-interval pickers silently do nothing for a key that no longer exists.
  const withInterval = (key: string, build: (iv: LocalInterval) => PickerSpec): PickerSpec | null => {
    const iv = d.intervals.find(i => i._key === key);
    return iv ? build(iv) : null;
  };

  const circuitSpec = (title: string, field: 'warmup' | 'cooldown' | 'rest', current: number, warn: boolean): PickerSpec => ({
    title, shape: shapes.duration, current,
    onCommit: secs => { d.circuit.set(field, secs); if (warn) warnIfShortDuration(secs); },
  });
  // 3 min is a deliberate, allowed choice for Tabata — no short-duration warning.
  const tabataSpec = (title: string, field: 'warmup' | 'cooldown', current: number): PickerSpec => ({
    title, shape: shapes.tabataMinutes, current, onCommit: secs => d.circuit.set(field, secs),
  });

  return {
    field: (field: TimeField): PickerSpec => ({
      title: i18n.t('phases.' + field), shape: shapes.duration, current: d.fieldValues[field],
      onCommit: secs => d.onField(field, secs),
    }),
    rounds: (current: number): PickerSpec => ({
      title: i18n.t('picker.roundsTitle'), shape: shapes.count(i18n.t('picker.rounds')), current, onCommit: d.onRounds,
    }),
    targetDuration: (currentMinutes: number): PickerSpec => ({
      title: i18n.t('picker.sessionLengthTitle'), shape: shapes.targetMinutes, current: currentMinutes, onCommit: d.onTargetDuration,
    }),
    interval: (key: string) => withInterval(key, iv => ({
      title: i18n.t('picker.intervalTitle', { n: intervalPosition(key) }), shape: shapes.duration, current: iv.dur,
      onCommit: secs => d.intervalEdit.setIntervalDuration(key, secs),
    })),

    circuitWarmup:   () => circuitSpec(i18n.t('phases.warmup'), 'warmup', d.circuit.circuitWarmup, true),
    circuitCooldown: () => circuitSpec(i18n.t('phases.cooldown'), 'cooldown', d.circuit.circuitCooldown, true),
    circuitRest:     () => circuitSpec(i18n.t('edit.circuitRest'), 'rest', d.circuit.circuitRest, false),
    circuitCount: (): PickerSpec => ({
      title: i18n.t('picker.circuitsTitle'), shape: shapes.count(i18n.t('picker.circuitsTitle')), current: d.circuit.circuitCount,
      onCommit: n => d.circuit.set('count', n),
    }),
    tabataWarmup:   () => tabataSpec(i18n.t('phases.warmup'), 'warmup', d.circuit.circuitWarmup),
    tabataCooldown: () => tabataSpec(i18n.t('phases.cooldown'), 'cooldown', d.circuit.circuitCooldown),

    // `displayValue` is already in the user's unit; the commit converts back to km/h.
    speed: (field: keyof RunSpeeds, displayValue: number, isMiles: boolean): PickerSpec => ({
      title: i18n.t('picker.speedSuffix', { phase: i18n.t('phases.' + field.replace('Speed', '')) }),
      shape: shapes.speed(isMiles), current: displayValue,
      onCommit: v => d.speedSpin.setRunSpeed(field, fromDisplay(v, unit(isMiles))),
    }),
    intervalSpeed: (key: string, isMiles: boolean) => withInterval(key, iv => ({
      title: i18n.t('picker.intervalSpeedTitle', { n: intervalPosition(key) }),
      shape: shapes.speed(isMiles),
      current: toDisplay(iv.speed ?? speedForPhase(iv.type, d.speedSpin.runSpeeds), unit(isMiles)),
      onCommit: v => d.intervalEdit.setIntervalSpeed(key, fromDisplay(v, unit(isMiles))),
    })),

    spinResistance: (field: keyof SpinValues): PickerSpec => ({
      title: i18n.t('picker.resistanceTitle'), shape: shapes.resistance, current: d.speedSpin.spinValues[field],
      onCommit: v => d.speedSpin.setSpinValue(field, v),
    }),
    spinPower: (field: keyof SpinValues): PickerSpec => ({
      title: i18n.t('picker.powerTitle'), shape: shapes.power, current: d.speedSpin.spinValues[field],
      onCommit: v => d.speedSpin.setSpinValue(field, v),
    }),
    intervalResistance: (key: string) => withInterval(key, iv => ({
      title: i18n.t('picker.resistanceTitle'), shape: shapes.resistance,
      current: iv.resistance ?? spinValueForPhase(iv.type, d.speedSpin.spinValues).resistance,
      onCommit: v => d.intervalEdit.setIntervalResistance(key, v),
    })),
    intervalPower: (key: string) => withInterval(key, iv => ({
      title: i18n.t('picker.powerTitle'), shape: shapes.power,
      current: iv.power ?? spinValueForPhase(iv.type, d.speedSpin.spinValues).power,
      onCommit: v => d.intervalEdit.setIntervalPower(key, v),
    })),

    incline: (field: keyof RunInclines): PickerSpec => ({
      title: i18n.t('picker.inclineTitle'), shape: shapes.incline, current: d.speedSpin.runInclines[field],
      onCommit: v => d.speedSpin.setRunIncline(field, v),
    }),
    intervalIncline: (key: string) => withInterval(key, iv => ({
      title: i18n.t('picker.inclineTitle'), shape: shapes.incline,
      current: iv.incline ?? inclineForPhase(iv.type, d.speedSpin.runInclines),
      onCommit: v => d.intervalEdit.setIntervalIncline(key, v),
    })),
  };
}
