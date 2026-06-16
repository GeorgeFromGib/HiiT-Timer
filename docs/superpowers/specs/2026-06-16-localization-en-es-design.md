# Localization (English + Spanish) — Design

**Date:** 2026-06-16
**Status:** Approved (tests excluded per user request)

## Goal

Make the app localization-aware with two languages: **English** (primary) and
**Spanish**. The active language is auto-detected from the phone's settings on
first launch, with a manual override available in Settings. English is the
fallback for any missing translation.

## Decisions

| Question | Decision |
|---|---|
| Language control | Auto-detect from phone on first launch **+** manual override in Settings, mirroring the existing `speedUnit` / `speedUnitIsManuallySet` pattern. |
| Default session names | Localized **at seed time** via `getDefaultSessions(language)`. |
| i18n approach | **i18n-js**, the library Expo pairs with `expo-localization` (already installed). |
| Tests | **Excluded** for this iteration (explicit user request). |

## Architecture

### Core module — `src/lib/i18n.ts`

- Instantiate `const i18n = new I18n({ en, es })`.
- `i18n.enableFallback = true` and `i18n.defaultLocale = 'en'` so missing Spanish
  keys fall back to English rather than rendering `[missing "…"]`.
- `detectLanguage(): 'en' | 'es'` — mirrors `detectSpeedUnit()`:
  ```ts
  export function detectLanguage(): 'en' | 'es' {
    try {
      const { getLocales } = require('expo-localization') as typeof import('expo-localization');
      return getLocales()[0]?.languageCode === 'es' ? 'es' : 'en';
    } catch {
      return 'en';
    }
  }
  ```
- Translation tables live in `src/locales/en.ts` and `src/locales/es.ts`. `en` is
  the source of truth; `es` is typed as `typeof en` so the TypeScript compiler
  flags any missing or misnamed key.

### Reactivity — `useTranslation()` hook

`i18n-js` is not reactive on its own. Add a `useTranslation()` hook that reads
`settings.language` via `useSettings()` (subscribing the component to the
settings context) and returns a bound translator:

```ts
export function useTranslation() {
  const { settings } = useSettings();
  const locale = settings.language;
  const t = useCallback(
    (key: string, opts?: object) => i18n.t(key, { locale, ...opts }),
    [locale],
  );
  return { t, locale };
}
```

Because `t` is rederived whenever `settings.language` changes, every consuming
component re-renders into the new language.

### Settings — `src/lib/settings.ts`

Add two fields (mirroring `speedUnit`):

```ts
language: 'en' | 'es';
languageIsManuallySet: boolean;
```

Defaults: `language: 'en'`, `languageIsManuallySet: false`.

### App wiring — `App.tsx`

In the existing `loadSettings()` effect, resolve language exactly like
`speedUnit`:

```ts
const resolved = {
  ...s,
  speedUnit: s.speedUnitIsManuallySet ? s.speedUnit : detectSpeedUnit(),
  language: s.languageIsManuallySet ? s.language : detectLanguage(),
};
i18n.locale = resolved.language;
// persist if either value was auto-resolved
```

In `updateSettings`, when `key === 'language'`, also set
`languageIsManuallySet: true` and update `i18n.locale = value`.

## Translation key structure

Namespaced, flat-ish object:

```ts
const en = {
  common:     { cancel, save, delete, done, back, … },
  sessions:   { title, newSession, empty, … },
  workout:    { ready, paused, finished, congrats, getReady, … },
  edit:       { … },
  settings:   { title, language, theme, speedUnit, sound, … },
  phases:     { warmup, work, rest, cooldown },
  validation: { noWork, mustStartWork, workRestPairing, sameWorkDuration, … },
};
```

Interpolation uses i18n-js placeholders, e.g.
`t('workout.workRound', { current: 2, total: 8 })` →
`"Work 2/8"` (en) / `"Serie 2/8"` (es).

## Keeping `workout.ts` pure

