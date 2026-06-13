# Interval Presets Feature — Design Spec

**Date:** 2026-06-11
**Branch:** run-hiit

---

## Overview

Add Easy / Medium / Hard preset buttons to the Edit Session screen. Two independent preset selectors:

1. **Duration presets** — available on all session types; sets warmup, work, rest, rounds, and cooldown durations.
2. **Speed presets** — available only when activity type is Run; sets warmupSpeed, workSpeed, restSpeed, cooldownSpeed.

Both are one-shot: tapping a pill immediately fills values (no persistent highlight). If the user has manually edited values since opening the screen or last applying a preset, an overwrite alert is shown before applying.

---

## Preset Values

### Duration Presets

| Level  | Warmup | Work | Rest | Rounds | Cooldown |
|--------|--------|------|------|--------|----------|
| Easy   | 3 min  | 20 s | 40 s | 14     | 3 min    |
| Medium | 4 min  | 30 s | 30 s | 18     | 4 min    |
| Hard   | 5 min  | 45 s | 15 s | 22     | 5 min    |

### Speed Presets (Run only)

| Level  | Warmup | Work    | Rest   | Cooldown |
|--------|--------|---------|--------|----------|
| Easy   | 5 km/h | 10 km/h | 5 km/h | 4.5 km/h|
| Medium | 6 km/h | 12 km/h | 7 km/h | 5.5 km/h|
| Hard   | 7 km/h | 16 km/h | 9 km/h | 6 km/h  |

Source: `design/default-presets.md`. Warmup/cooldown durations derived from "3–5 min, scaling with fitness level" note.

---

## Architecture

### New file: `src/lib/presets.ts`

Exports `PresetLevel`, `DurationPreset`, `SpeedPreset`, `DURATION_PRESETS`, `SPEED_PRESETS`. Pure data — no side effects, no imports from elsewhere in the app.

### Changes to `src/hooks/useEditSession.ts`

**Dirty tracking:**

- `timingDirty: boolean` — starts `false`. Set to `true` on first manual edit of any timing field (warmup/work/rest/rounds/cooldown in Easy mode; any interval mutation in Advanced mode). Reset to `false` when a duration preset is applied.
- `speedsDirty: boolean` — same pattern for the four speed fields. Reset to `false` when a speed preset is applied.

**New exported actions:**

- `applyDurationPreset(level: PresetLevel): void` — checks `timingDirty`, shows overwrite alert if needed, then applies values.
- `applySpeedPreset(level: PresetLevel): void` — checks `speedsDirty`, shows overwrite alert if needed, then applies values.

**Advanced mode behaviour for duration preset:**

Calls existing `buildIntervalsFromEasy(presetConfig)` to generate the interval list, replacing current intervals. This reuses the same utility used when toggling Easy → Advanced mode.

### Changes to `src/screens/EditSessionScreen.tsx`

**Duration preset strip** — inserted directly below the `TIMING` section label (Easy mode) and below the `INTERVALS` section label (Advanced mode). Three pill buttons using the existing activity-type button style.

**Speed preset strip** — inserted directly below the `SPEEDS` section label. Only rendered when `isRun === true`.

No changes to `Session` type, `WorkoutConfig`, persistence layer, or any other screen.

---

## UI Behaviour

- Pills: ghost background, accent border + tint on press (standard button press feedback). No persistent active state.
- Overwrite alert copy: title `"Overwrite settings?"`, message `"Applying this preset will replace your current [timing / speed] settings."`, buttons: Cancel (no-op) and Apply (proceeds).
- After apply: values update immediately and the preview strip re-renders as normal (no extra logic needed — preview is already reactive to state).

---

## Out of Scope

- Persisting which preset was last applied to a session.
- Preset-derived speed values being set automatically when a duration preset is applied (speed presets are an independent choice).
- Any changes to the Workout screen, Sessions List screen, or data model.
