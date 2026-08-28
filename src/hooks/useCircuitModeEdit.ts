import { useMemo, useState } from 'react';
import { useDraft } from './useDraft';
import { TABATA } from '../lib/workout';
import { type Session } from '../lib/sessions';

export interface CircuitModeEdit {
  circuitWarmup:   number;
  circuitCooldown: number;
  circuitRest:     number;
  circuitCount:    number;
  tabata:          boolean;
  hasChanges:      boolean;
  set:             (field: 'warmup' | 'cooldown' | 'rest' | 'count', value: number) => void;
  // Toggling Tabata on locks warmup/cooldown/rest/count to the canonical config;
  // toggling off just unlocks — the values stay put (caller decides what to edit next).
  setTabata:       (on: boolean) => void;
  reset:           () => void;
}

const DEFAULTS = { warmup: 60, cooldown: 60, rest: 30, count: 3 };

export function useCircuitModeEdit(initial: Session | undefined): CircuitModeEdit {
  const initW  = initial?.mode === 'circuit' ? initial.warmup      : DEFAULTS.warmup;
  const initC  = initial?.mode === 'circuit' ? initial.cooldown    : DEFAULTS.cooldown;
  const initR  = initial?.mode === 'circuit' ? initial.circuitRest : DEFAULTS.rest;
  const initCt = initial?.mode === 'circuit' ? initial.circuits    : DEFAULTS.count;
  const initT  = initial?.mode === 'circuit' ? (initial.tabata ?? false) : false;

  const [circuitWarmup,   setCircuitWarmup]   = useState(initW);
  const [circuitCooldown, setCircuitCooldown] = useState(initC);
  const [circuitRest,     setCircuitRest]     = useState(initR);
  const [circuitCount,    setCircuitCount]    = useState(initCt);
  const [tabata,          setTabataState]     = useState(initT);

  const stateSetters = {
    warmup:   setCircuitWarmup,
    cooldown: setCircuitCooldown,
    rest:     setCircuitRest,
    count:    setCircuitCount,
  };

  const draft = useDraft({ warmup: initW, cooldown: initC, rest: initR, count: initCt, tabata: initT });

  const hasChanges = useMemo(
    () => draft.isDirty({ warmup: circuitWarmup, cooldown: circuitCooldown, rest: circuitRest, count: circuitCount, tabata }),
    [circuitWarmup, circuitCooldown, circuitRest, circuitCount, tabata],
  );

  function set(field: 'warmup' | 'cooldown' | 'rest' | 'count', value: number) {
    stateSetters[field](value);
  }

  function setTabata(on: boolean) {
    setTabataState(on);
    if (on) {
      setCircuitWarmup(TABATA.warmup);
      setCircuitCooldown(TABATA.cooldown);
      setCircuitRest(0);
      setCircuitCount(1);
    }
  }

  function reset() {
    setCircuitWarmup(DEFAULTS.warmup);
    setCircuitCooldown(DEFAULTS.cooldown);
    setCircuitRest(DEFAULTS.rest);
    setCircuitCount(DEFAULTS.count);
    setTabataState(false);
  }

  return { circuitWarmup, circuitCooldown, circuitRest, circuitCount, tabata, hasChanges, set, setTabata, reset };
}
