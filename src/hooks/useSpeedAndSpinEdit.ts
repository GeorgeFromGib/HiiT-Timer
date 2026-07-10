import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useDraft } from './useDraft';
import { i18n } from '../lib/i18n';
import {
  type Session, type RunSpeeds, type SpinValues,
  DEFAULT_RUN_SPEEDS, DEFAULT_SPIN_VALUES,
} from '../lib/sessions';
import {
  type PresetLevel, SPEED_PRESETS, SPIN_PRESETS,
  findMatchingSpeedPreset, findMatchingSpinPreset,
} from '../lib/presets';

export interface SpeedAndSpinEdit {
  runSpeeds:         RunSpeeds;
  spinValues:        SpinValues;
  activeSpeedPreset: PresetLevel | null;
  activeSpinPreset:  PresetLevel | null;
  hasChanges:        boolean;
  setRunSpeed:      (field: keyof RunSpeeds, value: number) => void;
  setSpinValue:     (field: keyof SpinValues, value: number) => void;
  applySpeedPreset: (level: PresetLevel) => void;
  applySpinPreset:  (level: PresetLevel) => void;
}

export function useSpeedAndSpinEdit(existing: Session | undefined): SpeedAndSpinEdit {
  const initRunSpeeds = existing && existing.mode !== 'circuit'
    ? (existing.runSpeeds ?? DEFAULT_RUN_SPEEDS) : DEFAULT_RUN_SPEEDS;
  const initSpinValues = existing && existing.mode !== 'circuit' && existing.activityType === 'spinning'
    ? (existing.spinValues ?? DEFAULT_SPIN_VALUES) : DEFAULT_SPIN_VALUES;

  const [runSpeeds, setRunSpeeds]   = useState<RunSpeeds>(initRunSpeeds);
  const [spinValues, setSpinValues] = useState<SpinValues>(initSpinValues);
  const [speedsDirty, setSpeedsDirty] = useState(false);
  const [spinDirty,   setSpinDirty]   = useState(false);
  const [activeSpeedPreset, setActiveSpeedPreset] = useState<PresetLevel | null>(() =>
    existing && existing.mode !== 'circuit' && existing.runSpeeds
      ? findMatchingSpeedPreset(existing.runSpeeds) : null
  );
  const [activeSpinPreset, setActiveSpinPreset] = useState<PresetLevel | null>(() =>
    existing && existing.mode !== 'circuit' && existing.activityType === 'spinning' && existing.spinValues
      ? findMatchingSpinPreset(existing.spinValues) : null
  );

  const runSpeedsDraft  = useDraft(initRunSpeeds);
  const spinValuesDraft = useDraft(initSpinValues);

  const hasChanges = useMemo(
    () => runSpeedsDraft.isDirty(runSpeeds) || spinValuesDraft.isDirty(spinValues),
    [runSpeeds, spinValues],
  );

  function setRunSpeed(field: keyof RunSpeeds, value: number) {
    setRunSpeeds(prev => ({ ...prev, [field]: value }));
    setSpeedsDirty(true);
    setActiveSpeedPreset(null);
  }

  function setSpinValue(field: keyof SpinValues, value: number) {
    setSpinValues(prev => ({ ...prev, [field]: value }));
    setSpinDirty(true);
    setActiveSpinPreset(null);
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

  function applySpinPreset(level: PresetLevel) {
    const doApply = () => {
      setSpinValues(SPIN_PRESETS[level]);
      setSpinDirty(false);
      setActiveSpinPreset(level);
    };
    if (spinDirty) {
      Alert.alert(
        i18n.t('alerts.overwriteTitle'),
        i18n.t('alerts.overwriteSpinMessage'),
        [{ text: i18n.t('alerts.cancel'), style: 'cancel' }, { text: i18n.t('alerts.apply'), onPress: doApply }],
      );
    } else {
      doApply();
    }
  }

  return {
    runSpeeds, spinValues, activeSpeedPreset, activeSpinPreset, hasChanges,
    setRunSpeed, setSpinValue, applySpeedPreset, applySpinPreset,
  };
}
