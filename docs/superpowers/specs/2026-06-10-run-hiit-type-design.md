# Run HIIT Type — Design Spec

## Overview

Add "Run" as an activity type to the HIIT timer app. A Run session is not a new setup mode — Easy and Advanced remain the modes for configuring timing. Run is an orthogonal concept: it means the session includes treadmill speed targets, one per phase (warmup, work, rest, cooldown). Speeds are stored in km/h and displayed in the user's chosen unit (km/h or mph).

---

## Data Model

### `RunSpeeds` (new, in `src/lib/sessions.ts`)

```ts
export interface RunSpeeds {
  warmupSpeed: number;   // km/h
  workSpeed: number;     // km/h
  restSpeed: number;     // km/h
  cooldownSpeed: number; // km/h
}
```

Default values (from design/default-presets.md, Easy level):

| Phase    | Default (km/h) |
|----------|---------------|
| Warmup   | 5.0           |
| Work     | 8.0           |
| Rest     | 5.0           |
| Cooldown | 4.5           |

### `Session` (updated, `src/lib/sessions.ts`)

Two new optional top-level fields added to the existing type. Both are present together or absent together.

```ts
export type Session = {
  id: string;
  name: string;
  activityType?: 'run';
  runSpeeds?: RunSpeeds;
} & (
  | { mode: 'easy'; config: WorkoutConfig }
  | { mode: 'advanced'; intervals: Interval[] }
);
```

`activityType` and `runSpeeds` are independent of `mode`. A Run session can use either Easy or Advanced timing.

### `Segment` (updated, `src/lib/workout.ts`)

One new optional field:

```ts
export interface Segment {
  phase: Phase;
  label: string;
  duration: number;
  startAt: number;
  endAt: number;
  index: number;
  speed?: number; // km/h — only present for run sessions
}
```

### `getSessionSegments` (updated, `src/lib/sessions.ts`)

When a session has `activityType === 'run'` and `runSpeeds`, each segment is stamped with its phase speed after segments are generated:

```ts
// pseudo-code
segments = generateSegments(session);
if (session.activityType === 'run' && session.runSpeeds) {
  segments = segments.map(seg => ({
    ...seg,
    speed: speedForPhase(seg.phase, session.runSpeeds),
  }));
}
```

`speedForPhase` maps `warmup → warmupSpeed`, `work → workSpeed`, `rest → restSpeed`, `cooldown → cooldownSpeed`.

---

## Speed Formatting Helper

New function in `src/lib/workout.ts`:

```ts
export function fmtSpeed(kmh: number, unit: 'km' | 'miles'): string
```

- `'km'` → `"8 km/h"`, `"4.5 km/h"`
- `'miles'` → nearest 0.5 mph via `Math.round(kmh * 0.621371 * 2) / 2`, e.g. `"5.0 mph"`, `"3.0 mph"`

---

## Settings

### `Settings` (updated, `src/lib/settings.ts`)

```ts
export interface Settings {
  // ... existing fields ...
  speedUnit: 'km' | 'miles'; // default: 'km'
}
```

Added to `DEFAULT_SETTINGS`: `speedUnit: 'km'`.

### SettingsScreen

New toggle row in the existing settings list:

- **Label:** "Speed Unit"
- **Sub-label:** "km/h or mph (for Run sessions)"
- **Control:** two-button selector — `km/h` / `mph`

---

## Edit Session Screen

### New "ACTIVITY TYPE" section

Appears between the session name and the setup mode toggle. Two tappable buttons: **General** (default) and **Run**. Tapping Run selects it and reveals the SPEEDS section below TIMING.

```
SESSION NAME
ACTIVITY TYPE   [General]  [Run ✓]
SETUP MODE      Easy ◉ ── Advanced
TIMING          warmup / work / rest / cooldown / rounds
SPEEDS          warmup / work / rest / cooldown  ← only when Run selected
PREVIEW
SAVE
```

### SPEEDS section

Four numeric inputs (one per phase), matching the visual style of the TIMING grid cells. Values are always stored and displayed in km/h — the unit label inside the input is always "km/h". Editing opens a `TextInput` with a decimal numeric keyboard (not the picker wheel, since speeds are decimal values like 4.5). The `speedUnit` setting only affects the workout screen pill — not the edit form.

### State in `useEditSession`

- `activityType: 'run' | undefined` — toggled by the Activity Type selector
- `runSpeeds: RunSpeeds` — always initialised to defaults; only persisted when `activityType === 'run'`

When saving: if `activityType !== 'run'`, omit `runSpeeds` from the saved session.

---

## Workout Screen

### Speed pill

When `seg.speed` is defined, render a speed pill between the phase label and the countdown number:

```
[🔥 icon]
 WORK
[8 km/h]        ← pill, phase-coloured, only for run sessions
  20
INTERVAL 3 OF 16
```

Pill style: `background: phaseColor @ 13% opacity`, `border: 1.5px phaseColor @ 35% opacity`, rounded pill shape, `fmtSpeed(seg.speed, settings.speedUnit)` as text.

When `seg.speed` is absent (non-Run session), the pill is not rendered — no layout shift, no empty space.

---

## Default Sessions

Add one default Run session to `DEFAULT_SESSIONS`:

```ts
{
  id: 'default-run-1',
  name: 'Easy Run',
  mode: 'easy',
  activityType: 'run',
  config: { warmup: 180, high: 20, low: 40, rounds: 14, cooldown: 180 },
  runSpeeds: { warmupSpeed: 5, workSpeed: 8, restSpeed: 5, cooldownSpeed: 4.5 },
}
```

---

## What Is Not In Scope

- Per-interval speeds for Advanced mode (speeds are phase-level, applied uniformly to all intervals of the same phase)
- Additional activity types beyond Run
- Speed-based session analytics or distance tracking
