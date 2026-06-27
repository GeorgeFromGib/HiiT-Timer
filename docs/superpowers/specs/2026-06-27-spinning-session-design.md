# Spinning Session Type — Design Spec

## Overview

Add a `spinning` activity type to the app, parallel to `run`. Spinning sessions track **resistance** (1–10) and **power** (40–300W in 10W steps) per phase, with per-interval overrides in advanced mode. Easy and advanced modes mirror the run type's structure.

---

## Data Model

### `SpinValues` (new, `src/lib/sessions.ts`)

```ts
export interface SpinValues {
  warmupResistance:   number;
  warmupPower:        number;
  workResistance:     number;
  workPower:          number;
  restResistance:     number;
  restPower:          number;
  cooldownResistance: number;
  cooldownPower:      number;
}

export const DEFAULT_SPIN_VALUES: SpinValues = {
  warmupResistance:   3,  warmupPower:   100,
  workResistance:     7,  workPower:     200,
  restResistance:     3,  restPower:     100,
  cooldownResistance: 2,  cooldownPower: 80,
};
```

### Session Union

The two existing easy/advanced variants gain `activityType?: 'run' | 'spinning'` and `spinValues?: SpinValues` alongside the existing `runSpeeds?`:

```ts
export type Session =
  | { id: string; name: string; activityType?: 'run' | 'spinning'; runSpeeds?: RunSpeeds; spinValues?: SpinValues; mode: 'easy'; config: WorkoutConfig }
  | { id: string; name: string; activityType?: 'run' | 'spinning'; runSpeeds?: RunSpeeds; spinValues?: SpinValues; mode: 'advanced'; intervals: Interval[] }
  | { id: string; name: string; mode: 'circuit'; intervals: Interval[]; circuits: number; warmup: number; cooldown: number; circuitRest: number };
```

### `Interval` (extended, `src/lib/workout.ts`)

```ts
resistance?: number;  // per-interval override, advanced mode only
power?:      number;  // per-interval override, advanced mode only
```

### `Segment` (extended, `src/lib/workout.ts`)

```ts
resistance?: number;  // resolved value for display on workout screen
power?:      number;
```

### `getSessionSegments` (`src/lib/sessions.ts`)

For spinning sessions, resolve resistance and power onto each segment — mirrors the run speed resolution logic:
- Advanced: `seg.resistance = interval.resistance ?? spinValueForPhase(seg.phase, spinValues)`
- Easy: `seg.resistance = spinValueForPhase(seg.phase, spinValues)`

Helper returns both values as an object (avoids calling the helper twice per segment — contrast with `speedForPhase` which returns a single `number`):
```ts
export function spinValueForPhase(phase: Phase, values: SpinValues): { resistance: number; power: number }
```

---

## Picker Definitions

| Field      | Values                          | Wheel columns | Unit label |
|------------|---------------------------------|---------------|------------|
| Resistance | 1, 2, 3 … 10                    | 1             | —          |
| Power      | 40, 50, 60 … 300 (10W steps)   | 1             | `W`        |

Both use the existing `PickerModal` with `isResistance` and `isPower` boolean flags, following the same pattern as the existing `isSpeed` and `isRounds` flags. Note: if a fifth picker type is ever added, migrating to a `kind` enum would be cleaner — but that's out of scope here.

---

## Edit Screen — Easy Mode

Below the timing grid (warmup/work/rest/cooldown), spinning sessions show two additional grids:

1. **Resistance grid** — section label "Resistance", four cells (warmup / work / rest / cooldown), each tappable, opens resistance picker.
2. **Power grid** — section label "Power (W)", four cells, each tappable, opens power picker.

Layout mirrors the existing speed grid in run easy mode.

---

## Edit Screen — Advanced Mode

Each interval card row (left → right):

```
[drag handle] [phase pill] [duration] [resistance chip] [power chip]
```

- **Resistance chip**: tappable → opens resistance picker. Long-press clears to phase default.
- **Power chip**: tappable → opens power picker. Long-press clears to phase default.
- Values displayed as plain numbers: `7` for resistance, `200W` for power.
- Phase defaults are read from `spinValues` stored on the session draft.

`IntervalRow` gains **6** new optional props: `displayResistance`, `onOpenResistancePicker`, `onClearResistance`, `displayPower`, `onOpenPowerPicker`, `onClearPower` — wired only when `activityType === 'spinning'`.

---

## Workout Screen

During a spinning session, the current segment's resistance and power are shown beneath the main countdown, in a two-value row:

```
R 7        200 W
```

This row only renders when `activeSegment.resistance !== undefined` (i.e. spinning sessions only). Labels are small and uppercase; values use the `ChakraPetch_700Bold` font consistent with the rest of the workout screen. Values update on each segment transition. The workout screen reads `activeSegment.resistance` and `activeSegment.power` — no additional state required.

---

## Locale Keys (all three languages)

New keys under `edit`:
- `spinning` — display name ("Spinning" / "Spinning" / "Spinning")
- `newSpinningTitle` — editor header for new sessions ("New Spinning" / "Nueva Spinning" / "Nouveau Spinning") — mirrors `newCircuitTitle`
- `spinResistance` — grid label ("Resistance" / "Resistencia" / "Résistance")
- `spinPower` — grid label ("Power" / "Potencia" / "Puissance")

New key under `picker`:
- `resistanceTitle` — picker header ("Resistance")
- `powerTitle` — picker header ("Power")

---

## Default Session

`DEFAULT_SESSIONS` in `sessions.ts` gains one spinning entry — easy mode, name "Spinning Session", using `DEFAULT_SPIN_VALUES`. This ensures the sessions list is non-empty on first launch.

---

## Navigation

`SessionsListScreen` type menu gains a fourth option: **Spinning** → navigates to `EditSession` with `activityType: 'spinning'`.

`EditSessionScreen` route params already accept `activityType: 'general' | 'run' | 'circuit'` — extended to include `'spinning'`.

---

## Presets

Deferred. Manual entry only for now. Preset strip will be added in a follow-up once values are supplied.

---

## Success Criteria

- A spinning session created in easy mode saves and reloads with correct `activityType: 'spinning'`, `spinValues`, and mode.
- `getSessionSegments` resolves `resistance` and `power` onto every segment using phase defaults; per-interval overrides in advanced mode take precedence.
- Workout screen displays correct resistance and power for each segment as it transitions; the row is absent for non-spinning sessions.
- Easy mode grid shows all eight cells (4 phases × resistance + power) and picker wheels open/commit correctly.
- Advanced mode interval cards show resistance and power chips; long-press clears to phase default.
- Session card on the list shows "Spinning" as the type label.

---

## Out of Scope

- Spinning-specific audio cues
- Per-interval resistance/power in easy mode (phase-level only)
- Spinning presets (deferred)