`workout.ts` is the pure data model and must not import React context or i18n.
Two targeted changes preserve that boundary:

### Phase labels

- `PHASE_META` keeps `phase` as the stable key. Its translated word is resolved
  at render time via `t('phases.work')`, not stored in English.
- The dynamic label builders inside `expandWorkout` / `intervalsToSegments`
  (`Work ${r+1}/${cfg.rounds}`, `Recover ${r+1}/…`, `Interval ${i+1}`) accept an
  injected `labeler` function supplied by the caller that holds `t`. `workout.ts`
  itself formats no English text. Signature sketch:
  ```ts
  type SegmentLabeler = (phase: Phase, ctx: { index: number; total: number }) => string;
  expandWorkout(cfg: WorkoutConfig, labeler?: SegmentLabeler): Segment[]
  ```
  When `labeler` is omitted (e.g. internal/test callers), fall back to the
  current English format so existing pure call sites keep working.

### Validation messages

`tryConvertToEasy` currently returns `{ ok: false, reason: string }` with English
text. Change the failure shape to a structured key:

```ts
{ ok: false, reasonKey: 'validation.workRestPairing', reasonParams?: {…} }
```

The calling screen translates it (`t(result.reasonKey, result.reasonParams)`)
before showing the `Alert`. This keeps all language strings out of `workout.ts`.

## Default sessions localized at seed time

Replace the `DEFAULT_SESSIONS` constant in `src/lib/sessions.ts` with:

```ts
export function getDefaultSessions(language: 'en' | 'es'): Session[]
```

returning the same configs with localized `name`s (e.g. `'Interval Run'` →
`'Carrera por intervalos'`, `'Quick HiiT'` → `'HIIT rápido'`,
`'Tabata Burnout'` → `'Tabata a tope'`). `loadSessions(language)` passes the
current language through to seed correctly when no `sessions_v2.json` exists yet.

Because defaults are only returned in-memory (never written to disk until the
user first edits a session), they re-resolve in the current language on each
launch until the user mutates the list, at which point the whole list — including
whatever names were displayed — is frozen via `saveSessions`. This matches the
"localize at seed time" intent. Call sites in `App.tsx` / `SessionsListScreen`
that call `loadSessions()` pass `settings.language`.

## Settings UI

Add a **Language** row to `SettingsScreen` using the same segmented control style
as the existing Speed Unit control: `English` / `Español`. Selecting an option
calls `updateSettings('language', 'en' | 'es')`.

## Native config — `app.json`

Add to `expo.ios.infoPlist`:

```json
"CFBundleLocalizations": ["en", "es"]
```

so iOS recognizes the app as localized and honors per-app language selection in
system Settings. The `expo-localization` plugin is already registered.

## String inventory (where the work is)

User-facing strings to extract into translation tables, by density:

| File | Approx strings | Notes |
|---|---|---|
| `src/screens/EditSessionScreen.tsx` | ~49 | Largest surface; labels, buttons, picker text. |
| `src/screens/SettingsScreen.tsx` | ~20 | Section titles, toggle labels, new Language row. |
| `src/screens/WorkoutScreen.tsx` | ~15 | Ready / paused / finished / congrats states. |
| `src/components/PickerModal.tsx` | ~10 | Picker chrome. |
| `src/components/SessionCard.tsx`, `PaywallModal.tsx`, `IntervalRow.tsx` | ~5 each | |
| `src/screens/SessionsListScreen.tsx` | ~3 | Title, filters. |
| `src/lib/workout.ts` | phase words + dynamic labels + validation reasons | Via `labeler` / `reasonKey` (see above). |
| `src/lib/sessions.ts` | 3 default session names | Via `getDefaultSessions`. |

## Out of scope

- Languages beyond English and Spanish.
- App Store metadata / store-listing localization.
- Localizing numbers, dates, or units beyond the existing `speedUnit` handling.
- Automated tests (deferred at user request).
