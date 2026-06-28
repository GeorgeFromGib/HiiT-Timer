# Voice Announcements Design

**Date:** 2026-06-28
**Branch:** voice

## Overview

Add text-to-speech (TTS) phase announcements as an alternative to the existing chime sound cues. When enabled, the app speaks the name of the phase when a new interval starts, and "Session Complete" when the workout finishes. A toggle in Settings switches between chime and voice; the master sound-off toggle still silences everything.

## Settings

### New field: `voiceCues: boolean` (default: `false`)

Added to `Settings` in `src/lib/settings.ts` and `DEFAULT_SETTINGS`.

- `false` (default) — chime plays on phase transitions (existing behaviour)
- `true` — voice announces phase name on phase transitions

The setting is only meaningful when `soundCues` is also `true`. `soundOff` silences both modes regardless.

### Settings screen — Audio section

New toggle row added below "Sound cues":

```
Audio
─────────────────────────────────────────
Sound off             [ toggle ]
Sound cues            [ toggle ]
  Voice announcements [ toggle ]   ← new (disabled/greyed when soundCues is off)
Final countdown beep  [ toggle ]
```

i18n keys added to all locale files:
- `settings.voiceCuesLabel` — "Voice announcements"
- `settings.voiceCuesSub` — "Speak phase name instead of chime"

## Speech Module

**New file:** `src/lib/speech.ts`

Pure, non-React module. No JSX, no hooks.

```ts
speakPhase(phase: Phase, language: Language): void
speakComplete(language: Language): void
```

Implementation:
1. Maps `Language` → BCP 47 code: `'en' → 'en-US'`, `'es' → 'es-ES'`, `'fr' → 'fr-FR'`
2. Resolves phrase text via the existing `i18n` instance:
   - Phase names from `phases.*` keys (already translated in all 3 locales)
   - "Session Complete" from new `speech.complete` locale key
3. Calls `Speech.stop()` to cancel any in-progress utterance, then `Speech.speak(text, { language: code })`

### New locale keys

```ts
// en
speech: { complete: 'Session Complete' }

// es
speech: { complete: 'Sesión completa' }

// fr
speech: { complete: 'Séance terminée' }
```

Phase names reuse existing `phases.*` translations — no new keys needed.

## Audio Hook Integration

`AudioSettings` type (in `src/lib/audio.ts`) gains two fields:

```ts
export type AudioSettings = {
  soundOff: boolean;
  soundCues: boolean;
  finalCountdownBeep: boolean;
  soundVolume: number;
  voiceCues: boolean;    // ← new
  language: Language;    // ← new
};
```

`useWorkoutSession` already passes the full `Settings` object to `useWorkoutAudio` — structural typing means the new fields flow through with no change to the call site.

Logic change in `useWorkoutAudio`:

```
onTransition(to):
  if soundOff or not to → skip
  if soundCues:
    if voiceCues → speakPhase(to.phase, language)
    else         → playCue('chime', volume)

onFinish():
  if not soundOff and soundCues:
    if voiceCues → speakComplete(language)
    else         → playCue('finish', volume)
  stopKeepAlive()
```

## Phases Announced

| Phase key    | EN text         | ES text                | FR text               |
|--------------|-----------------|------------------------|-----------------------|
| `warmup`     | Warm Up         | Calentamiento          | Échauffement          |
| `work`       | Work            | Trabajo                | Travail               |
| `rest`       | Rest            | Descanso               | Repos                 |
| `cooldown`   | Cool Down       | Enfriamiento           | Récupération          |
| `circuitRest`| Circuit Rest    | Descanso Circuito      | Repos Circuit         |
| (finish)     | Session Complete| Sesión completa        | Séance terminée       |

## Dependencies

- Install `expo-speech` (Expo SDK 56 compatible)
- Requires a dev build — already the case for this project (haptics, background audio)

## Files Changed

| File | Change |
|---|---|
| `package.json` | Add `expo-speech` |
| `src/lib/settings.ts` | Add `voiceCues: boolean` to `Settings` + `DEFAULT_SETTINGS` |
| `src/lib/audio.ts` | Extend `AudioSettings` with `voiceCues` + `language`; voice branch in `onTransition`/`onFinish` |
| `src/lib/speech.ts` | New — `speakPhase` + `speakComplete` |
| `src/locales/en.ts` | Add `settings.voiceCuesLabel`, `settings.voiceCuesSub`, `speech.complete` |
| `src/locales/es.ts` | Same new keys (Spanish) |
| `src/locales/fr.ts` | Same new keys (French) |
| `src/screens/SettingsScreen.tsx` | New "Voice announcements" toggle row under Audio |

## Out of Scope

- Speaking the countdown (3-2-1) — only phase transitions and finish
- Per-session voice on/off — single global setting
- Custom voice selection — system default voice is used
