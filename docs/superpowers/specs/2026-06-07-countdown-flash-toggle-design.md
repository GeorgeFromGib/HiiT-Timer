# Countdown Flash Toggle — Design Spec

**Date:** 2026-06-07

## Summary

Add a "Countdown flash" toggle to the Settings screen so users can turn the screen flash on or off independently of audio settings.

## Behaviour

- New `countdownFlash: boolean` setting, default `true` (preserves existing behaviour for all users)
- When `false`, the flash callback in `WorkoutScreen` exits early — no visual change occurs
- The audio countdown beep (`finalCountdownBeep`) is unaffected; the two settings are fully independent

## Settings Screen

New row added to the **Workout** section, between "Congratulatory message" and "Keep screen awake":

| Label | Sub-label |
|---|---|
| Countdown flash | Screen flash on last 3 seconds of each interval |

The row uses the standard `SRow` + `Toggle` components already in `SettingsScreen.tsx`.

## Data Model

`src/lib/settings.ts`:
- Add `countdownFlash: boolean` to the `Settings` interface
- Add `countdownFlash: true` to `DEFAULT_SETTINGS`
- No migration needed — `loadSettings` already merges saved JSON with `DEFAULT_SETTINGS`, so existing users get `true` automatically

## WorkoutScreen Change

The flash callback passed as the third argument to `useWorkoutSession` gains a single guard:

```ts
() => {
  if (!settings.countdownFlash) return;
  if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  setFlashing(true);
  flashTimerRef.current = setTimeout(() => setFlashing(false), 250);
}
```

No changes to `useWorkoutSession`, `useTimerEngine`, or the audio layer.

## Files Changed

| File | Change |
|---|---|
| `src/lib/settings.ts` | Add `countdownFlash` field to `Settings` and `DEFAULT_SETTINGS` |
| `src/screens/SettingsScreen.tsx` | Add `SRow` toggle in Workout section |
| `src/screens/WorkoutScreen.tsx` | Gate flash callback on `settings.countdownFlash` |

## Out of Scope

- No changes to the flash animation itself (duration, colour, overlay vs gradient-swap)
- No per-phase flash control
- No link between `countdownFlash` and `finalCountdownBeep`
