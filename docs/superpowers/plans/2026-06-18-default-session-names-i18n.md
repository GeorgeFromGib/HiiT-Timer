# Default Session Names i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the three default sessions to "Example 1/2/3" with translations, and fix a race condition so the names always appear in the detected device language on first launch.

**Architecture:** Two independent changes — (1) rename translation keys and strings in locale files + `getDefaultSessions()`, (2) seed the initial React settings state with `detectLanguage()` so the correct language is used on the very first render.

**Tech Stack:** React Native (Expo SDK 56), i18n-js, expo-localization

## Global Constraints

- No test framework is configured — verification is manual via the Expo dev server / simulator.
- Three supported locales: `en`, `es`, `fr`. All three must be updated in every locale-touching task.
- `detectLanguage()` is in `src/lib/i18n.ts` and is already imported in `App.tsx` — do not add a new import.
- Do not change session IDs (`default-1`, `default-2`, `default-run-2`) or any session config/interval data.

---

### Task 1: Rename default session translation keys and strings

**Files:**
- Modify: `src/locales/en.ts`
- Modify: `src/locales/es.ts`
- Modify: `src/locales/fr.ts`
- Modify: `src/lib/sessions.ts`

**Interfaces:**
- Produces: `defaultSessions.example1`, `defaultSessions.example2`, `defaultSessions.example3` keys in all three locale files, consumed by `getDefaultSessions()` in Task 1 itself.

- [ ] **Step 1: Update `src/locales/en.ts`**

Replace the `defaultSessions` block:

```ts
// before
defaultSessions: {
  tabata: 'Tabata Burnout',
  quick: 'Quick HiiT',
  run: 'Interval Run',
},

// after
defaultSessions: {
  example1: 'Example 1',
  example2: 'Example 2',
  example3: 'Example 3',
},
```

- [ ] **Step 2: Update `src/locales/es.ts`**

Replace the `defaultSessions` block:

```ts
// before
defaultSessions: {
  tabata: 'Tabata a tope',
  quick: 'HIIT rápido',
  run: 'Carrera por intervalos',
},

// after
defaultSessions: {
  example1: 'Ejemplo 1',
  example2: 'Ejemplo 2',
  example3: 'Ejemplo 3',
},
```

- [ ] **Step 3: Update `src/locales/fr.ts`**

Replace the `defaultSessions` block:

```ts
// before
defaultSessions: {
  tabata: 'Tabata Brûlant',
  quick: 'HIIT Rapide',
  run: 'Course par intervalles',
},

// after
defaultSessions: {
  example1: 'Exemple 1',
  example2: 'Exemple 2',
  example3: 'Exemple 3',
},
```

- [ ] **Step 4: Update `getDefaultSessions()` in `src/lib/sessions.ts`**

The function currently uses the old keys. Replace only the three `name:` lines — leave all `id`, `mode`, `config`, `intervals`, `activityType`, and `runSpeeds` fields untouched:

```ts
// before
name: i18n.t('defaultSessions.tabata', { locale }),
// ...
name: i18n.t('defaultSessions.quick', { locale }),
// ...
name: i18n.t('defaultSessions.run', { locale }),

// after
name: i18n.t('defaultSessions.example1', { locale }),
// ...
name: i18n.t('defaultSessions.example2', { locale }),
// ...
name: i18n.t('defaultSessions.example3', { locale }),
```

- [ ] **Step 5: Manual verification**

Start the dev server:
```bash
npx expo start --ios
```

- Delete `sessions_v2.json` if it exists (Settings app → General → iPhone Storage → find the app → offload, or use the simulator's Documents directory).
- Launch the app. The sessions list must show **"Example 1"**, **"Example 2"**, **"Example 3"** in English.
- Confirm no crashes and that tapping each session navigates correctly to the workout screen.

- [ ] **Step 6: Commit**

```bash
git add src/locales/en.ts src/locales/es.ts src/locales/fr.ts src/lib/sessions.ts
git commit -m "feat: rename default sessions to Example 1/2/3 with i18n translations"
```

---

### Task 2: Fix first-launch language race condition

**Files:**
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `detectLanguage()` from `src/lib/i18n.ts` (already imported).
- Produces: initial `settings.language` seeded with the real device locale, eliminating the `'en'` default before `loadSettings()` resolves.

- [ ] **Step 1: Update the initial settings state in `App.tsx`**

Find this line (around line 53):

```ts
const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
```

Replace with:

```ts
const [settings, setSettings] = useState<Settings>({
  ...DEFAULT_SETTINGS,
  language: detectLanguage(),
});
```

`detectLanguage` is already imported at the top of `App.tsx` — no import change needed.

- [ ] **Step 2: Manual verification — Spanish**

In the iOS Simulator:
1. Go to **Settings → General → Language & Region → iPhone Language** and set to **Español**.
2. Delete the app (or clear `sessions_v2.json`) to simulate a fresh install.
3. Launch the app via `npx expo start --ios`.
4. The sessions list must show **"Ejemplo 1"**, **"Ejemplo 2"**, **"Ejemplo 3"** immediately with no English flash.

- [ ] **Step 3: Manual verification — French**

Repeat Step 2 with the simulator language set to **Français**.
Expected names: **"Exemple 1"**, **"Exemple 2"**, **"Exemple 3"**.

- [ ] **Step 4: Manual verification — unsupported language falls back to English**

Set simulator language to **Deutsch** (German — not a supported locale).
Expected names: **"Example 1"**, **"Example 2"**, **"Example 3"** (English fallback).

- [ ] **Step 5: Commit**

```bash
git add App.tsx
git commit -m "fix: seed initial settings language from device locale to fix first-launch session name translation"
```
