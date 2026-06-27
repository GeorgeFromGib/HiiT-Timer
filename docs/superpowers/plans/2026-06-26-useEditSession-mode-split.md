# useEditSession Mode Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 700-line `useEditSession` hook into four focused sub-modules, reducing the coordinator to ~200 lines.

**Architecture:** Extract shared types to `editSessionTypes.ts`, move `usePickerState` to its own file, create three mode hooks (`useEasyModeEdit`, `useCircuitModeEdit`, `useAdvancedModeEdit`), then wire them in the refactored coordinator. Each step is independently type-checkable before the final wiring. The public `EditSessionInterface` and `EditSessionDraft` are unchanged — `EditSessionScreen` needs no changes.

**Tech Stack:** React Native (Expo SDK 56), TypeScript strict, no test framework — use `npx tsc --noEmit` for correctness and manual runtime verification.

## Global Constraints

- `EditSessionInterface`, `EditSessionDraft`, `EditSessionPicker` shapes must not change — `EditSessionScreen` imports them
- All exports from `useEditSession.ts` that are consumed by `EditSessionScreen` (`LocalInterval`, `TimeField`, `SavePayload`, `toLocal`, `useEditSession`) must remain importable from `useEditSession.ts` (re-export if moved)
- No changes to `EditSessionScreen.tsx` or any file outside `src/hooks/`
- `npx tsc --noEmit` must pass after each task

---

## File map

| File | Action | Responsibility after refactor |
|---|---|---|
| `src/hooks/editSessionTypes.ts` | **Create** | `LocalInterval`, `toLocal`, `TimeField`, `SavePayload` |
| `src/hooks/usePickerState.ts` | **Create** | Picker modal state (moved from `useEditSession.ts`) |
| `src/hooks/useEasyModeEdit.ts` | **Create** | Easy field values, `activeTimingPreset`, `hasChanges` |
| `src/hooks/useCircuitModeEdit.ts` | **Create** | Circuit config values, `hasChanges` |
| `src/hooks/useAdvancedModeEdit.ts` | **Create** | `buildFromEasy`, `tryConvertToEasy` utilities (no state) |
| `src/hooks/useEditSession.ts` | **Modify** | Coordinator: name, mode, intervals, runSpeeds, dirty flags |

---

## Task 1: Create `editSessionTypes.ts` — shared types

**Files:**
- Create: `src/hooks/editSessionTypes.ts`
- Modify: `src/hooks/useEditSession.ts`

**Interfaces:**
- Produces: `LocalInterval`, `toLocal`, `TimeField`, `SavePayload` — all re-exported from `useEditSession.ts` for backward compat

- [ ] **Step 1: Create `src/hooks/editSessionTypes.ts`**

```ts
import { type Interval } from '../lib/workout';
import { type Session } from '../lib/sessions';

export type LocalInterval = Interval & { _key: string };

export const toLocal = (iv: Interval): LocalInterval =>
  ({ ...iv, _key: Math.random().toString(36).slice(2) });

export type TimeField = 'warmup' | 'work' | 'rest' | 'cooldown';

export type SavePayload =
  | { ok: true; session: Session; isNew: boolean }
  | { ok: false; titleKey: string; messageKey: string };
```

- [ ] **Step 2: Update `useEditSession.ts` — replace local definitions with imports and re-exports**

At the top of `src/hooks/useEditSession.ts`, replace:

```ts
export type LocalInterval = Interval & { _key: string };
export const toLocal = (iv: Interval): LocalInterval =>
  ({ ...iv, _key: Math.random().toString(36).slice(2) });

export type TimeField = 'warmup' | 'work' | 'rest' | 'cooldown';
```

and

```ts
export type SavePayload =
  | { ok: true; session: Session; isNew: boolean }
  | { ok: false; titleKey: string; messageKey: string };
```

with:

```ts
export type { LocalInterval, TimeField, SavePayload } from './editSessionTypes';
export { toLocal } from './editSessionTypes';
import { type LocalInterval, toLocal, type TimeField, type SavePayload } from './editSessionTypes';
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/editSessionTypes.ts src/hooks/useEditSession.ts
git commit -m "refactor(edit): extract shared types to editSessionTypes.ts"
```

---

## Task 2: Extract `usePickerState` to its own file

**Files:**
- Create: `src/hooks/usePickerState.ts`
- Modify: `src/hooks/useEditSession.ts`

**Interfaces:**
- Produces: `usePickerState(intervals, fieldValues, circuitValues, onCommit)` — same signature as today; exports `EditSessionPicker`, `ActivePicker`, `CommitResult`

- [ ] **Step 1: Create `src/hooks/usePickerState.ts`**

Cut the `ActivePicker`, `CommitResult`, `EditSessionPicker` type blocks and the `usePickerState` function (lines 19–282 of the current `useEditSession.ts`) and paste into this new file, then add the necessary imports:

