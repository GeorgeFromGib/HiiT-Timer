# Design: Split `useEditSession` by Mode

**Date:** 2026-06-26
**Branch:** circuit
**Goal:** Reduce the 700-line `useEditSession` hook to a thin coordinator by extracting per-mode state into focused sub-hooks.

---

## Problem

`useEditSession` manages state for three session modes (easy, advanced, circuit) in a single 700-line file. The `EditSessionDraft` interface is a union of all three modes' fields. A reader must understand all three modes to change any one of them.

---

## Solution

Extract per-mode state into three focused sub-hooks. Move `usePickerState` to its own file. The parent `useEditSession` becomes a coordinator (~200 lines).

### File layout

```
src/hooks/
  useEasyModeEdit.ts      ~120 lines  easy field values + timing preset
  useCircuitModeEdit.ts   ~60 lines   circuit config values
  useAdvancedModeEdit.ts  ~40 lines   easy↔advanced toggle utilities (no state)
  usePickerState.ts       ~160 lines  picker modal state (extracted from useEditSession)
  useEditSession.ts       ~200 lines  coordinator (down from 700)
```

The public `EditSessionInterface` and `EditSessionDraft` types are **unchanged** — this is an internal refactor only. `EditSessionScreen` keeps its existing imports.

---

## Module ownership

| Module | Owns | Does NOT own |
|---|---|---|
| `useEasyModeEdit` | warmup/work/rest/rounds/cooldown, timingDirty, activeTimingPreset | intervals, mode, picker |
| `useCircuitModeEdit` | circuitWarmup/cooldown/rest/count | intervals, picker |
| `useAdvancedModeEdit` | nothing — pure utilities | all state |
| `usePickerState` | picker open/close/value/commit state | what to do after commit |
| `useEditSession` | name, mode, intervals, activityType, runSpeeds, hasChanges | per-mode field values |

---

## Module interfaces

### `useEasyModeEdit(initial: Session | undefined)`

Called unconditionally — field values are used in both easy AND advanced modes.

```ts
interface EasyModeEdit {
  fieldValues:         Record<TimeField, number>;
  rounds:              number;
  easyConfig:          WorkoutConfig;
  activeTimingPreset:  PresetLevel | null;
  hasChanges:          boolean;
  setField:            (field: TimeField, value: number) => void;
  setRounds:           (value: number) => void;
  applyDurationPreset: (level: PresetLevel, onApplied: (config: WorkoutConfig) => void) => void;
  reset:               () => void;  // sets fields to defaults, clears timingDirty + activeTimingPreset
}
```

- `setField` / `setRounds` manage `timingDirty` internally — the parent never touches it.
- `applyDurationPreset` shows the Alert when dirty, then calls `onApplied(config)` so the parent can sync intervals when `mode === 'advanced'`.
- `hasChanges` compares current field values to a frozen initial snapshot via `useMemo`.

### `useCircuitModeEdit(initial: Session | undefined)`

```ts
interface CircuitModeEdit {
  circuitWarmup:   number;
  circuitCooldown: number;
  circuitRest:     number;
  circuitCount:    number;
  hasChanges:      boolean;
  set:             (field: 'warmup' | 'cooldown' | 'rest' | 'count', value: number) => void;
  reset:           () => void;  // sets values back to defaults (60/60/30/3)
}
```

`hasChanges` compares current circuit config to a frozen initial snapshot.

### `useAdvancedModeEdit()`

No state. A named home for easy↔advanced toggle behavior.

```ts
interface AdvancedModeEdit {
  buildFromEasy:    (config: WorkoutConfig) => LocalInterval[];
  tryConvertToEasy: (intervals: LocalInterval[]) => ConvertResult;
}
```

Both functions delegate to existing helpers in `lib/workout.ts`.

### `usePickerState` (extracted, interface unchanged)

Moves to `src/hooks/usePickerState.ts`. Signature unchanged from today — receives `fieldValues` and `circuitValues` as arguments, fires `onCommit(result)` back to the parent.

---

## Key data flows

### Mode switching

```
toggleMode(advanced=true):
  if intervals.length === 0 → setIntervals(advanced.buildFromEasy(easyEdit.easyConfig))
  setMode('advanced')

toggleMode(advanced=false):
  result = advanced.tryConvertToEasy(intervals)
  if !result.ok → Alert, no state change
  else → easyEdit.setField(each field); setMode('easy')

setDisplayActivityType(type):
  if !hasChanges → resetToDefaults(type)
  else → Alert(discard?) → resetToDefaults(type)

resetToDefaults('circuit'):       setMode('circuit'); circuitEdit.reset(); setIntervals([])
resetToDefaults('general'|'run'): setMode('easy'); easyEdit.reset(); setIntervals([])
```

### Picker commit → mode hook state

```
onPickerCommit(result):
  'field'           → easyEdit.setField(result.field, result.secs)
  'rounds'          → easyEdit.setRounds(result.value)
  'interval'        → setIntervals(ivs.map update dur)
  'intervalSpeed'   → setIntervals(ivs.map update speed)
  'speed'           → setRunSpeed(result.field, result.kmh)
  'circuitWarmup'   → circuitEdit.set('warmup', result.secs)
  'circuitCooldown' → circuitEdit.set('cooldown', result.secs)
  'circuitRest'     → circuitEdit.set('rest', result.secs)
  'circuitCount'    → circuitEdit.set('count', result.value)
```

### `hasChanges` in the parent

Each mode hook stores a frozen initial snapshot (`useRef`) and exposes `hasChanges: boolean`. The parent ORs them, using only the active mode's hook:

```
mode === 'circuit':
  circuitEdit.hasChanges || name !== initialName || intervals !== initialIntervals

otherwise:
  easyEdit.hasChanges || name !== initialName || intervals !== initialIntervals
  || activityType !== initial || runSpeeds !== initial
```

### `activeTimingPreset` in the parent

```
mode === 'advanced' → findMatchingDurationPresetForIntervals(intervals)  // derived, not stored
otherwise           → easyEdit.activeTimingPreset                        // from hook state
```

### `previewSegments`

`useMemo` in parent — same logic as today, pulling `easyEdit.easyConfig` and `circuitEdit.*` values.

### `buildSavePayload`

Parent dispatches to mode-appropriate logic — same as today, pulling `easyEdit.easyConfig` for easy/advanced and `circuitEdit.*` values for circuit.

---

## What does NOT change

- `EditSessionInterface` — public interface the screen uses
- `EditSessionDraft` — shape the screen reads
- `EditSessionPicker` — picker modal shape
- `EditSessionScreen.tsx` — no import changes
- All types in `useEditSession.ts` that are exported and used by the screen

---

## Verification

No test framework is configured. Verification is TypeScript (`npx tsc --noEmit`) plus manual runtime check that the edit screen works for all three session types (easy, advanced, circuit) after the refactor.
