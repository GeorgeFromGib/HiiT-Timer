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

Add `activityLabel` and `circuitNumber` to `Segment` (populated only for circuit sessions):

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
  | { id: string; name: string; mode: 'circuit'; intervals: Interval[]; circuits: number; warmup: number; cooldown: number };
```

`intervals` contains **only work and rest phases**. `warmup` and `cooldown` are durations in seconds (0 = disabled). The `intervals` array never contains warmup or cooldown typed intervals for circuit sessions.

### `getSessionSegments` expansion for circuit mode

Structure: `[warmup?] + ([circuit block] × circuits) + [cooldown?]`

- If `warmup > 0`, prepend a warmup segment.
- Repeat the full `intervals` array `circuits` times. Each segment in the repeated block gets `circuitNumber` set to the 1-indexed repeat number (1, 2, 3…).
- If `cooldown > 0`, append a cooldown segment.
- `activityLabel` is copied from each interval onto its corresponding segment.
- No detection logic required — warmup and cooldown are never in `intervals`.

### Verification

- A session with `warmup: 60`, `cooldown: 60`, `circuits: 3`, and 2 work+rest pairs in `intervals` produces `1 + (4 × 3) + 1 = 14` segments.
- `circuitNumber` is 1–3 on the 12 middle segments, `undefined` on the warmup and cooldown segments.

---

## Editor — `EditSessionScreen` + `useEditSession`

When `session.mode === 'circuit'` (or when creating a new circuit session), the screen renders the circuit form. The mode toggle, activity type selector, and all speed fields are hidden.

### Form layout (top to bottom)

1. **Name field** — unchanged
2. **Preview strip** — unchanged; segments are expanded from the current draft for display
3. **Config grid** — three tappable picker cells in the same style as easy mode's config grid:
   - **Warmup** — duration in seconds (0 = none), opens `PickerModal`
   - **Cooldown** — duration in seconds (0 = none), opens `PickerModal`
   - **Circuits** — integer 1–20, opens `PickerModal`
4. **Interval list** — draggable/swipeable list containing only work and rest phases. Work phase rows display a `TextInput` for the exercise label inside `IntervalSwipeRow` (not inside `IntervalRow`). Rest rows show no label input.
5. **Add interval button** — unchanged; new intervals default to `work` type
6. **Save / Cancel** — unchanged; no preset strips

### Work phase row (inside `IntervalSwipeRow`)

- Phase pill (tappable to cycle between `work` and `rest` only — warmup/cooldown not selectable) 
- `TextInput` for `activityLabel` (placeholder: "Exercise name") — rendered only when `type === 'work'`
- Duration tappable — unchanged
- Drag handle + swipe actions — unchanged

### `useEditSession` additions

| Addition | Detail |
|---|---|
| `isCircuit` flag | derived from mode on init |
| `warmup: number` in draft | default 60 |
| `cooldown: number` in draft | default 60 |
| `circuits: number` in draft | default 3 |
| `setActivityLabel(key, label)` | updates `activityLabel` on a `LocalInterval` |
| `buildSavePayload` | produces `{ mode: 'circuit', intervals, circuits, warmup, cooldown }` |

### Validation

- Name must not be empty
- At least one `work` interval required
- `circuits` ≥ 1

---

## WorkoutScreen

All changes are conditional on `session.mode === 'circuit'`. No structural changes to the screen.

### Activity label pill

Rendered in the same position as the speed pill (below the phase label), when `seg.activityLabel` is defined. Identical visual style: phase-coloured border and background, bold text.

The `nextUpRow` also shows `seg.activityLabel` alongside the next phase name when the next segment has one.

### Circuit indicator

The `extendRow` (which holds `+5s`, `+10s`, `+1 round` for other modes) is replaced for circuit sessions with a centred text label:

```
CIRCUIT 2 / 3
```

Styled identically to the existing `intervalCounter`. The current circuit number comes from `seg.circuitNumber`; total circuits comes from `session.circuits`.

For warmup and cooldown segments (`circuitNumber === undefined`), this area is hidden.

### Verification

- During a work phase in circuit 2 of 3, the phase label pill shows the `activityLabel` text and the circuit indicator reads "CIRCUIT 2 / 3".
- During warmup and cooldown, the circuit indicator area is not visible.
- The extend row (`+5s`, `+10s`, `+1 round`) is never rendered for circuit sessions.

### Unchanged

Skip, reset, timeline strip, play/pause controls, phase block, next-up row, and `SessionCompleteScreen` all behave identically to existing modes.

---

## Sessions List

No changes. Circuit sessions display on the existing `SessionCard` with the same duration and interval count metadata.

---

## Default Sessions

Add one example circuit session to `getDefaultSessions` so the feature is immediately visible on first launch:

```ts
{
  id: 'default-circuit-1',
  name: 'Body Weight Circuit',
  mode: 'circuit',
  circuits: 3,
  warmup: 60,
  cooldown: 60,
  intervals: [
    { type: 'work', dur: 40, activityLabel: 'Push-ups' },
    { type: 'rest', dur: 20 },
    { type: 'work', dur: 40, activityLabel: 'Squats' },
    { type: 'rest', dur: 20 },
    { type: 'work', dur: 40, activityLabel: 'Plank' },
    { type: 'rest', dur: 20 },
  ],
}
```

---

## File Change Summary

| File | Change |
|---|---|
| `src/lib/workout.ts` | Add `activityLabel` to `Interval`; add `activityLabel`, `circuitNumber` to `Segment`; add `expandCircuit()` function |
| `src/lib/sessions.ts` | Extend `Session` union with `warmup`/`cooldown` fields; update `getSessionSegments`; add default circuit session |
| `src/hooks/useEditSession.ts` | Add `isCircuit`, `warmup`, `cooldown`, `circuits`, `setActivityLabel`; update `buildSavePayload` |
| `src/screens/EditSessionScreen.tsx` | Render circuit form branch; add warmup/cooldown/circuits config grid; add label `TextInput` inside `IntervalSwipeRow` for work rows; restrict phase cycling to work/rest only |
| `src/screens/WorkoutScreen.tsx` | Render activity label pill; replace extend row with circuit indicator |