```ts
import { useState } from 'react';
import { i18n } from '../lib/i18n';
import { type RunSpeeds } from '../lib/sessions';
import { convertMphToKmh } from '../lib/workout';
import { type LocalInterval, type TimeField } from './editSessionTypes';

export type ActivePicker =
  | { type: 'field'; field: TimeField }
  | { type: 'interval'; key: string }
  | { type: 'rounds' }
  | { type: 'speed'; field: keyof RunSpeeds; isMiles: boolean }
  | { type: 'intervalSpeed'; key: string; isMiles: boolean }
  | { type: 'circuitWarmup' }
  | { type: 'circuitCooldown' }
  | { type: 'circuitRest' }
  | { type: 'circuitCount' };

export type CommitResult =
  | { type: 'field';           field: TimeField;       secs: number }
  | { type: 'interval';        key: string;            secs: number }
  | { type: 'rounds';          value: number }
  | { type: 'speed';           field: keyof RunSpeeds; kmh: number }
  | { type: 'intervalSpeed';   key: string;            kmh: number }
  | { type: 'circuitWarmup';   secs: number }
  | { type: 'circuitCooldown'; secs: number }
  | { type: 'circuitRest';     secs: number }
  | { type: 'circuitCount';    value: number };

export interface EditSessionPicker {
  title:        string;
  isRounds:     boolean;
  roundsLabel?: string;
  isSpeed:      boolean;
  speedUnit:    'km' | 'miles';
  minutes:      number;
  seconds:      number;
  rounds:       number;
  speedWhole:   number;
  speedDecimal: number;
}

export function usePickerState(
  intervals:     LocalInterval[],
  fieldValues:   Record<TimeField, number>,
  circuitValues: { warmup: number; cooldown: number; rest: number; count: number },
  onCommit:      (result: CommitResult) => void,
) {
  const [activePicker,  setActivePicker]  = useState<ActivePicker | null>(null);
  const [pickerMinutes, setPickerMinutes] = useState(0);
  const [pickerSeconds, setPickerSeconds] = useState(0);
  const [pickerRounds,  setPickerRounds]  = useState(0);
  const [speedWhole,    setSpeedWhole]    = useState(0);
  const [speedDecimal,  setSpeedDecimal]  = useState(0);

  const pickerTitle = (() => {
    if (!activePicker) return '';
    if (activePicker.type === 'circuitCount') return i18n.t('picker.circuitsTitle');
    if (activePicker.type === 'circuitWarmup') return i18n.t('phases.warmup');
    if (activePicker.type === 'circuitCooldown') return i18n.t('phases.cooldown');
    if (activePicker.type === 'circuitRest') return i18n.t('edit.circuitRest');
    if (activePicker.type === 'rounds') return i18n.t('picker.roundsTitle');
    if (activePicker.type === 'field') return i18n.t('phases.' + activePicker.field);
    if (activePicker.type === 'speed') {
      const phase = activePicker.field.replace('Speed', '');
      return i18n.t('picker.speedSuffix', { phase: i18n.t('phases.' + phase) });
    }
    if (activePicker.type === 'intervalSpeed') {
      const idx = intervals.findIndex(iv => iv._key === activePicker.key);
      return i18n.t('picker.intervalSpeedTitle', { n: idx + 1 });
    }
    const idx = intervals.findIndex(iv => iv._key === activePicker.key);
    return i18n.t('picker.intervalTitle', { n: idx + 1 });
  })();

  function openFieldPicker(field: TimeField) {
    const secs = fieldValues[field];
    setPickerMinutes(Math.floor(secs / 60));
    setPickerSeconds(secs % 60);
    setActivePicker({ type: 'field', field });
  }

  function openRoundsPicker(currentRounds: number) {
    setPickerRounds(currentRounds - 1);
    setActivePicker({ type: 'rounds' });
  }

  function openIntervalPicker(key: string) {
    const iv = intervals.find(i => i._key === key);
    if (!iv) return;
    setPickerMinutes(Math.floor(iv.dur / 60));
    setPickerSeconds(iv.dur % 60);
    setActivePicker({ type: 'interval', key });
  }

  function openSpeedPicker(field: keyof RunSpeeds, displayValue: number, isMiles: boolean) {
    const whole = Math.floor(displayValue);
    const decimal = Math.min(9, Math.round((displayValue - whole) * 10));
    setSpeedWhole(whole);
    setSpeedDecimal(decimal);
    setActivePicker({ type: 'speed', field, isMiles });
  }

  function openIntervalSpeedPicker(key: string, displayValue: number, isMiles: boolean) {
    const whole = Math.floor(displayValue);
    const decimal = Math.min(9, Math.round((displayValue - whole) * 10));
    setSpeedWhole(whole);
    setSpeedDecimal(decimal);
    setActivePicker({ type: 'intervalSpeed', key, isMiles });
  }

  function openCircuitWarmupPicker() {
    setPickerMinutes(Math.floor(circuitValues.warmup / 60));
    setPickerSeconds(circuitValues.warmup % 60);
    setActivePicker({ type: 'circuitWarmup' });
  }

  function openCircuitCooldownPicker() {
    setPickerMinutes(Math.floor(circuitValues.cooldown / 60));
    setPickerSeconds(circuitValues.cooldown % 60);
    setActivePicker({ type: 'circuitCooldown' });
  }

  function openCircuitRestPicker() {
    setPickerMinutes(Math.floor(circuitValues.rest / 60));
    setPickerSeconds(circuitValues.rest % 60);
    setActivePicker({ type: 'circuitRest' });
  }

  function openCircuitCountPicker() {
    setPickerRounds(circuitValues.count - 1);
    setActivePicker({ type: 'circuitCount' });
  }

  function commitPicker() {
    if (!activePicker) return;
    if (activePicker.type === 'rounds') {
      onCommit({ type: 'rounds', value: pickerRounds + 1 });
    } else if (activePicker.type === 'speed') {
      const displayVal = speedWhole + speedDecimal / 10;
      const kmh = activePicker.isMiles ? convertMphToKmh(displayVal) : displayVal;
      onCommit({ type: 'speed', field: activePicker.field, kmh });
    } else if (activePicker.type === 'intervalSpeed') {
      const displayVal = speedWhole + speedDecimal / 10;
      const kmh = activePicker.isMiles ? convertMphToKmh(displayVal) : displayVal;
      onCommit({ type: 'intervalSpeed', key: activePicker.key, kmh });
    } else if (activePicker.type === 'circuitCount') {
      onCommit({ type: 'circuitCount', value: pickerRounds + 1 });
    } else if (activePicker.type === 'circuitWarmup') {
      onCommit({ type: 'circuitWarmup', secs: pickerMinutes * 60 + pickerSeconds });
    } else if (activePicker.type === 'circuitCooldown') {
      onCommit({ type: 'circuitCooldown', secs: pickerMinutes * 60 + pickerSeconds });
    } else if (activePicker.type === 'circuitRest') {
      onCommit({ type: 'circuitRest', secs: pickerMinutes * 60 + pickerSeconds });
    } else {
      const secs = pickerMinutes * 60 + pickerSeconds;
      if (activePicker.type === 'field') {
        onCommit({ type: 'field', field: activePicker.field, secs });
      } else {
        onCommit({ type: 'interval', key: activePicker.key, secs });
      }
    }
    setActivePicker(null);
  }

  const picker: EditSessionPicker | null = activePicker ? {
    title:       pickerTitle,
    isRounds:    activePicker.type === 'rounds' || activePicker.type === 'circuitCount',
    roundsLabel: activePicker.type === 'circuitCount' ? i18n.t('picker.circuitsTitle')
               : activePicker.type === 'rounds'       ? i18n.t('picker.rounds')
               : undefined,
    isSpeed:     activePicker.type === 'speed' || activePicker.type === 'intervalSpeed',
    speedUnit:   (activePicker.type === 'speed' || activePicker.type === 'intervalSpeed') && activePicker.isMiles ? 'miles' : 'km',
    minutes:     pickerMinutes,
    seconds:     pickerSeconds,
    rounds:      pickerRounds,
    speedWhole,
    speedDecimal,
  } : null;

  return {
    picker,
    openFieldPicker,
    openRoundsPicker,
    openIntervalPicker,
    openSpeedPicker,
    openIntervalSpeedPicker,
    openCircuitWarmupPicker,
    openCircuitCooldownPicker,
    openCircuitRestPicker,
    openCircuitCountPicker,
    updatePicker: (partial: { minutes?: number; seconds?: number; rounds?: number; speedWhole?: number; speedDecimal?: number }) => {
      if (partial.minutes      !== undefined) setPickerMinutes(partial.minutes);
      if (partial.seconds      !== undefined) setPickerSeconds(partial.seconds);
      if (partial.rounds       !== undefined) setPickerRounds(partial.rounds);
      if (partial.speedWhole   !== undefined) setSpeedWhole(partial.speedWhole);
      if (partial.speedDecimal !== undefined) setSpeedDecimal(partial.speedDecimal);
    },
    commitPicker,
    dismissPicker: () => setActivePicker(null),
  };
}
```

