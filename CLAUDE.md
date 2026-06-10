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

This is an Expo (SDK 56) React Native HIIT timer app. `App.tsx` is the real entry point — it owns font loading, theme context, and custom stack navigation. `src/` is organised into four subdirectories:

```
src/
  screens/    WorkoutScreen, SessionsListScreen, EditSessionScreen, SettingsScreen
  hooks/      useTimerEngine, useEditSession
  lib/        workout, sessions, audio, settings, alerts
  components/ SessionCard, PhaseStrip, PhaseIcon, ReadyIcon, FinishedIcon, GhostBtn, WheelColumn
```

### Navigation

No React Navigation library — `App.tsx` holds a `Route` state and switches between screens manually. Routes are typed in `src/navigation.ts`:

```
Sessions → Workout (session) → back
Sessions → EditSession (session?) → back
Sessions → Settings → back
```

### Data flow

```
Session (easy | advanced)
  ↓ getSessionSegments()
Segment[]
  ↓ useTimerEngine (wall-clock tick loop)
  ↓ onTransition / onCountdown / onFinish callbacks
  ↓ useWorkoutAudio (cue playback)
```

### Key files

| File | Role |
|---|---|
| `src/lib/workout.ts` | Pure data model. `expandWorkout(cfg)` and `intervalsToSegments(ivs)` both produce a flat `Segment[]` with pre-computed `startAt`/`endAt`. Also exports `tryConvertToEasy`, `fmtDuration`, `PHASE_META`. |
| `src/lib/sessions.ts` | `Session` type (easy/advanced modes), `DEFAULT_SESSIONS`, `loadSessions`/`saveSessions` (persisted as JSON via `expo-file-system` to `sessions_v2.json`), `getSessionSegments`. |
| `src/lib/settings.ts` | `Settings` type (theme, soundCues, hapticFeedback, keepScreenAwake, etc.), `loadSettings`/`saveSettings` (persisted as `settings_v1.json`). |
| `src/lib/audio.ts` | Configures the iOS audio session and loops a silent keepalive track. Uses `expo-audio` (not deprecated `expo-av`). |
| `src/hooks/useTimerEngine.ts` | Ticks at 200ms but reads `Date.now()` for wall-clock accuracy. Fires `onTransition`, `onCountdown` (3-2-1), and `onFinish`. Exposes `start`, `pause`, `resume`, `reset`, `skip`. |
| `src/hooks/useEditSession.ts` | All state and logic for the EditSession form (easy ↔ advanced mode, interval list, wheel picker). |
| `src/theme.ts` | `ThemeContext`, `useTheme()`, `THEME_TOKENS` for tidal/daybreak. `ThemeTokens` interface with `bgGradient`, `accent`, `phases`, etc. |
| `src/typography.ts` | Shared font/text-style helpers. |

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

### Versioning

- 0 represnets digit location

- MAJOR (0._._) — breaking change or significant new product (rare, usually signals a full rewrite or incompatible data migration)
- MINOR (_.0._) — new features, backwards compatible
- PATCH (_._.0) — bug fixes, no new features

