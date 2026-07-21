import { useMemo, useRef, useState } from 'react';
import { useDraft } from './useDraft';
import { type Session } from '../lib/sessions';
import { type PresetLevel } from '../lib/presets';
import { findMatchingIntensityPreset, WALK_INTENSITY_PRESETS, INTENSITY_PRESETS } from '../lib/intensityPresets';
import { type TimeField } from './editSessionTypes';

type EasyConfig = { warmup: number; high: number; low: number; rounds: number; cooldown: number };

export interface EasyModeEdit {
  fieldValues:        Record<TimeField, number>;
  rounds:             number;
  easyConfig:         EasyConfig;
  activeTimingPreset: PresetLevel | null;
  hasChanges:         boolean;
  // True when warmup/work/rest/rounds/cooldown have diverged from the last-applied intensity preset —
  // signals the coordinator to warn before a new preset overwrites them.
  isTimingDirty:      boolean;
  setField:             (field: TimeField, value: number) => void;
  setFieldEnabled:      (field: TimeField, enabled: boolean) => number;
  setRounds:            (value: number) => void;
  applyIntensityPreset: (work: number, rest: number, rounds: number, level: PresetLevel) => void;
  reset:                () => void;
}

const DEFAULTS = { warmup: 30, work: 30, rest: 15, rounds: 4, cooldown: 30 };

export function useEasyModeEdit(
  initial: Session | undefined,
  activityType?: 'run' | 'walk' | 'spinning',
): EasyModeEdit {
  const initW  = initial?.mode === 'easy' ? initial.config.warmup   : DEFAULTS.warmup;
  const initWk = initial?.mode === 'easy' ? initial.config.high     : DEFAULTS.work;
  const initR  = initial?.mode === 'easy' ? initial.config.low      : DEFAULTS.rest;
  const initRd = initial?.mode === 'easy' ? initial.config.rounds   : DEFAULTS.rounds;
  const initC  = initial?.mode === 'easy' ? initial.config.cooldown : DEFAULTS.cooldown;

  const [warmup,   setWarmup]   = useState(initW);
  const [work,     setWork]     = useState(initWk);
  const [rest,     setRest]     = useState(initR);
  const [rounds_,  setRounds_]  = useState(initRd);
  const [cooldown, setCooldown] = useState(initC);

  const intensityPresetSource = activityType === 'walk' ? WALK_INTENSITY_PRESETS : INTENSITY_PRESETS;

  const [activeTimingPreset, setActiveTimingPreset] = useState<PresetLevel | null>(() =>
    initial?.mode === 'easy'
      ? findMatchingIntensityPreset(initial.config.high, initial.config.low, intensityPresetSource)
      : null
  );

  const setters: Record<TimeField, (v: number) => void> = {
    warmup: setWarmup, work: setWork, rest: setRest, cooldown: setCooldown,
  };

  // Remembers the last non-zero duration per field so re-enabling warmup/cooldown restores it.
  const lastNonZero = useRef<Record<TimeField, number>>({
    warmup: initW || DEFAULTS.warmup, work: initWk, rest: initR, cooldown: initC || DEFAULTS.cooldown,
  });

  const draft = useDraft({ warmup: initW, work: initWk, rest: initR, rounds: initRd, cooldown: initC });

  const hasChanges = useMemo(
    () => draft.isDirty({ warmup, work, rest, rounds: rounds_, cooldown }),
    [warmup, work, rest, rounds_, cooldown],
  );

  // Separate, resettable checkpoint: tracks divergence since the last applied preset
  // (rather than since the session was loaded), so the coordinator can warn before overwriting.
  const presetCheckpoint = useDraft({ warmup: initW, work: initWk, rest: initR, rounds: initRd, cooldown: initC });

  const isTimingDirty = useMemo(
    () => presetCheckpoint.isDirty({ warmup, work, rest, rounds: rounds_, cooldown }),
    [warmup, work, rest, rounds_, cooldown],
  );

  function setField(field: TimeField, value: number) {
    setters[field](value);
    if (value > 0) lastNonZero.current[field] = value;
    setActiveTimingPreset(null);
  }

  function setFieldEnabled(field: TimeField, enabled: boolean): number {
    const value = enabled ? lastNonZero.current[field] : 0;
    setField(field, value);
    return value;
  }

  function setRounds(value: number) {
    setRounds_(value);
    setActiveTimingPreset(null);
  }

  function applyIntensityPreset(wk: number, r: number, rd: number, level: PresetLevel) {
    setWork(wk);
    setRest(r);
    setRounds_(rd);
    setActiveTimingPreset(level);
    presetCheckpoint.commit({ warmup, work: wk, rest: r, rounds: rd, cooldown });
  }

  function reset() {
    setWarmup(DEFAULTS.warmup);
    setWork(DEFAULTS.work);
    setRest(DEFAULTS.rest);
    setRounds_(DEFAULTS.rounds);
    setCooldown(DEFAULTS.cooldown);
    setActiveTimingPreset(null);
  }

  const fieldValues: Record<TimeField, number> = { warmup, work, rest, cooldown };
  const easyConfig: EasyConfig = {
    warmup,
    high:    Math.max(1, work),
    low:     rest,
    rounds:  Math.max(1, rounds_),
    cooldown,
  };

  return {
    fieldValues, rounds: rounds_, easyConfig,
    activeTimingPreset, hasChanges, isTimingDirty,
    setField, setFieldEnabled, setRounds, applyIntensityPreset, reset,
  };
}
