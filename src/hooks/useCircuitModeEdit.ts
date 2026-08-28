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
  reset:           () => void;
}

const DEFAULTS = { warmup: 60, cooldown: 60, rest: 30, count: 3 };

// startTabata: creating a brand-new Tabata session (its own session type). Seeds the
// circuit config to the locked canonical protocol — the editor keeps it read-only.
export function useCircuitModeEdit(initial: Session | undefined, startTabata = false): CircuitModeEdit {
  const seedTabata = startTabata && initial?.mode !== 'circuit';
  const initW  = initial?.mode === 'circuit' ? initial.warmup      : seedTabata ? TABATA.warmup   : DEFAULTS.warmup;
  const initC  = initial?.mode === 'circuit' ? initial.cooldown    : seedTabata ? TABATA.cooldown : DEFAULTS.cooldown;
  const initR  = initial?.mode === 'circuit' ? initial.circuitRest : seedTabata ? 0               : DEFAULTS.rest;
  const initCt = initial?.mode === 'circuit' ? initial.circuits    : seedTabata ? 1               : DEFAULTS.count;
  const initT  = initial?.mode === 'circuit' ? (initial.tabata ?? false) : seedTabata;

  const [circuitWarmup,   setCircuitWarmup]   = useState(initW);
  const [circuitCooldown, setCircuitCooldown] = useState(initC);
  const [circuitRest,     setCircuitRest]     = useState(initR);
  const [circuitCount,    setCircuitCount]    = useState(initCt);
  // Immutable after init — set only by the session type at creation, never toggled in the editor.
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

  function reset() {
    setCircuitWarmup(DEFAULTS.warmup);
    setCircuitCooldown(DEFAULTS.cooldown);
    setCircuitRest(DEFAULTS.rest);
    setCircuitCount(DEFAULTS.count);
    setTabataState(initT);
  }

  return { circuitWarmup, circuitCooldown, circuitRest, circuitCount, tabata, hasChanges, set, reset };
}
