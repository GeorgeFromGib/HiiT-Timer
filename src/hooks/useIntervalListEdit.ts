import { useMemo, useState } from 'react';
import { useDraft } from './useDraft';
import { tryConvertToEasy, buildIntervalsFromEasy, type Interval, type Phase } from '../lib/workout';
import { type Session } from '../lib/sessions';
import { type LocalInterval, toLocal } from './editSessionTypes';

type EasyConfig = { warmup: number; high: number; low: number; rounds: number; cooldown: number };

export interface IntervalListEdit {
  intervals:               LocalInterval[];
  hasChanges:              boolean;
  // True when the interval list has diverged from the last buildFromEasy() call —
  // signals the coordinator to warn before a new preset overwrites it.
  isTimingDirty:           boolean;
  cyclePhase:              (key: string, phases: Phase[]) => void;
  addInterval:             (type: Phase) => void;
  duplicateInterval:       (key: string) => void;
  removeInterval:          (key: string) => void;
  clearIntervals:          () => void;
  reorderIntervals:        (data: LocalInterval[]) => void;
  setActivityLabel:        (key: string, label: string) => void;
  setIntervalDuration:     (key: string, secs: number) => void;
  setIntervalSpeed:        (key: string, kmh: number) => void;
  clearIntervalSpeed:      (key: string) => void;
  setIntervalResistance:   (key: string, value: number) => void;
  clearIntervalResistance: (key: string) => void;
  setIntervalPower:        (key: string, value: number) => void;
  clearIntervalPower:      (key: string) => void;
  buildFromEasy:           (config: EasyConfig) => void;
  tryConvertToEasy:        typeof tryConvertToEasy;
}

export function useIntervalListEdit(existing: Session | undefined): IntervalListEdit {
  const initIntervals = existing?.mode === 'advanced' || existing?.mode === 'circuit'
    ? existing.intervals : [];

  const [intervals, setIntervals] = useState<LocalInterval[]>(initIntervals.map(toLocal));

  const draft = useDraft<Interval[]>(initIntervals);

  const hasChanges = useMemo(
    () => draft.isDirty(intervals.map(({ _key, ...iv }) => iv)),
    [intervals],
  );

  // Separate, resettable checkpoint: tracks divergence since the last buildFromEasy()
  // (rather than since the session was loaded), so the coordinator can warn before overwriting.
  const presetCheckpoint = useDraft<Interval[]>(initIntervals);

  const isTimingDirty = useMemo(
    () => presetCheckpoint.isDirty(intervals.map(({ _key, ...iv }) => iv)),
    [intervals],
  );

  function cyclePhase(key: string, phases: Phase[]) {
    setIntervals(ivs => ivs.map(iv => {
      if (iv._key !== key) return iv;
      const currentIdx = phases.indexOf(iv.type);
      const nextType = currentIdx >= 0
        ? phases[(currentIdx + 1) % phases.length]
        : phases[0];
      return { ...iv, type: nextType };
    }));
  }

  function addInterval(type: Phase) {
    const last = [...intervals].reverse().find(iv => iv.type === type);
    setIntervals(ivs => [...ivs, toLocal({
      type,
      dur:           last?.dur ?? 30,
      activityLabel: last?.activityLabel,
    })]);
  }

  function duplicateInterval(key: string) {
    setIntervals(ivs => {
      const idx = ivs.findIndex(iv => iv._key === key);
      if (idx === -1) return ivs;
      const copy = toLocal(ivs[idx]);
      return [...ivs.slice(0, idx + 1), copy, ...ivs.slice(idx + 1)];
    });
  }

  function removeInterval(key: string) {
    setIntervals(ivs => ivs.filter(iv => iv._key !== key));
  }

  function clearIntervals() {
    setIntervals([]);
  }

  function reorderIntervals(data: LocalInterval[]) {
    setIntervals(data);
  }

  function setActivityLabel(key: string, label: string) {
    setIntervals(ivs => ivs.map(iv =>
      iv._key === key ? { ...iv, activityLabel: label } : iv
    ));
  }

  function setIntervalDuration(key: string, secs: number) {
    setIntervals(ivs => ivs.map(iv => iv._key === key ? { ...iv, dur: secs } : iv));
  }

  function setIntervalSpeed(key: string, kmh: number) {
    setIntervals(ivs => ivs.map(iv => iv._key === key ? { ...iv, speed: kmh } : iv));
  }

  function clearIntervalSpeed(key: string) {
    setIntervals(ivs => ivs.map(iv => iv._key === key ? { ...iv, speed: undefined } : iv));
  }

  function setIntervalResistance(key: string, value: number) {
    setIntervals(ivs => ivs.map(iv => iv._key === key ? { ...iv, resistance: value } : iv));
  }

  function clearIntervalResistance(key: string) {
    setIntervals(ivs => ivs.map(iv => iv._key === key ? { ...iv, resistance: undefined } : iv));
  }

  function setIntervalPower(key: string, value: number) {
    setIntervals(ivs => ivs.map(iv => iv._key === key ? { ...iv, power: value } : iv));
  }

  function clearIntervalPower(key: string) {
    setIntervals(ivs => ivs.map(iv => iv._key === key ? { ...iv, power: undefined } : iv));
  }

  function buildFromEasy(config: EasyConfig) {
    const built = buildIntervalsFromEasy(config);
    setIntervals(built.map(toLocal));
    presetCheckpoint.commit(built);
  }

  return {
    intervals, hasChanges, isTimingDirty,
    cyclePhase, addInterval, duplicateInterval, removeInterval, clearIntervals, reorderIntervals,
    setActivityLabel,
    setIntervalDuration, setIntervalSpeed, clearIntervalSpeed,
    setIntervalResistance, clearIntervalResistance, setIntervalPower, clearIntervalPower,
    buildFromEasy, tryConvertToEasy,
  };
}
