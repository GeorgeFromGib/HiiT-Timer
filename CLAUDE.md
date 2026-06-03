# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npx expo start          # start dev server (Expo Go / dev build)
npx expo start --ios    # open in iOS simulator
npx expo start --android
npx expo prebuild       # generate native ios/ and android/ directories
```

Background audio reliability **will not work in Expo Go**. Test on a dev build:

```bash
npx eas build --profile development --platform ios
```

There are no tests or a linter configured yet.

## Architecture

This is an Expo (SDK 56) React Native HIIT timer app. The core logic lives in `src/` as four files; `App.tsx` is currently a placeholder — the real entry point for the workout UI is `src/WorkoutScreen.tsx`.

### Data flow

```
WorkoutConfig → expandWorkout() → Segment[]
                                       ↓
                              useTimerEngine (wall-clock tick loop)
                                       ↓
                    onTransition / onCountdown / onFinish callbacks
                                       ↓
                              useWorkoutAudio (cue playback)
```

### Key files

| File | Role |
|---|---|
| `src/workout.ts` | Pure data model. `expandWorkout(cfg)` converts a `WorkoutConfig` into a flat `Segment[]` with pre-computed `startAt`/`endAt`. All timing logic downstream reads from this list. |
| `src/timerEngine.ts` | `useTimerEngine` hook. Ticks at 200ms but reads `Date.now()` every tick so elapsed time is wall-clock–accurate, never counter-drift. Fires `onTransition`, `onCountdown` (3-2-1), and `onFinish` callbacks. Exposes `start`, `pause`, `resume`, `reset`, `skip`. |
| `src/audio.ts` | Two responsibilities: (1) configure the iOS audio session (`playsInSilentMode`, `shouldPlayInBackground`, `interruptionMode`) so cues play over the lock screen and mix with music; (2) loop a silent `keepalive.wav` to keep the audio session—and therefore the JS timer—alive while backgrounded/locked. Uses `expo-audio` (not the deprecated `expo-av`). |
| `src/WorkoutScreen.tsx` | Wires engine + audio, renders phase word, countdown, proportional segment timeline with sweeping marker, and next-up label. `DEMO` constant at the top of this file is the only workout config currently in use. |

### iOS background reliability

The silent keep-alive audio track is what defeats iOS JS timer throttling when the screen is locked. This requires:
1. `shouldPlayInBackground: true` in `setAudioModeAsync`
2. `UIBackgroundModes: ["audio"]` in `app.json` under `expo.ios.infoPlist` — **already set**
3. A development build (not Expo Go)

### `expo-audio` API note

`expo-audio` is still evolving. Always verify `setAudioModeAsync` option names and `AudioPlayer` methods against the installed version's docs before writing audio code.

## Design Files

High-fidelity design references live in `design/`. Read `design/README.md` for full spec — it covers all three screens, color tokens, typography, component specs, and the data model.

Key files:
- `design/HIIT Timer - Explorations.html` — open in a browser to see all screens live in both themes

### Three screens
1. **Workout Timer** — active timer with phase block, countdown, timeline strip, controls
2. **Sessions List** — browsable card list with category filter and start button
3. **Edit Session** — create/edit interval sequences with phase picker

### Themes
- **Tidal** (dark, deep teal — accent `#3ad6c6`)
- **Daybreak** (light, warm paper — accent `#ff5a3d`)

### Typography
- UI/body: **Inter** (400–900)
- Timers/numbers: **Chakra Petch** monospace (500–700)

Implement pixel-close to the designs. Colors, spacing, and interactions are final.

