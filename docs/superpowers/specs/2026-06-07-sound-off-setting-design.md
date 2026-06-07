# Sound Off Setting — Design Spec

**Date:** 2026-06-07

## Goal

Add a master "Sound off" toggle to Settings that mutes all audio. Wire up the existing granular audio toggles (`soundCues`, `finalCountdownBeep`) that are currently saved to disk but never actually gate any audio calls.

## Settings type changes

Add `soundOff: boolean` (default `false`) to the `Settings` interface in `src/lib/settings.ts`.

## Settings screen UI

In the "Audio & Haptics" section, add "Sound off" as the first row. The three rows below it — Sound cues, Final countdown beep, Haptic feedback — dim to 40% opacity and their toggles become non-interactive when `soundOff` is on. Their values are preserved underneath; turning `soundOff` back off restores them as-is.

The `SRow` component gains an optional `disabled` prop that applies `opacity: 0.4` to the row and passes `disabled` down to its `Toggle` child. `Toggle` gains a `disabled` prop that makes the `Pressable` non-interactive.

Row order in "Audio & Haptics":
1. Sound off — "Mute all audio" — always interactive
2. Sound cues — "Play tones on phase changes" — disabled when `soundOff`
3. Final countdown beep — "Audio cue in last 3 seconds" — disabled when `soundOff`
4. Haptic feedback — "Vibrate on interval transitions" — disabled when `soundOff`

## Audio gating

`useWorkoutSession` accepts a `settings` parameter (the full `Settings` object). It stores it in a stable ref alongside `audioRef` so timer callbacks always read the latest values without triggering re-renders or appearing in dependency arrays.

| Audio call | Condition to play |
|---|---|
| `playChime` — phase transition | `!soundOff && soundCues` |
| `playTick` — pre-start 3-2-1 countdown | `!soundOff && soundCues` |
| `playTick` — final 3-2-1 in each segment | `!soundOff && finalCountdownBeep` |
| `playFinish` — workout complete | `!soundOff && soundCues` |

The keep-alive audio track is unaffected — it runs silently at volume 0 and is purely an iOS background timer mechanism, not a user-audible cue.

## Settings flow to WorkoutScreen

`WorkoutScreen` loads settings on mount (via `loadSettings()` into local state) and passes them to `useWorkoutSession(segments, settings)`. This also enables conditional keep-awake — the current `useKeepAwake()` call is unconditional; it should respect `settings.keepScreenAwake`. Since `useKeepAwake` cannot be called conditionally (React hook rules), replace it with `activateKeepAwakeAsync`/`deactivateKeepAwakeAsync` in a `useEffect` that reacts to the setting. That fix is included in this work since the wiring is already needed.

Congratulatory message gating (`settings.congratsMessage`) is already conditional in the WorkoutScreen render — no change needed there.

## Files changed

| File | Change |
|---|---|
| `src/lib/settings.ts` | Add `soundOff: boolean` to `Settings`, default `false` |
| `src/screens/SettingsScreen.tsx` | "Sound off" row + `disabled` prop on `SRow`/`Toggle` |
| `src/hooks/useWorkoutSession.ts` | Accept `settings`, gate all audio calls |
| `src/screens/WorkoutScreen.tsx` | Load settings, pass to `useWorkoutSession`, conditional `useKeepAwake` |

## Out of scope

- Haptic feedback wiring (no haptic calls exist in the codebase yet)
- Any changes to the audio session config or keep-alive track
