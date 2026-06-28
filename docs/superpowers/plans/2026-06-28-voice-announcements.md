# Voice Announcements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add text-to-speech phase announcements as an alternative to chime sound cues, switchable via a Settings toggle, respecting the app's EN/ES/FR locales.

**Architecture:** A new `src/lib/speech.ts` module wraps `expo-speech` and resolves phase text from the existing `i18n` instance. The `AudioSettings` type in `audio.ts` gains `voiceCues` and `language` fields; `onTransition` and `onFinish` branch on `voiceCues` to either play the existing chime or call `speakPhase`/`speakComplete`. A new toggle row in `SettingsScreen` saves the preference.

**Tech Stack:** `expo-speech ~56.0.3` (already installed), `i18n-js` (existing), TypeScript strict mode.

## Global Constraints

- Expo SDK 56. `expo-speech ~56.0.3` is already in `package.json` — do **not** change the version.
- No test framework is configured. Use `npx tsc --noEmit` as the primary verification step after every task.
- The app requires a dev build (already the case). No Expo Go workarounds needed.
- `es.ts` and `fr.ts` both declare `typeof en` — any new key added to `en.ts` **must** be added to all three locale files in the same commit or TypeScript will error.
- Follow the surgical change rule: touch only what each task requires.

---

### Task 1: Add locale strings

All three locale files must be updated together (they share `typeof en`).

**Files:**
- Modify: `src/locales/en.ts`
- Modify: `src/locales/es.ts`
- Modify: `src/locales/fr.ts`

**Interfaces:**
- Produces: `t('settings.voiceCuesLabel')`, `t('settings.voiceCuesSub')`, `t('speech.complete')` available in all locales

- [ ] **Step 1: Add new keys to `en.ts`**

In `src/locales/en.ts`, make two additions:

1. Inside the `settings` object, after the `finalBeepSub` line (line ~115), add:
```ts
    voiceCuesLabel: 'Voice announcements',
    voiceCuesSub: 'Speak phase name instead of chime',
```

2. After the closing of the `settings` object and before `edit:` — but actually append a new top-level key `speech` after `paywall` and before `defaultSessions`. Add this new section at the top level of the exported object:
```ts
  speech: {
    complete: 'Session Complete',
  },
```

The `settings` block after the change (showing context around the insertion):
```ts
    finalBeepLabel: 'Final countdown beep',
    finalBeepSub: 'Audio cue in last 3 seconds',
    voiceCuesLabel: 'Voice announcements',
    voiceCuesSub: 'Speak phase name instead of chime',
    about: 'About',
```

The `speech` block (new, top-level, insert between `paywall` and `defaultSessions`):
```ts
  speech: {
    complete: 'Session Complete',
  },
```

- [ ] **Step 2: Add new keys to `es.ts`**

In `src/locales/es.ts`, same two additions:

Inside `settings`, after `finalBeepSub`:
```ts
    voiceCuesLabel: 'Anuncios de voz',
    voiceCuesSub: 'Pronunciar el nombre de la fase en lugar del tono',
```

New top-level `speech` key (between `paywall` and `defaultSessions`):
```ts
  speech: {
    complete: 'Sesión completa',
  },
```

- [ ] **Step 3: Add new keys to `fr.ts`**

In `src/locales/fr.ts`, same two additions:

Inside `settings`, after `finalBeepSub`:
```ts
    voiceCuesLabel: 'Annonces vocales',
    voiceCuesSub: 'Énoncer le nom de la phase au lieu du carillon',
```

New top-level `speech` key:
```ts
  speech: {
    complete: 'Séance terminée',
  },
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors. If `es` or `fr` are missing the new keys TypeScript will report a missing property error — add the missing key.

- [ ] **Step 5: Commit**

```bash
git add src/locales/en.ts src/locales/es.ts src/locales/fr.ts
git commit -m "i18n: add voice announcement locale strings"
```

---

### Task 2: Add `voiceCues` to Settings

**Files:**
- Modify: `src/lib/settings.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `Settings.voiceCues: boolean`, `DEFAULT_SETTINGS.voiceCues = false`

- [ ] **Step 1: Add field to `Settings` interface**

