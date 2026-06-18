# Default Session Names i18n — Design

**Date:** 2026-06-18
**Scope:** First-install only — new devices that have never saved sessions.

---

## Problem

On first launch, `App.tsx` initialises React state with `DEFAULT_SETTINGS`, which hard-codes `language: 'en'`. `SessionsListScreen` mounts and its `useEffect` fires `loadSessions(settings.language)` immediately — at that point `settings.language` is still `'en'`, so `getDefaultSessions('en')` is called and English session names are shown, regardless of device locale.

`detectLanguage()` (in `src/lib/i18n.ts`) is already **synchronous** — it reads `expo-localization.getLocales()` at call time — so the race condition can be eliminated without any async work.

---

## Solution

In `App.tsx`, seed the initial settings state with the detected device language instead of `'en'`:

```ts
// Before
const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

// After
const [settings, setSettings] = useState<Settings>({
  ...DEFAULT_SETTINGS,
  language: detectLanguage(),
});
```

`detectLanguage()` is already imported in `App.tsx`. No other files change.

---

## Default Session Names

The three default sessions are renamed to generic numbered names to avoid culturally specific workout terminology. The translation keys are renamed accordingly:

| Key | en | es | fr |
|---|---|---|---|
| `defaultSessions.example1` | Example 1 | Ejemplo 1 | Exemple 1 |
| `defaultSessions.example2` | Example 2 | Ejemplo 2 | Exemple 2 |
| `defaultSessions.example3` | Example 3 | Ejemplo 3 | Exemple 3 |

The old keys (`defaultSessions.tabata`, `defaultSessions.quick`, `defaultSessions.run`) are removed from all locale files.

`getDefaultSessions()` in `src/lib/sessions.ts` is updated to use the new keys.

---

## Why This Works

- The first render of `SessionsListScreen` receives `settings.language = detectLanguage()`.
- Its `useEffect` calls `loadSessions(correctLanguage)` on first mount.
- No sessions file exists (first install), so `getDefaultSessions(correctLanguage)` runs.
- Translations for `defaultSessions.example1/2/3` exist in all three supported locales (en, es, fr).

---

## Edge Cases

| Scenario | Outcome |
|---|---|
| `expo-localization` throws | `detectLanguage()` catches and returns `'en'` — same as today |
| User has no manually-set language | `loadSettings()` resolves with `detectLanguage()` again — same value, `settings.language` unchanged, sessions `useEffect` does not re-run |
| User has a manually-set language saved | `settings.language` changes when settings load, sessions reload in user's chosen language — correct |
| Device language not supported (not en/es/fr) | `detectLanguage()` returns `'en'` fallback — correct |

---

## Out of Scope

- Existing users who already have a `sessions_v2.json` with English names — not migrated.
- Re-translating default sessions when the user changes language in Settings — not in scope.

---

## Testing

1. Delete `sessions_v2.json` from the simulator's documents directory to simulate a fresh install.
2. Set the simulator's system language to Spanish or French.
3. Launch the app — session names must appear as "Ejemplo 1", "Ejemplo 2", "Ejemplo 3" (Spanish) or "Exemple 1", "Exemple 2", "Exemple 3" (French) immediately, with no English flash.
4. Verify English still works: set simulator language to English (or any unsupported language) and repeat — names must appear as "Example 1", "Example 2", "Example 3".
