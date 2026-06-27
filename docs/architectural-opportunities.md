# Architectural Deepening Opportunities

Findings from the June 2026 architecture review. Candidate 1 (mode split in `useEditSession`) is being implemented separately.

---

## Candidate 2: Picker state leaking across the hook/modal seam

**Files:** `src/hooks/usePickerState.ts`, `src/components/PickerModal.tsx`

**Problem:** The picker's open/close/value/commit lifecycle is split across two modules. `usePickerState` holds which picker is open and what value is selected; `PickerModal` receives 4 callbacks (`onUpdate`, `onCommit`, `onCancel`, `onClose`) and calls back into the hook to mutate state. Two questions that should have one answer ("is the picker open?" and "what value is selected?") require tracing through both files. The seam leaks instead of separating concerns.

**Solution:** `usePickerState` already owns picker state — the remaining friction is the bidirectional callback surface. The fix is ensuring `PickerModal` receives a single self-contained `picker` prop (the `EditSessionPicker` shape) and a single `onCommit` callback, with no knowledge of which field is being edited. `usePickerState` handles all open/close/value transitions internally; the modal is a pure display component.

**Benefits:** Locality: all picker-open/close/commit logic in one module. `PickerModal` becomes testable as a pure component. The seam between session state and picker state is one-directional.

---

## Candidate 3: Speed unit as a scattered domain concept

**Files:** `src/screens/EditSessionScreen.tsx` (`getIntervalDisplaySpeed`), `src/hooks/useEditSession.ts` (speed picker open logic), inline render sites in `WorkoutScreen.tsx`

**Problem:** The conversion between stored km/h values and user-facing mph or km/h happens in at least three separate locations, each re-deriving the same formula. `SpeedUnit` is a named domain concept the app uses consistently, but no single module owns what a speed value *means* — its display format, its picker range, its conversion. Deletion test: delete the speed conversion in the screen → complexity reappears in the hook and vice versa.

**Solution:** A `speedUnit.ts` module in `src/lib/` with four pure functions:

```ts
export function toDisplay(kmh: number, unit: 'km' | 'miles'): number
export function fromDisplay(value: number, unit: 'km' | 'miles'): number
export function formatSpeed(kmh: number, unit: 'km' | 'miles'): string   // "12.5 km/h"
export function pickerRange(unit: 'km' | 'miles'): { min: number; max: number }
```

All speed-aware call sites import from one seam.

**Benefits:** One place to change if a third unit option is ever needed. Each call site shrinks to a single pure-function call. The module is trivially unit-testable once a test framework is configured. Locality: speed display bugs live in one file.

---

## Candidate 4: Draft change tracking via `JSON.stringify` snapshots

**Files:** `src/hooks/useEditSession.ts` (`hasChanges` memo, ~lines 640–648); similar pattern in `useCircuitModeEdit.ts` and `useEasyModeEdit.ts` after the mode split.

**Problem:** `hasChanges` is computed by serializing state to JSON and string-comparing it to a snapshot stored in a `useRef`. This runs on every render, is sensitive to key ordering in objects, and gives no locality: when the comparison says "changed," you don't know *what* changed. After the mode split, the same snapshot pattern is duplicated in three hook files.

**Solution:** A `useDraft<T>` hook that wraps a value with explicit commit/reset semantics:

```ts
const [draft, { isDirty, commit, reset }] = useDraft(initialValue)
```

It stores the pristine snapshot lazily (only serializes on first render and on `commit()`), exposes a stable `isDirty: boolean`, and removes the inline `JSON.stringify` comparisons from every consumer.

**Benefits:** Testable in complete isolation. Leverage: any future screen needing unsaved-changes detection reuses the same hook. Locality: all "is there unsaved work?" logic in one place. Removes three copies of the snapshot pattern introduced by the mode split.
