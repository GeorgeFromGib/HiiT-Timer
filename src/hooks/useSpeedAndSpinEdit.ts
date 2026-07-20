import { useMemo, useState } from 'react';
import { useDraft } from './useDraft';
import { i18n } from '../lib/i18n';
import { appAlert } from '../lib/appAlert';
import {
  type Session, type RunSpeeds, type RunInclines, type SpinValues,
  DEFAULT_RUN_SPEEDS, DEFAULT_RUN_INCLINES, DEFAULT_SPIN_VALUES,
} from '../lib/sessions';
import {
  type PresetLevel, SPEED_PRESETS, WALK_SPEED_PRESETS, INCLINE_PRESETS, SPIN_PRESETS,
  findMatchingSpeedPreset, findMatchingInclinePreset, findMatchingSpinPreset,
} from '../lib/presets';

export interface SpeedAndSpinEdit {
  runSpeeds:          RunSpeeds;
  runInclines:        RunInclines;
  inclineEnabled:     boolean;
  spinValues:         SpinValues;
  activeSpeedPreset:  PresetLevel | null;
  activeInclinePreset: PresetLevel | null;
  activeSpinPreset:   PresetLevel | null;
  hasChanges:         boolean;
  setRunSpeed:        (field: keyof RunSpeeds, value: number) => void;
  setRunIncline:      (field: keyof RunInclines, value: number) => void;
  setInclineEnabled:  (enabled: boolean) => void;
  setSpinValue:       (field: keyof SpinValues, value: number) => void;
  applySpeedPreset:   (level: PresetLevel) => void;
  applyInclinePreset: (level: PresetLevel) => void;
  applySpinPreset:    (level: PresetLevel) => void;
}

export function useSpeedAndSpinEdit(
  existing: Session | undefined,
  activityType?: 'run' | 'walk' | 'spinning',
): SpeedAndSpinEdit {
  const speedPresetSource = activityType === 'walk' ? WALK_SPEED_PRESETS : SPEED_PRESETS;

  const initRunSpeeds = existing && existing.mode !== 'circuit'
    ? (existing.runSpeeds ?? DEFAULT_RUN_SPEEDS) : DEFAULT_RUN_SPEEDS;
  const initRunInclines = existing && existing.mode !== 'circuit' && existing.activityType === 'run'
    ? (existing.runInclines ?? DEFAULT_RUN_INCLINES) : DEFAULT_RUN_INCLINES;
  const initInclineEnabled = existing && existing.mode !== 'circuit' && existing.activityType === 'run'
    ? (existing.inclineEnabled ?? true) : true;
  const initSpinValues = existing && existing.mode !== 'circuit' && existing.activityType === 'spinning'
    ? (existing.spinValues ?? DEFAULT_SPIN_VALUES) : DEFAULT_SPIN_VALUES;

  const [runSpeeds, setRunSpeeds]     = useState<RunSpeeds>(initRunSpeeds);
  const [runInclines, setRunInclines] = useState<RunInclines>(initRunInclines);
  const [inclineEnabled, setInclineEnabled] = useState<boolean>(initInclineEnabled);
  const [spinValues, setSpinValues]   = useState<SpinValues>(initSpinValues);
  const [speedsDirty, setSpeedsDirty]   = useState(false);
  const [inclineDirty, setInclineDirty] = useState(false);
  const [spinDirty,   setSpinDirty]     = useState(false);
  const [activeSpeedPreset, setActiveSpeedPreset] = useState<PresetLevel | null>(() =>
    existing && existing.mode !== 'circuit' && existing.runSpeeds
      ? findMatchingSpeedPreset(existing.runSpeeds, speedPresetSource) : null
  );
  const [activeInclinePreset, setActiveInclinePreset] = useState<PresetLevel | null>(() =>
    existing && existing.mode !== 'circuit' && existing.activityType === 'run' && existing.runInclines
      ? findMatchingInclinePreset(existing.runInclines) : null
  );
  const [activeSpinPreset, setActiveSpinPreset] = useState<PresetLevel | null>(() =>
    existing && existing.mode !== 'circuit' && existing.activityType === 'spinning' && existing.spinValues
      ? findMatchingSpinPreset(existing.spinValues) : null
  );

  const runSpeedsDraft       = useDraft(initRunSpeeds);
  const runInclinesDraft     = useDraft(initRunInclines);
  const inclineEnabledDraft  = useDraft(initInclineEnabled);
  const spinValuesDraft      = useDraft(initSpinValues);

  const hasChanges = useMemo(
    () => runSpeedsDraft.isDirty(runSpeeds) || runInclinesDraft.isDirty(runInclines)
      || inclineEnabledDraft.isDirty(inclineEnabled) || spinValuesDraft.isDirty(spinValues),
    [runSpeeds, runInclines, inclineEnabled, spinValues],
  );

  function setRunSpeed(field: keyof RunSpeeds, value: number) {
    setRunSpeeds(prev => ({ ...prev, [field]: value }));
    setSpeedsDirty(true);
    setActiveSpeedPreset(null);
  }

  function setRunIncline(field: keyof RunInclines, value: number) {
    setRunInclines(prev => ({ ...prev, [field]: value }));
    setInclineDirty(true);
    setActiveInclinePreset(null);
  }

  function setSpinValue(field: keyof SpinValues, value: number) {
    setSpinValues(prev => ({ ...prev, [field]: value }));
    setSpinDirty(true);
    setActiveSpinPreset(null);
  }

  function applySpeedPreset(level: PresetLevel) {
    const doApply = () => {
      setRunSpeeds(speedPresetSource[level]);
      setSpeedsDirty(false);
      setActiveSpeedPreset(level);
    };
    if (speedsDirty) {
      appAlert(
        'warning',
        i18n.t('alerts.overwriteTitle'),
        i18n.t('alerts.overwriteSpeedMessage'),
        [{ text: i18n.t('alerts.cancel'), style: 'cancel' }, { text: i18n.t('alerts.apply'), onPress: doApply }],
      );
    } else {
      doApply();
    }
  }

  function applyInclinePreset(level: PresetLevel) {
    const doApply = () => {
      setRunInclines(INCLINE_PRESETS[level]);
      setInclineDirty(false);
      setActiveInclinePreset(level);
    };
    if (inclineDirty) {
      appAlert(
        'warning',
        i18n.t('alerts.overwriteTitle'),
        i18n.t('alerts.overwriteInclineMessage'),
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
      appAlert(
        'warning',
        i18n.t('alerts.overwriteTitle'),
        i18n.t('alerts.overwriteSpinMessage'),
        [{ text: i18n.t('alerts.cancel'), style: 'cancel' }, { text: i18n.t('alerts.apply'), onPress: doApply }],
      );
    } else {
      doApply();
    }
  }

  return {
    runSpeeds, runInclines, inclineEnabled, spinValues,
    activeSpeedPreset, activeInclinePreset, activeSpinPreset, hasChanges,
    setRunSpeed, setRunIncline, setInclineEnabled, setSpinValue,
    applySpeedPreset, applyInclinePreset, applySpinPreset,
  };
}