- [ ] **Step 2: Update `useEditSession.ts` — remove the moved code, add import**

Remove the `ActivePicker`, `CommitResult`, `EditSessionPicker` type blocks and the `usePickerState` function body from `useEditSession.ts`. Add at the top:

```ts
import { usePickerState, type EditSessionPicker } from './usePickerState';
```

Add re-export of `EditSessionPicker` for any external consumers:

```ts
export type { EditSessionPicker };
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePickerState.ts src/hooks/useEditSession.ts
git commit -m "refactor(edit): extract usePickerState to its own file"
```

---

## Task 3: Create `useEasyModeEdit.ts`

**Files:**
- Create: `src/hooks/useEasyModeEdit.ts`

**Interfaces:**
- Consumes: `Session` from `lib/sessions`; `PresetLevel`, `DURATION_PRESETS`, `findMatchingDurationPreset` from `lib/presets`; `TimeField` from `./editSessionTypes`
- Produces: `EasyModeEdit` interface — `useEditSession.ts` consumes this in Task 6

Note: `timingDirty` lives in the parent coordinator (Task 6), not here. This hook owns field values and `activeTimingPreset` only.

- [ ] **Step 1: Create `src/hooks/useEasyModeEdit.ts`**

```ts
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
  const [rounds,   setRounds_]  = useState(initRd);
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
```

