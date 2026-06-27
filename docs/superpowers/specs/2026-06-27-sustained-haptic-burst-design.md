# Sustained Haptic Burst on Phase Transition

## Summary

Replace the single-tap haptic on phase transitions with a 2-second burst — firing `Haptics.impactAsync` every 150ms for 14 taps total.

## Scope

One file: `src/hooks/useWorkoutSession.ts`

Settings, locales, and SettingsScreen are already complete on this branch (`hapticFeedback` toggle exists).

## Behaviour

- Triggers on **every** phase transition (work → rest, rest → work, cooldown, etc.)
- Fires only when `settings.hapticFeedback` is `true`
- Duration: ~2 seconds (14 taps × 150ms = 0ms, 150ms, …, 1950ms)
- If a new transition arrives while a burst is running, cancel the in-flight burst and start a fresh one
- Cancels immediately on workout reset or pause

## Implementation

### New ref

```ts
const hapticBurstRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

### Helper

```ts
function startHapticBurst() {
  if (hapticBurstRef.current) clearInterval(hapticBurstRef.current);
  let count = 0;
  hapticBurstRef.current = setInterval(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    count++;
    if (count >= 14) {
      clearInterval(hapticBurstRef.current!);
      hapticBurstRef.current = null;
    }
  }, 150);
}
```

### Call site — `onTransition`

```ts
onTransition: (_from, to) => {
  cues.onTransition(to?.phase ?? null);
  if (to !== null && settings.hapticFeedback) {
    startHapticBurst();
  }
},
```

### Cleanup in `reset`

```ts
const reset = useCallback(() => {
  if (hapticBurstRef.current) {
    clearInterval(hapticBurstRef.current);
    hapticBurstRef.current = null;
  }
  countdown.cancel();
  cues.stopKeepAlive();
  engineReset();
}, [countdown, cues, engineReset]);
```

## Testing

Manual verification on a dev build (haptics don't work in Expo Go):

1. Start a workout — confirm buzz lasts ~2s on first transition
2. Let multiple transitions fire — confirm each gets its own fresh burst
3. Pause/reset mid-buzz — confirm vibration stops immediately
4. Toggle haptic feedback off in Settings — confirm no vibration fires
