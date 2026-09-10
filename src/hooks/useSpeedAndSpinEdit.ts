import { useMemo, useState } from 'react';
import { useDraft } from './useDraft';
import { confirmIfDirty } from '../lib/appAlert';
import {
  type Session, type RunSpeeds, type RunInclines, type SpinValues,
  DEFAULT_RUN_SPEEDS, DEFAULT_RUN_INCLINES, DEFAULT_SPIN_VALUES,
} from '../lib/sessions';
import {
  type PresetLevel, SPEED_PRESETS, INCLINE_PRESETS, SPIN_PRESETS,
  findMatchingSpeedPreset, findMatchingInclinePreset, findMatchingSpinPreset,
} from '../lib/presets';

export interface SpeedAndSpinEdit {
  runSpeeds:          RunSpeeds;
  runInclines:        RunInclines;
  inclineEnabled:     boolean;
  cooldownTaper:      boolean;
  spinValues:         SpinValues;
  activeSpeedPreset:  PresetLevel | null;
  activeInclinePreset: PresetLevel | null;
  activeSpinPreset:   PresetLevel | null;
  hasChanges:         boolean;
  setRunSpeed:        (field: keyof RunSpeeds, value: number) => void;
  setRunIncline:      (field: keyof RunInclines, value: number) => void;
  setInclineEnabled:  (enabled: boolean) => void;
  setCooldownTaper:   (enabled: boolean) => void;
  setSpinValue:       (field: keyof SpinValues, value: number) => void;
  applySpeedPreset:   (level: PresetLevel) => void;
  applyInclinePreset: (level: PresetLevel) => void;
  applySpinPreset:    (level: PresetLevel) => void;
}

// A brand-new session starts on preset level 1 for every axis (timing, speed,
// incline, spin). Existing sessions keep their saved values.
const NEW_PRESET_LEVEL: PresetLevel = '1';

export function useSpeedAndSpinEdit(
  existing: Session | undefined,
  newActivityType?: 'general' | 'run' | 'circuit' | 'spinning' | 'tabata',
): SpeedAndSpinEdit {
  const initRunSpeeds = existing && existing.mode !== 'circuit'
    ? (existing.runSpeeds ?? DEFAULT_RUN_SPEEDS) : SPEED_PRESETS[NEW_PRESET_LEVEL];
  const initRunInclines = existing && existing.mode !== 'circuit' && existing.activityType === 'run'
    ? (existing.runInclines ?? DEFAULT_RUN_INCLINES) : INCLINE_PRESETS[NEW_PRESET_LEVEL];
  const initInclineEnabled = existing && existing.mode !== 'circuit' && existing.activityType === 'run'
    ? (existing.inclineEnabled ?? true) : true;
  // New treadmill (run) sessions default the cooldown taper ON; existing sessions
  // keep whatever they were saved with.
  const initCooldownTaper = existing && existing.mode !== 'circuit' && existing.activityType === 'run'
    ? (existing.cooldownTaper ?? false)
    : (!existing && newActivityType === 'run');
  const initSpinValues = existing && existing.mode !== 'circuit' && existing.activityType === 'spinning'
    ? (existing.spinValues ?? DEFAULT_SPIN_VALUES) : SPIN_PRESETS[NEW_PRESET_LEVEL];

  const [runSpeeds, setRunSpeeds]     = useState<RunSpeeds>(initRunSpeeds);
  const [runInclines, setRunInclines] = useState<RunInclines>(initRunInclines);
  const [inclineEnabled, setInclineEnabled] = useState<boolean>(initInclineEnabled);
  const [cooldownTaper, setCooldownTaper] = useState<boolean>(initCooldownTaper);
  const [spinValues, setSpinValues]   = useState<SpinValues>(initSpinValues);
  const [speedsDirty, setSpeedsDirty]   = useState(false);
  const [inclineDirty, setInclineDirty] = useState(false);
  const [spinDirty,   setSpinDirty]     = useState(false);
  const [activeSpeedPreset, setActiveSpeedPreset] = useState<PresetLevel | null>(() =>
    existing && existing.mode !== 'circuit' && existing.runSpeeds
      ? findMatchingSpeedPreset(existing.runSpeeds)
      : existing ? null : NEW_PRESET_LEVEL
  );
  const [activeInclinePreset, setActiveInclinePreset] = useState<PresetLevel | null>(() =>
    existing && existing.mode !== 'circuit' && existing.activityType === 'run' && existing.runInclines
      ? findMatchingInclinePreset(existing.runInclines)
      : existing ? null : NEW_PRESET_LEVEL
  );
  const [activeSpinPreset, setActiveSpinPreset] = useState<PresetLevel | null>(() =>
    existing && existing.mode !== 'circuit' && existing.activityType === 'spinning' && existing.spinValues
      ? findMatchingSpinPreset(existing.spinValues)
      : existing ? null : NEW_PRESET_LEVEL
  );

  const runSpeedsDraft       = useDraft(initRunSpeeds);
  const runInclinesDraft     = useDraft(initRunInclines);
  const inclineEnabledDraft  = useDraft(initInclineEnabled);
  const cooldownTaperDraft   = useDraft(initCooldownTaper);
  const spinValuesDraft      = useDraft(initSpinValues);

  const hasChanges = useMemo(
    () => runSpeedsDraft.isDirty(runSpeeds) || runInclinesDraft.isDirty(runInclines)
      || inclineEnabledDraft.isDirty(inclineEnabled) || cooldownTaperDraft.isDirty(cooldownTaper)
      || spinValuesDraft.isDirty(spinValues),
    [runSpeeds, runInclines, inclineEnabled, cooldownTaper, spinValues],
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
    confirmIfDirty(speedsDirty, 'alerts.overwriteSpeedMessage', () => {
      setRunSpeeds(SPEED_PRESETS[level]);
      setSpeedsDirty(false);
      setActiveSpeedPreset(level);
    });
  }

  function applyInclinePreset(level: PresetLevel) {
    confirmIfDirty(inclineDirty, 'alerts.overwriteInclineMessage', () => {
      setRunInclines(INCLINE_PRESETS[level]);
      setInclineDirty(false);
      setActiveInclinePreset(level);
    });
  }

  function applySpinPreset(level: PresetLevel) {
    confirmIfDirty(spinDirty, 'alerts.overwriteSpinMessage', () => {
      setSpinValues(SPIN_PRESETS[level]);
      setSpinDirty(false);
      setActiveSpinPreset(level);
    });
  }

  return {
    runSpeeds, runInclines, inclineEnabled, cooldownTaper, spinValues,
    activeSpeedPreset, activeInclinePreset, activeSpinPreset, hasChanges,
    setRunSpeed, setRunIncline, setInclineEnabled, setCooldownTaper, setSpinValue,
    applySpeedPreset, applyInclinePreset, applySpinPreset,
  };
}