Note: the local variable is named `rounds_` to avoid shadowing the exported `rounds` property.

- [ ] **Step 2: Verify (standalone — `useEditSession.ts` unchanged)**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useEasyModeEdit.ts
git commit -m "refactor(edit): add useEasyModeEdit hook"
```

---

## Task 4: Create `useCircuitModeEdit.ts`

**Files:**
- Create: `src/hooks/useCircuitModeEdit.ts`

**Interfaces:**
- Consumes: `Session` from `lib/sessions`
- Produces: `CircuitModeEdit` — consumed by `useEditSession.ts` in Task 6

- [ ] **Step 1: Create `src/hooks/useCircuitModeEdit.ts`**

```ts
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
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCircuitModeEdit.ts
git commit -m "refactor(edit): add useCircuitModeEdit hook"
```

---

## Task 5: Create `useAdvancedModeEdit.ts`

**Files:**
- Create: `src/hooks/useAdvancedModeEdit.ts`

**Interfaces:**
- Consumes: `tryConvertToEasy`, `buildIntervalsFromEasy` from `lib/workout`; `LocalInterval`, `toLocal` from `./editSessionTypes`
- Produces: `AdvancedModeEdit` — consumed by `useEditSession.ts` in Task 6

- [ ] **Step 1: Create `src/hooks/useAdvancedModeEdit.ts`**

```ts
import { tryConvertToEasy, buildIntervalsFromEasy } from '../lib/workout';
import { toLocal, type LocalInterval } from './editSessionTypes';

type EasyConfig = { warmup: number; high: number; low: number; rounds: number; cooldown: number };

export interface AdvancedModeEdit {
  buildFromEasy:    (config: EasyConfig) => LocalInterval[];
  tryConvertToEasy: typeof tryConvertToEasy;
}

