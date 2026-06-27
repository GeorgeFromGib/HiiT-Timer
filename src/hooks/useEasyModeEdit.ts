import { useMemo, useRef, useState } from 'react';
import { type Session } from '../lib/sessions';
import { type PresetLevel, DURATION_PRESETS, findMatchingDurationPreset } from '../lib/presets';
import { type TimeField } from './editSessionTypes';

type EasyConfig = { warmup: number; high: number; low: number; rounds: number; cooldown: number };

export interface EasyModeEdit {
  fieldValues:        Record<TimeField, number>;
  rounds:             number;
  easyConfig:         EasyConfig;
  activeTimingPreset: PresetLevel | null;
  hasChanges:         boolean;
  setField:           (field: TimeField, value: number) => void;
  setRounds:          (value: number) => void;
  applyPresetValues:  (warmup: number, work: number, rest: number, rounds: number, cooldown: number, level: PresetLevel) => void;
  reset:              () => void;
}

const DEFAULTS = { warmup: 30, work: 30, rest: 15, rounds: 4, cooldown: 30 };

export function useEasyModeEdit(initial: Session | undefined): EasyModeEdit {
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

  const [activeTimingPreset, setActiveTimingPreset] = useState<PresetLevel | null>(() =>
    initial?.mode === 'easy'
      ? findMatchingDurationPreset(
          initial.config.warmup, initial.config.high, initial.config.low,
          initial.config.rounds, initial.config.cooldown,
        )
      : null
  );

  const setters: Record<TimeField, (v: number) => void> = {
    warmup: setWarmup, work: setWork, rest: setRest, cooldown: setCooldown,
  };

  const initialSnapshot = useRef(
    JSON.stringify({ warmup: initW, work: initWk, rest: initR, rounds: initRd, cooldown: initC })
  ).current;

  const hasChanges = useMemo(
    () => JSON.stringify({ warmup, work, rest, rounds: rounds_, cooldown }) !== initialSnapshot,
    [warmup, work, rest, rounds_, cooldown, initialSnapshot],
  );

  function setField(field: TimeField, value: number) {
    setters[field](value);
    setActiveTimingPreset(null);
  }

  function setRounds(value: number) {
    setRounds_(value);
    setActiveTimingPreset(null);
  }

  function applyPresetValues(w: number, wk: number, r: number, rd: number, c: number, level: PresetLevel) {
    setWarmup(w);
    setWork(wk);
    setRest(r);
    setRounds_(rd);
    setCooldown(c);
    setActiveTimingPreset(level);
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
    activeTimingPreset, hasChanges,
    setField, setRounds, applyPresetValues, reset,
  };
}
