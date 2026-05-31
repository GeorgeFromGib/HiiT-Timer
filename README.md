# HIIT Timer — Expo (iOS) starter

A reliable, background-safe interval timer with a whole-session timeline visual.
These files are the **core engine**, not a full app — drop them into a fresh
Expo project and build the settings/preset screens around them.

## Why this is structured the way it is

The #1 complaint about interval timers is that **the beep doesn't fire when the
phone is locked or in a pocket**, because iOS suspends a JS `setInterval` the
moment the app backgrounds. Two techniques here defeat that:

1. **Keep-alive audio** (`audio.ts`) — a silent looping track holds the iOS
   audio session open, which lets the JS timer keep ticking with the screen
   locked. The same session config makes cues play *over* the user's music
   (another top request) instead of pausing it.

2. **Wall-clock, self-correcting timer** (`timerEngine.ts`) — every tick reads
   `Date.now()` and recomputes elapsed time, so even a brief throttle can't make
   the timer drift. Transitions and the 3-2-1 countdown fire from this single
   source of truth.

## File map

| File | Responsibility |
|---|---|
| `src/workout.ts` | Data model. Expands a `WorkoutConfig` into a flat, pre-timed `Segment[]`. |
| `src/timerEngine.ts` | `useTimerEngine` hook — the self-correcting clock + transition/countdown events. |
| `src/audio.ts` | Audio session config, cue playback, silent keep-alive. |
| `src/WorkoutScreen.tsx` | Ties it together + the glanceable timeline UI. |

## Setup

```bash
npx create-expo-app@latest hiit-timer --template blank-typescript
cd hiit-timer
npx expo install expo-audio expo-keep-awake
# copy the src/ files in, and add cue .wav files to assets/ (see below)
```

### Required assets (`assets/`)
Tiny, loud `.wav` (or `.caf`) files:
- `keepalive.wav` — ~30s of pure digital silence (looped to hold the session)
- `cue_high.wav`, `cue_low.wav` — distinct tones per phase
- `cue_tick.wav` — short blip for the 3-2-1 countdown
- `cue_finish.wav` — completion sound

### `app.json` — the critical bit
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["audio"]
      }
    },
    "plugins": ["expo-audio"]
  }
}
```

### You must use a development build — NOT Expo Go
Background audio modes won't work in Expo Go, so you'd wrongly conclude "this
doesn't work." Always test reliability on a dev build:

```bash
npx expo prebuild
npx eas build --profile development --platform ios   # or run locally with Xcode
```

Then test the real scenario: start a workout, **lock the phone, put it face
down, play Spotify**, and confirm every cue fires on time.

## Recommended next steps

1. **Local-notifications backup.** Add `expo-notifications` and schedule a
   notification at each transition timestamp as a fallback, so even if the audio
   keep-alive is ever killed, the user still gets alerted. Cancel them all on
   pause/reset.
2. **Live Activities** for lock-screen + Dynamic Island live state. This needs a
   little SwiftUI and a config plugin (e.g. a community Live Activity module),
   but it's the iOS-native way to show your timeline when locked.
3. **Presets + persistence** — save workouts with `expo-sqlite` or async storage.
   Don't cap how many presets users can save (a common paid-tier annoyance).
4. **Settings**: toggle keep-awake, mix-vs-duck audio, vibration, count-in.

## API caveat
`expo-audio` is current (the old `expo-av` is deprecated) but still evolving.
Verify the exact `setAudioModeAsync` option names and `AudioPlayer` methods
against the version you install — the architecture is stable even if a property
name shifts.