In `src/lib/settings.ts`, add `voiceCues` to the `Settings` interface after `hapticFeedback`:

```ts
export interface Settings {
  theme: ThemeKey;
  congratsMessage: boolean;
  finalCountdownBeep: boolean;
  keepScreenAwake: boolean;
  hapticFeedback: boolean;
  voiceCues: boolean;        // ← add this line
  soundCues: boolean;
  soundOff: boolean;
  countdownFlash: boolean;
  soundVolume: number;
  speedUnit: 'km' | 'miles';
  speedUnitIsManuallySet: boolean;
  language: 'en' | 'es' | 'fr';
  languageIsManuallySet: boolean;
}
```

- [ ] **Step 2: Add default value**

In the same file, add `voiceCues: false` to `DEFAULT_SETTINGS` in the matching position:

```ts
export const DEFAULT_SETTINGS: Settings = {
  theme: 'daybreak',
  congratsMessage: true,
  finalCountdownBeep: true,
  keepScreenAwake: true,
  hapticFeedback: true,
  voiceCues: false,           // ← add this line
  soundCues: true,
  soundOff: false,
  countdownFlash: true,
  soundVolume: 100,
  speedUnit: 'km',
  speedUnitIsManuallySet: false,
  language: 'en',
  languageIsManuallySet: false,
};
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/settings.ts
git commit -m "feat: add voiceCues setting"
```

---

### Task 3: Create `src/lib/speech.ts`

**Files:**
- Create: `src/lib/speech.ts`

**Interfaces:**
- Consumes: `i18n` from `src/lib/i18n.ts`; `Phase` from `src/lib/workout.ts`; `Language` from `src/lib/i18n.ts`; `expo-speech`
- Produces:
  - `speakPhase(phase: Phase, language: Language): void`
  - `speakComplete(language: Language): void`

- [ ] **Step 1: Create the file**

```ts
import * as Speech from 'expo-speech';
import type { Phase } from './workout';
import type { Language } from './i18n';
import { i18n } from './i18n';

const LANGUAGE_CODES: Record<Language, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
};

function speak(text: string, language: Language): void {
  Speech.stop();
  Speech.speak(text, { language: LANGUAGE_CODES[language] });
}

export function speakPhase(phase: Phase, language: Language): void {
  const text = i18n.t(`phases.${phase}`, { locale: language });
  speak(text, language);
}

export function speakComplete(language: Language): void {
  const text = i18n.t('speech.complete', { locale: language });
  speak(text, language);
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors. If `expo-speech` types are missing, check `node_modules/expo-speech` exists.

- [ ] **Step 3: Commit**

```bash
git add src/lib/speech.ts
git commit -m "feat: add speech module for TTS phase announcements"
```

---

### Task 4: Extend `AudioSettings` and add voice branch in `audio.ts`

**Files:**
- Modify: `src/lib/audio.ts`

**Interfaces:**
- Consumes: `speakPhase`, `speakComplete` from `src/lib/speech.ts`; `Language` from `src/lib/i18n.ts`
- Produces: `AudioSettings` now requires `voiceCues: boolean` and `language: Language`; `onTransition` speaks instead of chiming when `voiceCues` is true; `onFinish` speaks "Session Complete" instead of finish chime when `voiceCues` is true

- [ ] **Step 1: Import speech functions and Language type**

At the top of `src/lib/audio.ts`, add two imports:

```ts
import type { Language } from './i18n';
import { speakPhase, speakComplete } from './speech';
```

- [ ] **Step 2: Extend `AudioSettings`**

Replace the existing `AudioSettings` type:

```ts
export type AudioSettings = {
  soundOff: boolean;
  soundCues: boolean;
  finalCountdownBeep: boolean;
  soundVolume: number;
  voiceCues: boolean;
  language: Language;
};
```

- [ ] **Step 3: Add voice branch to `onTransition` and `onFinish`**

In the `useMemo` return inside `useWorkoutAudio`, replace the `onTransition` and `onFinish` implementations:

```ts
onTransition(to) {
  const s = settingsRef.current;
  if (!to || s.soundOff || !s.soundCues) return;
  if (s.voiceCues) {
    speakPhase(to, s.language);
  } else {
    playCue('chime', s.soundVolume / 100);
  }
},
onFinish() {
  const s = settingsRef.current;
  if (!s.soundOff && s.soundCues) {
    if (s.voiceCues) {
      speakComplete(s.language);
    } else {
      playCue('finish', s.soundVolume / 100);
    }
  }
  stopKeepAlive();
},
```

Note: `onTransition` currently receives `to: Phase | null`. After this change it still receives `Phase | null` — the `if (!to …) return` guard handles the null case, so `speakPhase(to, …)` is safe (TypeScript narrows `to` to `Phase`).

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors. `useWorkoutSession` passes full `Settings` to `useWorkoutAudio` — since `Settings` now has `voiceCues` and `language`, it satisfies the extended `AudioSettings` type automatically.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio.ts src/lib/speech.ts
git commit -m "feat: wire voice announcements into audio hook"
```

