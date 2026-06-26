# Circuit Session — Design Spec

Date: 2026-06-26  
Branch: `circuit`

---

## Overview

Introduce a third session mode — `circuit` — alongside the existing `easy` and `advanced` modes. A circuit session lets the user build a named sequence of exercises (work phases with activity labels, optional rest phases) that repeats a configurable number of times, bracketed by a single warmup and cooldown.

No easy-mode toggle, no speeds, no run activity type.

---

## Data Model

### `workout.ts`

Add `activityLabel` to the existing `Interval` type (used only by circuit work phases):

```ts
export interface Interval {
  type: Phase;
  dur: number;
  speed?: number;
  activityLabel?: string; // circuit work phases only
}
```

Add `circuitNumber` to `Segment` (populated only for circuit sessions):

```ts
export interface Segment {
  phase: Phase;
  label: string;
  duration: number;
  startAt: number;
  endAt: number;
  index: number;
  speed?: number;
  activityLabel?: string;
  circuitNumber?: number; // 1-indexed; undefined for warmup/cooldown segments
}
```

### `sessions.ts`

Extend the `Session` union with a third member:

```ts
export type Session =
  | { id: string; name: string; activityType?: 'run'; runSpeeds?: RunSpeeds; mode: 'easy'; config: WorkoutConfig }
  | { id: string; name: string; activityType?: 'run'; runSpeeds?: RunSpeeds; mode: 'advanced'; intervals: Interval[] }
  | { id: string; name: string; mode: 'circuit'; intervals: Interval[]; circuits: number };
```

### `getSessionSegments` expansion for circuit mode

Structure: `[warmup?] + ([circuit block] × circuits) + [cooldown?]`

- The circuit block is every interval that is not the leading `warmup` or trailing `cooldown`.
- `activityLabel` is copied from each interval onto its corresponding segment.
- `circuitNumber` is set to the 1-indexed repeat number for each segment in the repeated block; warmup and cooldown segments get `circuitNumber: undefined`.

---

## Editor — `EditSessionScreen` + `useEditSession`

When `session.mode === 'circuit'` (or when creating a new circuit session), the screen renders the circuit form. The mode toggle, activity type selector, and all speed fields are hidden.

### Form layout (top to bottom)

1. **Name field** — unchanged
2. **Preview strip** — unchanged; segments are expanded from the current draft for display
3. **Circuits picker** — tappable field labelled "Circuits", value e.g. `3`. Opens the existing `PickerModal` wheel with range 1–20
4. **Interval list** — same draggable/swipeable list as advanced mode with one difference: work phase rows display a `TextInput` for the exercise label in place of the speed field
5. **Add interval button** — unchanged
6. **Save / Cancel** — unchanged; no preset strips

### Work phase row

- Phase pill (tappable to cycle phase) — unchanged
- `TextInput` for `activityLabel` (placeholder: "Exercise name") — visible only when `type === 'work'`; rest/warmup/cooldown rows show nothing in that slot
- Duration tappable — unchanged
- Drag handle + swipe actions — unchanged

### `useEditSession` additions

| Addition | Detail |
|---|---|
| `isCircuit` flag | derived from mode on init |
| `circuits: number` in draft | default 3 |
| `setActivityLabel(key, label)` | updates `activityLabel` on a `LocalInterval` |
| `buildSavePayload` | produces `{ mode: 'circuit', intervals, circuits }` |

### Validation

- Name must not be empty
- At least one `work` interval required
- `circuits` ≥ 1

---

## WorkoutScreen

All changes are conditional on `session.mode === 'circuit'`. No structural changes to the screen.

### Activity label pill

Rendered in the same position as the speed pill (below the phase label), when `seg.activityLabel` is defined and the session is in a work phase. Identical visual style: phase-coloured border and background, bold text.

The `nextUpRow` also shows `seg.activityLabel` alongside the next phase name when the next segment has one.

### Circuit indicator

The `extendRow` (which holds `+5s`, `+10s`, `+1 round` for other modes) is replaced for circuit sessions with a centred text label:

```
CIRCUIT 2 / 3
```

Styled identically to the existing `intervalCounter`. The current circuit number comes from `seg.circuitNumber`; total circuits comes from `session.circuits`.

For warmup and cooldown segments (`circuitNumber === undefined`), this row is empty / hidden.

### Unchanged

Skip, reset, timeline strip, play/pause controls, phase block, next-up row, and `SessionCompleteScreen` all behave identically to existing modes. The `extend` and `addRound` functions are never called (buttons removed), but their logic can remain untouched.

---

## Sessions List

No changes. Circuit sessions display on the existing `SessionCard` with the same duration and interval count metadata.

---

## Default Sessions

Add one example circuit session to `getDefaultSessions` so the feature is immediately visible on first launch.

Example:
```ts
{
  id: 'default-circuit-1',
  name: 'Body Weight Circuit',
  mode: 'circuit',
  circuits: 3,
  intervals: [
    { type: 'warmup',   dur: 60 },
    { type: 'work',     dur: 40, activityLabel: 'Push-ups' },
    { type: 'rest',     dur: 20 },
    { type: 'work',     dur: 40, activityLabel: 'Squats' },
    { type: 'rest',     dur: 20 },
    { type: 'work',     dur: 40, activityLabel: 'Plank' },
    { type: 'rest',     dur: 20 },
    { type: 'cooldown', dur: 60 },
  ],
}
```

---

## File Change Summary

| File | Change |
|---|---|
| `src/lib/workout.ts` | Add `activityLabel` to `Interval`; add `activityLabel`, `circuitNumber` to `Segment`; add `expandCircuit()` function |
| `src/lib/sessions.ts` | Extend `Session` union; update `getSessionSegments`; add default circuit session |
| `src/hooks/useEditSession.ts` | Add `isCircuit`, `circuits`, `setActivityLabel`, update `buildSavePayload` |
| `src/screens/EditSessionScreen.tsx` | Render circuit form branch; add label TextInput to work rows; add circuits picker |
| `src/screens/WorkoutScreen.tsx` | Render activity label pill; replace extend row with circuit indicator |
| `src/components/IntervalRow.tsx` | Accept and render optional `activityLabel` TextInput |
