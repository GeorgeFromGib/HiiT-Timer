import { useMemo, useRef, useState } from 'react';
import { type Session } from '../lib/sessions';

export interface CircuitModeEdit {
  circuitWarmup:   number;
  circuitCooldown: number;
  circuitRest:     number;
  circuitCount:    number;
  hasChanges:      boolean;
  set:             (field: 'warmup' | 'cooldown' | 'rest' | 'count', value: number) => void;
  reset:           () => void;
}

const DEFAULTS = { warmup: 60, cooldown: 60, rest: 30, count: 3 };

export function useCircuitModeEdit(initial: Session | undefined): CircuitModeEdit {
  const initW  = initial?.mode === 'circuit' ? initial.warmup      : DEFAULTS.warmup;
  const initC  = initial?.mode === 'circuit' ? initial.cooldown    : DEFAULTS.cooldown;
  const initR  = initial?.mode === 'circuit' ? initial.circuitRest : DEFAULTS.rest;
  const initCt = initial?.mode === 'circuit' ? initial.circuits    : DEFAULTS.count;

  const [circuitWarmup,   setCircuitWarmup]   = useState(initW);
  const [circuitCooldown, setCircuitCooldown] = useState(initC);
  const [circuitRest,     setCircuitRest]     = useState(initR);
  const [circuitCount,    setCircuitCount]    = useState(initCt);

  const stateSetters = {
    warmup:   setCircuitWarmup,
    cooldown: setCircuitCooldown,
    rest:     setCircuitRest,
    count:    setCircuitCount,
  };

  const initialSnapshot = useRef(
    JSON.stringify({ warmup: initW, cooldown: initC, rest: initR, count: initCt })
  ).current;

  const hasChanges = useMemo(
    () => JSON.stringify({ warmup: circuitWarmup, cooldown: circuitCooldown, rest: circuitRest, count: circuitCount }) !== initialSnapshot,
    [circuitWarmup, circuitCooldown, circuitRest, circuitCount, initialSnapshot],
  );

  function set(field: 'warmup' | 'cooldown' | 'rest' | 'count', value: number) {
    stateSetters[field](value);
  }

  function reset() {
    setCircuitWarmup(DEFAULTS.warmup);
    setCircuitCooldown(DEFAULTS.cooldown);
    setCircuitRest(DEFAULTS.rest);
    setCircuitCount(DEFAULTS.count);
  }

  return { circuitWarmup, circuitCooldown, circuitRest, circuitCount, hasChanges, set, reset };
}