---

### Task 5: Add Voice toggle to SettingsScreen

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `settings.voiceCues`, `settings.soundCues`, `settings.soundOff` from `useSettings()`; `t('settings.voiceCuesLabel')`, `t('settings.voiceCuesSub')` from `useTranslation()`

- [ ] **Step 1: Add the toggle row**

In `src/screens/SettingsScreen.tsx`, in the Audio section, insert a new `SettingsRow` between the `soundCues` row and the `finalBeepLabel` row. The Voice toggle is disabled when either `soundOff` or `soundCues` is off (voice only makes sense when sound cues are on):

```tsx
<SettingsRow
  label={t('settings.soundCuesLabel')}
  sub={t('settings.soundCuesSub')}
  disabled={settings.soundOff}
  right={<SettingsToggle value={settings.soundCues} onChange={v => updateSettings('soundCues', v)} disabled={settings.soundOff} />}
/>
<SettingsRow
  label={t('settings.voiceCuesLabel')}
  sub={t('settings.voiceCuesSub')}
  disabled={settings.soundOff || !settings.soundCues}
  right={<SettingsToggle value={settings.voiceCues} onChange={v => updateSettings('voiceCues', v)} disabled={settings.soundOff || !settings.soundCues} />}
/>
<SettingsRow
  label={t('settings.finalBeepLabel')}
  ...
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: add voice announcements toggle to Settings"
```

---

### Task 6: Manual device verification

No automated tests exist in this project. Verify on a dev build.

- [ ] **Step 1: Start the app**

```bash
npx expo start --ios
```

Or run on a physical device via dev build.

- [ ] **Step 2: Verify Settings UI**

Open Settings → Audio. Confirm:
- "Voice announcements" toggle appears below "Sound cues"
- Toggle is greyed out / disabled when "Sound cues" is off
- Toggle is greyed out / disabled when "Sound off" is on
- Toggling saves correctly (toggle state persists after closing and reopening Settings)

- [ ] **Step 3: Verify chime mode (default)**

With "Voice announcements" off:
- Start a workout with multiple phases
- Confirm chime plays at each phase transition (existing behaviour unchanged)
- Confirm finish chime plays when session ends

- [ ] **Step 4: Verify voice mode**

Enable "Voice announcements":
- Start a workout — confirm the device speaks the phase name (e.g. "Warm Up", "Work", "Rest") at each transition
- Confirm no chime plays (voice replaces it)
- Confirm "Session Complete" is spoken when session ends
- Confirm chime does NOT also play

- [ ] **Step 5: Verify locale — Spanish**

In Settings → Language, switch to Español. Start a workout with "Voice announcements" on:
- Phase transitions should speak Spanish ("Calentamiento", "Trabajo", "Descanso", "Enfriamiento", "Repos Circuit")
- Session end should speak "Sesión completa"

- [ ] **Step 6: Verify locale — French**

Switch to Français. Start a workout with "Voice announcements" on:
- Phase transitions should speak French ("Échauffement", "Travail", "Repos", "Récupération", "Repos Circuit")
- Session end should speak "Séance terminée"

- [ ] **Step 7: Final commit (if any tweaks made)**

```bash
git add -p
git commit -m "fix: voice announcement adjustments from manual testing"
```
