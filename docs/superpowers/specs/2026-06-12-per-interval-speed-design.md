# Per-Interval Speed — Design Spec

**Date:** 2026-06-12
**Branch:** run-hiit

---

## Overview

Add an optional per-interval speed to advanced-mode run sessions. Each interval can override the session-level speed for its phase; intervals without an override fall back to the global `RunSpeeds` grid.

Scope: advanced mode, `activityType === 'run'` only.

---

## Data Model

### `src/lib/workout.ts`

`Interval` gains an optional speed field:

```ts
export interface Interval {
  type: Phase;
  dur:  number;   // seconds
  speed?: number; // km/h — run sessions only; overrides session-level RunSpeeds when set
}
```

`intervalsToSegments()` is unchanged — it does not handle speeds.

### `src/lib/sessions.ts`

`getSessionSegments()` currently applies a blanket `.map(seg => ({ ...seg, speed: speedForPhase(...) }))` over all segments for run sessions.

The new logic zips intervals with their resulting segments for the advanced path:

```
for each (interval, segment) pair:
  speed = interval.speed ?? speedForPhase(segment.phase, runSpeeds)
  segment.speed = speed
```

The easy-mode path is unchanged (no per-interval data; still uses `speedForPhase` for all segments).

No data migration: existing sessions without `speed` on intervals fall back silently.

---

## Hook — `src/hooks/useEditSession.ts`

### Types

`LocalInterval` extends `Interval` (already), so it picks up `speed?: number` automatically.

New `ActivePicker` variant:
```ts
| { type: 'intervalSpeed'; key: string; isMiles: boolean }
```

New `CommitResult` variant:
```ts
| { type: 'intervalSpeed'; key: string; kmh: number }
```

### New exported actions

| Method | Behaviour |
|--------|-----------|
| `openIntervalSpeedPicker(key: string)` | Reads `interval.speed` if set, otherwise reads `speedForPhase(interval.type, runSpeeds)` as the initial value. Opens the speed wheel pre-populated. |
| `clearIntervalSpeed(key: string)` | Sets `interval.speed = undefined`, restoring fallback behaviour. |

### Picker title

`"Interval N Speed"` — consistent with the existing `"Interval N"` title pattern.

### Commit handler

```ts
case 'intervalSpeed':
  setIntervals(ivs =>
    ivs.map(iv => iv._key === result.key ? { ...iv, speed: result.kmh } : iv)
  );
```

---

## UI — `src/screens/EditSessionScreen.tsx`

### Interval row layout

When `isRun && isAdvanced`, each interval row gains a speed value between the phase pill and the duration:

```
[drag handle]  [Phase Pill]  [speed]  [duration]
```

### Speed element

- Same style as the duration: `ChakraPetch_700Bold`, same font size, `T.text` color
- When the interval has no `speed` set (showing the phase fallback): `T.subText` color to indicate it is inherited
- Tapping opens `openIntervalSpeedPicker`
- Long-press calls `clearIntervalSpeed` (resets to fallback); triggers haptic feedback if `settings.hapticFeedback` is enabled

### Props threading

`IntervalSwipeRow` and `IntervalRow` receive two new optional props (only passed when `isRun`):
- `onOpenSpeedPicker?: () => void`
- `onClearSpeed?: () => void`

The screen computes the display value (converting km/h → mph when `isMiles`) and passes it as a `displaySpeed: string` prop to avoid duplicating unit logic in the row component.

### Global SPEEDS section

Unchanged — remains visible in advanced mode as the fallback source. No new behaviour.

---

## Touched files

| File | Change |
|------|--------|
| `src/lib/workout.ts` | Add `speed?: number` to `Interval` |
| `src/lib/sessions.ts` | Update `getSessionSegments` to use per-interval speed with phase fallback |
| `src/hooks/useEditSession.ts` | New `ActivePicker`/`CommitResult` variants, `openIntervalSpeedPicker`, `clearIntervalSpeed`, commit handler |
| `src/screens/EditSessionScreen.tsx` | Speed value in interval row, new props on `IntervalRow`/`IntervalSwipeRow` |

No new files required.