export function useAdvancedModeEdit(): AdvancedModeEdit {
  return {
    buildFromEasy:    (config) => buildIntervalsFromEasy(config).map(toLocal),
    tryConvertToEasy: tryConvertToEasy,
  };
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAdvancedModeEdit.ts
git commit -m "refactor(edit): add useAdvancedModeEdit hook"
```

---

## Task 6: Wire all hooks in `useEditSession.ts`

**Files:**
- Modify: `src/hooks/useEditSession.ts`

**Interfaces:**
- Consumes: `EasyModeEdit` from `./useEasyModeEdit`, `CircuitModeEdit` from `./useCircuitModeEdit`, `AdvancedModeEdit` from `./useAdvancedModeEdit`, `usePickerState` from `./usePickerState`
- Produces: unchanged `EditSessionInterface` — no change to consumers

This is the big wiring step. Replace the entire `useEditSession.ts` with the version below.

Key changes from the current file:
- Easy field state (`warmup`/`work`/`rest`/`rounds`/`cooldown`, `timingDirty`, `activeTimingPreset`) → `easyEdit`
- Circuit config state (`circuitWarmup`/`cooldown`/`rest`/`count`) → `circuitEdit`
- `buildIntervalsFromEasy` / `tryConvertToEasy` calls → `advanced.*`
- `usePickerState` call → imported from `./usePickerState`
- `timingDirty` stays in the coordinator (it's a cross-mode concern — set when intervals change too)
- `applyDurationPreset` stays in the coordinator (calls `easyEdit.applyPresetValues`, optionally rebuilds intervals)
- `activeTimingPreset` in the draft: uses `easyEdit.activeTimingPreset` in easy mode, derives from intervals via `findMatchingDurationPresetForIntervals` in advanced mode

- [ ] **Step 1: Replace `useEditSession.ts` with the wired coordinator**

```ts
import { useMemo, useRef, useState } from 'react';
import { i18n } from '../lib/i18n';
import { Alert } from 'react-native';
import {
  getSessionSegments, speedForPhase,
  type Session, type RunSpeeds, DEFAULT_RUN_SPEEDS, newId,
} from '../lib/sessions';
import { serializeDraft, buildSessionFromDraft, validateDraft } from '../lib/sessionDraft';
import {
  type PresetLevel, DURATION_PRESETS, SPEED_PRESETS,
  findMatchingDurationPresetForIntervals, findMatchingSpeedPreset,
} from '../lib/presets';
import {
  totalDuration, convertKmhToMph, convertMphToKmh, expandCircuit,
  type Interval, type Phase, type Segment,
} from '../lib/workout';

import { type LocalInterval, toLocal, type TimeField, type SavePayload } from './editSessionTypes';
import { useEasyModeEdit } from './useEasyModeEdit';
import { useCircuitModeEdit } from './useCircuitModeEdit';
import { useAdvancedModeEdit } from './useAdvancedModeEdit';
import { usePickerState, type EditSessionPicker } from './usePickerState';

// Re-export shared types — EditSessionScreen imports these from here
export type { LocalInterval, TimeField, SavePayload, EditSessionPicker };
export { toLocal };

const PHASES: Phase[] = ['warmup', 'work', 'rest', 'cooldown'];
const CIRCUIT_PHASES: Phase[] = ['work', 'rest'];

export interface EditSessionDraft {
  name:                string;
  isAdvanced:          boolean;
  isCircuit:           boolean;
  fieldValues:         Record<TimeField, number>;
  rounds:              number;
  intervals:           LocalInterval[];
  previewSegments:     Segment[];
  previewTotal:        number;
  activityType:        'run' | undefined;
  runSpeeds:           RunSpeeds;
  activeTimingPreset:  PresetLevel | null;
  activeSpeedPreset:   PresetLevel | null;
  hasChanges:          boolean;
  circuitWarmup:       number;
  circuitCooldown:     number;
  circuitRest:         number;
  circuitCount:        number;
}

export interface EditSessionInterface {
  draft:   EditSessionDraft;
  picker:  EditSessionPicker | null;
  setName:                  (name: string) => void;
  setActivityType:          (type: 'run' | undefined) => void;
  setDisplayActivityType:   (type: 'general' | 'run' | 'circuit') => void;
  setRunSpeed:              (field: keyof RunSpeeds, value: number) => void;
  toggleMode:               (advanced: boolean) => void;
  cyclePhase:               (key: string) => void;
  addInterval:              (type: Phase) => void;
  duplicateInterval:        (key: string) => void;
  removeInterval:           (key: string) => void;
  clearIntervals:           () => void;
  reorderIntervals:         (data: LocalInterval[]) => void;
  openFieldPicker:          (field: TimeField) => void;
  openRoundsPicker:         () => void;
  openIntervalPicker:       (key: string) => void;
  openSpeedPicker:          (field: keyof RunSpeeds, displayValue: number, isMiles: boolean) => void;
  openIntervalSpeedPicker:  (key: string, isMiles: boolean) => void;
  clearIntervalSpeed:       (key: string) => void;
  updatePicker:             (partial: { minutes?: number; seconds?: number; rounds?: number; speedWhole?: number; speedDecimal?: number }) => void;
  commitPicker:             () => void;
  dismissPicker:            () => void;
  applyDurationPreset:      (level: PresetLevel) => void;
  applySpeedPreset:         (level: PresetLevel) => void;
  setActivityLabel:         (key: string, label: string) => void;
  openCircuitWarmupPicker:  () => void;
  openCircuitCooldownPicker: () => void;
  openCircuitRestPicker:    () => void;
  openCircuitsPicker:       () => void;
  buildSavePayload:         () => SavePayload;
}

export function useEditSession(
  existing: Session | undefined,
  onBack: () => void,
): EditSessionInterface {
  const [name, setName] = useState(existing?.name ?? '');
  const [mode, setMode] = useState<'easy' | 'advanced' | 'circuit'>(existing?.mode ?? 'easy');

  const [intervals, setIntervals] = useState<LocalInterval[]>(
    existing?.mode === 'advanced' || existing?.mode === 'circuit'
      ? existing.intervals.map(toLocal) : []
  );
  const [activityType, setActivityType] = useState<'run' | undefined>(
    existing && existing.mode !== 'circuit' ? existing.activityType : undefined
  );
  const [runSpeeds, setRunSpeeds] = useState<RunSpeeds>(
    existing && existing.mode !== 'circuit' ? (existing.runSpeeds ?? DEFAULT_RUN_SPEEDS) : DEFAULT_RUN_SPEEDS
  );
  const [timingDirty, setTimingDirty] = useState(false);
  const [speedsDirty, setSpeedsDirty] = useState(false);
  const [activeSpeedPreset, setActiveSpeedPreset] = useState<PresetLevel | null>(() =>
    existing && existing.mode !== 'circuit' && existing.runSpeeds
      ? findMatchingSpeedPreset(existing.runSpeeds) : null
  );

  // Change tracking refs for coordinator-owned state
  const initialName        = useRef(existing?.name ?? '').current;
  const initialIntervals   = useRef(
    existing?.mode === 'advanced' || existing?.mode === 'circuit' ? existing.intervals : []
  ).current;
  const initialActivityType = useRef(
    existing && existing.mode !== 'circuit' ? existing.activityType : undefined
  ).current;
  const initialRunSpeeds   = useRef(
    existing && existing.mode !== 'circuit' ? (existing.runSpeeds ?? DEFAULT_RUN_SPEEDS) : DEFAULT_RUN_SPEEDS
  ).current;

  // Mode sub-hooks
  const easyEdit    = useEasyModeEdit(existing);
  const circuitEdit = useCircuitModeEdit(existing);
  const advanced    = useAdvancedModeEdit();

  const pickerState = usePickerState(
    intervals,
    easyEdit.fieldValues,
    {
      warmup:   circuitEdit.circuitWarmup,
      cooldown: circuitEdit.circuitCooldown,
      rest:     circuitEdit.circuitRest,
      count:    circuitEdit.circuitCount,
    },
    (result) => {
      if (result.type === 'rounds') {
        easyEdit.setRounds(result.value);
        setTimingDirty(true);
      } else if (result.type === 'field') {
        easyEdit.setField(result.field, result.secs);
        setTimingDirty(true);
      } else if (result.type === 'speed') {
        setRunSpeed(result.field, result.kmh);
      } else if (result.type === 'intervalSpeed') {
        setIntervals(ivs =>
          ivs.map(iv => iv._key === result.key ? { ...iv, speed: result.kmh } : iv)
        );
      } else if (result.type === 'circuitWarmup') {
        circuitEdit.set('warmup', result.secs);
        setTimingDirty(true);
      } else if (result.type === 'circuitCooldown') {
        circuitEdit.set('cooldown', result.secs);
        setTimingDirty(true);
      } else if (result.type === 'circuitRest') {
        circuitEdit.set('rest', result.secs);
        setTimingDirty(true);
      } else if (result.type === 'circuitCount') {
        circuitEdit.set('count', result.value);
        setTimingDirty(true);
      } else {
        // type === 'interval'
        setIntervals(ivs =>
          ivs.map(iv => iv._key === result.key ? { ...iv, dur: result.secs } : iv)
        );
        setTimingDirty(true);
      }
    },
  );

  function setRunSpeed(field: keyof RunSpeeds, value: number) {
    setRunSpeeds(prev => ({ ...prev, [field]: value }));
    setSpeedsDirty(true);
    setActiveSpeedPreset(null);
  }

  function resetToDefaults(type: 'general' | 'run' | 'circuit') {
    setName('');
    setIntervals([]);
    setTimingDirty(false);
    if (type === 'circuit') {
      setMode('circuit');
      setActivityType(undefined);
      circuitEdit.reset();
    } else {
      setMode('easy');
      setActivityType(type === 'run' ? 'run' : undefined);
      setSpeedsDirty(false);
      setActiveSpeedPreset(null);
      easyEdit.reset();
    }
  }

  function setDisplayActivityType(type: 'general' | 'run' | 'circuit') {
    const currentType = mode === 'circuit' ? 'circuit' : activityType === 'run' ? 'run' : 'general';
    if (currentType === type) return;
    if (!hasChanges) {
      resetToDefaults(type);
      return;
    }
    Alert.alert(
      i18n.t('alerts.switchTypeTitle'),
      i18n.t('alerts.switchTypeMessage'),
      [
        { text: i18n.t('alerts.cancel'), style: 'cancel' },
        { text: i18n.t('alerts.discard'), style: 'destructive', onPress: () => resetToDefaults(type) },
      ],
    );
  }

  const previewSegments = useMemo(() => {
    const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
    if (mode === 'circuit') {
      return expandCircuit(cleanIntervals, circuitEdit.circuitCount, circuitEdit.circuitWarmup, circuitEdit.circuitCooldown, circuitEdit.circuitRest);
    }
    const draft: Session = mode === 'easy'
      ? { id: '', name: '', mode: 'easy', config: easyEdit.easyConfig, activityType, runSpeeds }
      : { id: '', name: '', mode: 'advanced', intervals: cleanIntervals, activityType, runSpeeds };
    return getSessionSegments(draft);
  }, [mode, easyEdit.fieldValues, easyEdit.rounds, intervals, activityType, runSpeeds,
      circuitEdit.circuitWarmup, circuitEdit.circuitCooldown, circuitEdit.circuitCount, circuitEdit.circuitRest]);

  function toggleMode(advanced_: boolean) {
    if (advanced_) {
      if (intervals.length === 0) {
        setIntervals(advanced.buildFromEasy(easyEdit.easyConfig));
      }
      setMode('advanced');
    } else {
      const result = advanced.tryConvertToEasy(intervals);
      if (!result.ok) {
        Alert.alert(
          i18n.t('alerts.cannotSwitchEasyTitle'),
          i18n.t(result.reasonKey, result.reasonParams?.phase !== undefined
            ? { ...result.reasonParams, phase: i18n.t('phases.' + result.reasonParams.phase) }
            : result.reasonParams),
        );
        return;
      }
      easyEdit.setField('warmup', result.warmup);
      easyEdit.setField('cooldown', result.cooldown);
      easyEdit.setField('work', result.work);
      easyEdit.setField('rest', result.rest);
      easyEdit.setRounds(result.rounds);
      setMode('easy');
    }
  }

  function cyclePhase(key: string) {
    setTimingDirty(true);
    const phases = mode === 'circuit' ? CIRCUIT_PHASES : PHASES;
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
    setTimingDirty(true);
    const last = [...intervals].reverse().find(iv => iv.type === type);
    setIntervals(ivs => [...ivs, toLocal({
      type,
      dur:           last?.dur ?? 30,
      activityLabel: last?.activityLabel,
    })]);
  }

  function duplicateInterval(key: string) {
    setTimingDirty(true);
    setIntervals(ivs => {
      const idx = ivs.findIndex(iv => iv._key === key);
      if (idx === -1) return ivs;
      const copy = toLocal(ivs[idx]);
      return [...ivs.slice(0, idx + 1), copy, ...ivs.slice(idx + 1)];
    });
  }

  function removeInterval(key: string) {
    setTimingDirty(true);
    setIntervals(ivs => ivs.filter(iv => iv._key !== key));
  }

  function applyDurationPreset(level: PresetLevel) {
    const p = DURATION_PRESETS[level];
    const doApply = () => {
      easyEdit.applyPresetValues(p.warmup, p.work, p.rest, p.rounds, p.cooldown, level);
      setTimingDirty(false);
      if (mode === 'advanced') {
        const config = { warmup: p.warmup, high: Math.max(1, p.work), low: p.rest, rounds: Math.max(1, p.rounds), cooldown: p.cooldown };
        setIntervals(advanced.buildFromEasy(config));
      }
    };
    if (timingDirty) {
      Alert.alert(
        i18n.t('alerts.overwriteTitle'),
        i18n.t('alerts.overwriteTimingMessage'),
        [{ text: i18n.t('alerts.cancel'), style: 'cancel' }, { text: i18n.t('alerts.apply'), onPress: doApply }],
      );
    } else {
      doApply();
    }
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

  function openIntervalSpeedPicker(key: string, isMiles: boolean) {
    const iv = intervals.find(i => i._key === key);
    if (!iv) return;
    const kmh = iv.speed ?? speedForPhase(iv.type, runSpeeds);
    const displayVal = isMiles ? convertKmhToMph(kmh) : kmh;
    pickerState.openIntervalSpeedPicker(key, displayVal, isMiles);
  }

  function clearIntervalSpeed(key: string) {
    setIntervals(ivs =>
      ivs.map(iv => iv._key === key ? { ...iv, speed: undefined } : iv)
    );
  }

  function setActivityLabel(key: string, label: string) {
    setIntervals(ivs => ivs.map(iv =>
      iv._key === key ? { ...iv, activityLabel: label } : iv
    ));
  }

  function buildSavePayload(): SavePayload {
    if (mode === 'circuit') {
      if (!name.trim()) {
        return { ok: false, titleKey: 'alerts.nameRequiredTitle', messageKey: 'alerts.nameRequiredMessage' };
      }
      const hasWork = intervals.some(iv => iv.type === 'work');
      if (!hasWork) {
        return { ok: false, titleKey: 'alerts.noWorkIntervalsTitle', messageKey: 'alerts.noWorkIntervalsMessage' };
      }
      const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
      const session: Session = {
        id: existing?.id ?? newId(),
        name: name.trim(),
        mode: 'circuit',
        intervals: cleanIntervals,
        circuits:    circuitEdit.circuitCount,
        warmup:      circuitEdit.circuitWarmup,
        cooldown:    circuitEdit.circuitCooldown,
        circuitRest: circuitEdit.circuitRest,
      };
      return { ok: true, session, isNew: !existing };
    }
    const validation = validateDraft(name, mode, intervals);
    if (!validation.ok) {
      return { ok: false, titleKey: validation.titleKey, messageKey: validation.messageKey };
    }
    const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
    const session = buildSessionFromDraft(
      mode, name.trim(), easyEdit.easyConfig, cleanIntervals, activityType, runSpeeds, existing?.id,
    );
    return { ok: true, session, isNew: !existing };
  }

  const hasChanges = useMemo(() => {
    const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
    if (mode === 'circuit') {
      return circuitEdit.hasChanges
        || name !== initialName
        || JSON.stringify(cleanIntervals) !== JSON.stringify(initialIntervals);
    }
    return easyEdit.hasChanges
      || name !== initialName
      || JSON.stringify(cleanIntervals) !== JSON.stringify(initialIntervals)
      || activityType !== initialActivityType
      || JSON.stringify(runSpeeds) !== JSON.stringify(initialRunSpeeds);
  }, [
    mode, name, intervals, activityType, runSpeeds,
    easyEdit.hasChanges, circuitEdit.hasChanges,
    initialName, initialIntervals, initialActivityType, initialRunSpeeds,
  ]);

  const activeTimingPreset: PresetLevel | null = mode === 'advanced'
    ? findMatchingDurationPresetForIntervals(intervals.map(({ _key, ...iv }) => iv))
    : easyEdit.activeTimingPreset;

  const draft: EditSessionDraft = {
    name,
    isAdvanced:  mode === 'advanced',
    isCircuit:   mode === 'circuit',
    fieldValues: easyEdit.fieldValues,
    rounds:      easyEdit.rounds,
    intervals,
    previewSegments,
    previewTotal: totalDuration(previewSegments),
    activityType,
    runSpeeds,
    activeTimingPreset,
    activeSpeedPreset,
    hasChanges,
    circuitWarmup:   circuitEdit.circuitWarmup,
    circuitCooldown: circuitEdit.circuitCooldown,
    circuitRest:     circuitEdit.circuitRest,
    circuitCount:    circuitEdit.circuitCount,
  };

  return {
    draft,
    picker: pickerState.picker,
    setName,
    setActivityType,
    setDisplayActivityType,
    setRunSpeed,
    toggleMode,
    cyclePhase,
    addInterval,
    duplicateInterval,
    removeInterval,
    clearIntervals:   () => { setTimingDirty(true); setIntervals([]); },
    reorderIntervals: (data: LocalInterval[]) => { setTimingDirty(true); setIntervals(data); },
    openFieldPicker:  pickerState.openFieldPicker,
    openRoundsPicker: () => pickerState.openRoundsPicker(easyEdit.rounds),
    openIntervalPicker: pickerState.openIntervalPicker,
    openSpeedPicker:    pickerState.openSpeedPicker,
    openIntervalSpeedPicker,
    clearIntervalSpeed,
    updatePicker:    pickerState.updatePicker,
    commitPicker:    pickerState.commitPicker,
    dismissPicker:   pickerState.dismissPicker,
    applyDurationPreset,
    applySpeedPreset,
    setActivityLabel,
    openCircuitWarmupPicker:   pickerState.openCircuitWarmupPicker,
    openCircuitCooldownPicker: pickerState.openCircuitCooldownPicker,
    openCircuitRestPicker:     pickerState.openCircuitRestPicker,
    openCircuitsPicker:        pickerState.openCircuitCountPicker,
    buildSavePayload,
  };
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors. If there are import errors on `serializeDraft` (it's imported but no longer used in the coordinator), remove it.

- [ ] **Step 3: Manual verification — test all three session types**

```bash
npx expo start --ios
```

Check:
1. Open an easy session → edit → change a field → save → re-open: values persist
2. Toggle easy → advanced → confirm intervals built from easy fields; toggle back → fields restored
3. Apply a duration preset → confirm Alert only when fields were manually changed first
4. Open a circuit session → edit warmup/cooldown/circuits → save → re-open: values persist
5. Create a new circuit session from scratch: name it, add intervals, save
6. `hasChanges` is `false` on open, `true` after any edit, `false` after save+reopen

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useEditSession.ts
git commit -m "refactor(edit): wire mode sub-hooks in useEditSession coordinator"
```

---

## Self-review

**Spec coverage:**
- ✅ `useEasyModeEdit` owns easy field values, timing preset, hasChanges → Task 3
- ✅ `useCircuitModeEdit` owns circuit config values, hasChanges → Task 4
- ✅ `useAdvancedModeEdit` owns toggle utilities → Task 5
- ✅ `usePickerState` extracted to own file → Task 2
- ✅ `useEditSession` coordinator ~200 lines → Task 6
- ✅ `EditSessionInterface` / `EditSessionDraft` unchanged → verified in Task 6 Step 2
- ✅ `reset()` on both mode hooks → present in Tasks 3, 4 implementations
- ✅ Picker commit → mode hook setters wired → Task 6 `onCommit` callback
- ✅ `applyDurationPreset` calls `easyEdit.applyPresetValues` + conditionally rebuilds intervals → Task 6
- ✅ `activeTimingPreset` derived from intervals in advanced mode → Task 6 `activeTimingPreset` computation
- ✅ `hasChanges` ORs mode hook flags with coordinator-owned state → Task 6

**Type consistency:**
- `easyEdit.applyPresetValues(p.warmup, p.work, p.rest, p.rounds, p.cooldown, level)` matches Task 3 definition ✅
- `circuitEdit.set('warmup' | 'cooldown' | 'rest' | 'count', value)` matches Task 4 definition ✅
- `advanced.buildFromEasy(config)` matches Task 5 definition ✅
- `pickerState.openCircuitCountPicker` exposed as `openCircuitsPicker` — matches existing interface ✅
