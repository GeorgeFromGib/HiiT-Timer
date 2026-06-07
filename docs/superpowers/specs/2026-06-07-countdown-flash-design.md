# Countdown Flash — Design Spec

**Date:** 2026-06-07

## Summary

Flash the screen briefly on each beat of the 3-2-1 countdown at the end of every workout segment. The flash does NOT fire during the pre-start "GET READY" countdown.

## Behaviour

- Triggers on the 3, 2, and 1 second marks of every segment (warmup, work, rest, cooldown)
- Does not trigger during the pre-start countdown (`status === 'preStart'`)
- Each beat produces one flash regardless of tick frequency (ticks fire at 200ms, so deduplication is required)
- Flash resets cleanly on segment transition

## Visual

- Full-screen white translucent overlay
- `pointerEvents="none"` — no interaction interference
- Opacity: `0.18` at peak, fades to `0` over `350ms`
- Uses `useNativeDriver: true` for smooth native animation

## Implementation

All changes are confined to `src/screens/WorkoutScreen.tsx`.

### New state

```ts
const flashAnim = useRef(new Animated.Value(0)).current;
const lastFlashSecondRef = useRef(-1);
```

### Effect: reset on segment change

```ts
useEffect(() => {
  lastFlashSecondRef.current = -1;
}, [currentIndex]);
```

### Effect: trigger flash

```ts
useEffect(() => {
  if (status !== 'running') return;
  const secsLeft = Math.ceil(remainingInSegment);
  if (secsLeft > 0 && secsLeft <= 3 && secsLeft !== lastFlashSecondRef.current) {
    lastFlashSecondRef.current = secsLeft;
    flashAnim.setValue(0.18);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }
}, [remainingInSegment, status]);
```

### Overlay element

Placed as the last child inside the outermost `LinearGradient` container so it sits above all content:

```tsx
<Animated.View
  pointerEvents="none"
  style={[StyleSheet.absoluteFillObject, { opacity: flashAnim, backgroundColor: 'white' }]}
/>
```

## Files changed

| File | Change |
|---|---|
| `src/screens/WorkoutScreen.tsx` | Add flash animation, two effects, one overlay view |

## Out of scope

- No changes to `useTimerEngine` or `useWorkoutSession`
- No setting to toggle the flash (not requested)
- No per-phase colour variation (white only)
