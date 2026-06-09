# Extend Current Interval (+15s) — Design Spec

## Overview

Add a "+0:15" button to the workout screen, placed below the segment progress bar, that adds 15 seconds to the currently active interval and extends the total session duration by the same amount.

## Architecture & Data Flow

`WorkoutScreen` holds `segments` as `useState` (converted from `useMemo`). Segments flow down through `useWorkoutSession` → `useTimerEngine` as before.

Inside `useTimerEngine`, `tick` switches from reading closed-over `segments`/`total` values to reading mutable `segmentsRef`/`totalRef` that are synced on every render. This means the running interval always sees the latest segment data without needing to be restarted.

A new `extend(seconds)` function rebuilds the segments array in the refs immediately. `WorkoutScreen` calls `extend(15)`, receives the new array, and calls `setSegments(newSegs)` — display updates on the next render, timer accuracy is unaffected.

```
handleExtend() in WorkoutScreen
  → extend(15) in useTimerEngine
      → rebuild segmentsRef.current + totalRef.current
      → return newSegments
  → setSegments(newSegments) in WorkoutScreen
```

## `useTimerEngine` Changes

1. Add `segmentsRef = useRef(segments)` and `totalRef = useRef(total)`, assigned at the top of the function body each render (not in an effect, so always current before any tick fires).
2. `tick`: reads `segmentsRef.current` and `totalRef.current` instead of closed-over values. `useCallback` dep array becomes `[]`.
3. `skip`: reads `segmentsRef.current` instead of `segments`. Remove `segments` from dep array.
4. `reset`: reads `totalRef.current` for the initial `remainingTotal` in the reset state. Remove `total` from dep array.
5. New `extend(seconds: number): Segment[]`:
   - Reads `segmentsRef.current` and current elapsed via `computeElapsed()`
   - Finds current index with `segmentIndexAt`
   - Returns early (no-op) if index is -1 (idle/finished)
   - Rebuilds array: current segment gets `duration + seconds` and `endAt + seconds`; all subsequent segments get `startAt + seconds` and `endAt + seconds`; preceding segments are unchanged
   - Updates `segmentsRef.current` and `totalRef.current` immediately
   - Returns the new array
6. Return value gains `extend`.

## `useWorkoutSession` Changes

- Add `extend: (seconds: number) => Segment[]` to the `WorkoutSession` interface
- Pass `extend` through from `useTimerEngine` to the return value

## `WorkoutScreen` Changes

- `SEGMENTS`: `useMemo(() => getSessionSegments(session), [])` → `useState<Segment[]>(() => getSessionSegments(session))`
- `TOTAL_DUR`: `useMemo(() => totalDuration(SEGMENTS), [])` → `useMemo(() => totalDuration(segments), [segments])`  
  (rename `SEGMENTS` → `segments` throughout the component for consistency)
- Get `extend` from `useWorkoutSession`
- Add handler: `const handleExtend = useCallback(() => { setSegments(extend(15)); }, [extend])`
- New button in `phaseBottom`, after the progress track:

```tsx
{!isDone && !isPreStart && (
  <GhostBtn onPress={handleExtend} disabled={isIdle}>
    <Text style={styles.extendLabel}>+0:15</Text>
  </GhostBtn>
)}
```

- New style `extendLabel`: `Inter_700Bold`, 15px, `letterSpacing: 15 * 0.08`, color `T.subText`

## Constraints

- Button is hidden (not just disabled) when `isDone` or `isPreStart` — it only makes sense during an active or paused interval
- Extending while paused works correctly: `computeElapsed()` returns `accumulatedRef.current` when paused, so the correct segment is found and extended
- No cap on how many times extend can be pressed
- The timeline strip and "X left" label update automatically because they derive from `segments` state and `TOTAL_DUR`
- The progress bar animation for the current segment (`seg.duration`) updates on the next render because `seg` is derived from `segments[effectiveIndex]`

## Testing

- Press +0:15 during a running interval → countdown increases by 15s, timeline extends
- Press +0:15 while paused → same result, timer resumes correctly after
- Press +0:15 multiple times → cumulative, each press adds 15s
- Press +0:15 on the last segment → total duration increases, finish fires correctly at new end
- Button is absent during preStart countdown and after finish
