# English/Spanish Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app display in English or Spanish, auto-detected from the phone on first launch with a manual override in Settings.

**Architecture:** A single i18n-js instance (`src/lib/i18n.ts`) holds two typed dictionaries (`src/locales/en.ts`, `src/locales/es.ts`). The active locale lives in `Settings.language` (persisted, mirroring `speedUnit`) and is pushed into `i18n.locale` from `App.tsx`. Components read strings via a `useTranslation()` hook that subscribes to settings so they re-render on language change; non-component code (hooks, `alerts.ts`, `sessions.ts`) calls the shared `i18n` instance directly.

**Tech Stack:** Expo SDK 56, React Native, TypeScript, `i18n-js` (new), `expo-localization` (already installed).

## Global Constraints

- **English is the source of truth and fallback.** `i18n.enableFallback = true`, `i18n.defaultLocale = 'en'`. `es.ts` is typed as `typeof en` so missing/renamed keys fail `tsc`.
- **Interpolation uses `%{name}` syntax** (i18n-js default).
- **Two languages only:** `'en' | 'es'`.
- **No automated tests** for this feature (explicit user decision). Verify each task with `npx tsc --noEmit` (no errors) plus the stated manual check.
- **No test runner is configured** — do not add one.
- **`Segment.label` is never rendered** — do not translate the English label strings inside `expandWorkout`/`intervalsToSegments`; leave them untouched.
- **Package manager is npm** (package-lock.json present).
- Commit after each task.

---

### Task 1: Install i18n-js, create dictionaries and the i18n module

**Files:**
- Modify: `package.json` (adds `i18n-js` dependency via install)
- Create: `src/locales/en.ts`
- Create: `src/locales/es.ts`
- Create: `src/lib/i18n.ts`

**Interfaces:**
- Produces:
  - `en` (default export object) — the full English dictionary; its type is the contract for `es`.
  - `i18n: I18n` — shared instance (locale defaults to `'en'`).
  - `detectLanguage(): 'en' | 'es'`
  - `useTranslation(): { t: (scope: string, opts?: object) => string; locale: 'en' | 'es' }`
  - `getCongratsMessages(): string[]`

- [ ] **Step 1: Install i18n-js**

Run: `npm install i18n-js`
Expected: `package.json` gains `"i18n-js"` under dependencies; install completes without errors.

- [ ] **Step 2: Create the English dictionary**

Create `src/locales/en.ts`:

```ts
export const en = {
  common: {
    cancel: 'Cancel',
    save: 'Save',
    done: 'Done',
    delete: 'Delete',
    duplicate: 'Duplicate',
    apply: 'Apply',
    intervalsCount: { one: '%{count} interval', other: '%{count} intervals' },
  },
  phases: {
    warmup: 'Warm Up',
    work: 'Work',
    rest: 'Rest',
    cooldown: 'Cool Down',
  },
  sessions: {
    title: 'My Sessions',
    empty: 'No sessions yet. Tap + to add one.',
    copyOf: 'Copy of %{name}',
    select: 'SELECT',
    deleteTitle: 'Delete Session',
    deleteMessage: 'Remove "%{name}"?',
  },
  workout: {
    done: 'DONE',
    getReady: 'GET READY',
    next: 'NEXT',
    finish: 'FINISH',
    intervalPrefix: 'INTERVAL ',
    intervalSuffix: ' OF %{total}',
    left: '%{time} left',
    phase: {
      warmup: 'WARM UP',
      work: 'WORK',
      rest: 'RECOVER',
      cooldown: 'COOL DOWN',
    },
  },
  congrats: [
    'You crushed it.',
    "That's what you're made of.",
    'Every rep counted.',
    'Nothing left in the tank. Perfect.',
    'Earned.',
    "That's the streak. Keep it.",
    'One more session in the bank.',
    "Progress doesn't lie.",
    "You showed up. That's everything.",
    "Tomorrow you'll be glad you did this.",
    'Your future self says thanks.',
    'Sweat well spent.',
    "Rest. You've earned it.",
    'Not bad at all.',
    "The couch wasn't this good anyway.",
    'Done. Well done.',
    'Work complete.',
    'That happened.',
    'Check.',
    'Session closed.',
  ],
  settings: {
    subtitle: 'Preferences',
    title: 'Settings',
    appearance: 'Appearance',
    sectionWorkout: 'Workout',
    congratsLabel: 'Congratulatory message',
    congratsSub: 'Full-screen celebration at workout end',
    countdownFlashLabel: 'Countdown flash',
    countdownFlashSub: 'Digits flash on last 3 seconds of each interval',
    keepAwakeLabel: 'Keep screen awake',
    keepAwakeSub: 'Prevent display sleep during workout',
    units: 'Units',
    speedUnitLabel: 'Speed unit',
    speedUnitSub: 'Display unit for Run session speeds',
    language: 'Language',
    languageSub: 'App display language',
    audio: 'Audio',
    soundOffLabel: 'Sound off',
    soundOffSub: 'Mute all audio',
    soundCuesLabel: 'Sound cues',
    soundCuesSub: 'Play tones on phase changes',
    finalBeepLabel: 'Final countdown beep',
    finalBeepSub: 'Audio cue in last 3 seconds',
    about: 'About',
    version: 'Version',
    rateApp: 'Rate the app',
  },
  edit: {
    editTitle: 'Edit Session',
    newTitle: 'New Session',
    nameLabel: 'SESSION NAME',
    namePlaceholder: 'e.g. Morning Blast',
    preview: 'PREVIEW',
    activityType: 'ACTIVITY TYPE',
    general: 'General',
    run: 'Run',
    setupMode: 'SETUP MODE',
    easy: 'Easy',
    advanced: 'Advanced',
    intervalPresets: 'INTERVAL PRESETS',
    speedPresets: 'SPEED PRESETS',
    presetEasy: 'Easy',
    presetHard: 'Hard',
    noIntervals: 'No intervals yet. Add one below.',
    addInterval: 'Add Interval',
    clearAll: 'Clear All',
    rounds: 'Rounds',
    saveChanges: 'SAVE CHANGES',
    save: 'SAVE',
    cancel: 'Cancel',
  },
  picker: {
    rounds: 'rounds',
    dec: 'dec',
    min: 'min',
    sec: 'sec',
    roundsTitle: 'Rounds',
    speedSuffix: '%{phase} Speed',
    intervalSpeedTitle: 'Interval %{n} Speed',
    intervalTitle: 'Interval %{n}',
  },
  alerts: {
    cannotSwitchEasyTitle: 'Cannot switch to Easy',
    overwriteTitle: 'Overwrite settings?',
    overwriteTimingMessage: 'Applying this preset will replace your current timing settings.',
    overwriteSpeedMessage: 'Applying this preset will replace your current speed settings.',
    apply: 'Apply',
    cancel: 'Cancel',
    unsavedTitle: 'Unsaved changes',
    unsavedMessage: 'Would you like to save before leaving?',
    saveBtn: 'Save',
    discard: 'Discard',
    keepEditing: 'Keep editing',
    nameRequiredTitle: 'Name required',
    nameRequiredMessage: 'Please enter a session name.',
    noIntervalsTitle: 'No intervals',
    noIntervalsMessage: 'Add at least one interval.',
  },
  validation: {
    noWorkIntervals: 'No work intervals found.',
    phaseNotAllowed: '"%{phase}" phase cannot appear between work intervals in easy mode.',
    mustStartWithWork: 'Intervals must start with a Work phase.',
    workRestPairing: 'Each Work interval must be paired with a Rest interval.',
    expectedWorkAt: 'Expected Work at position %{pos}.',
    expectedRestAfterWorkAt: 'Expected Rest after Work at position %{pos}.',
    sameWorkDuration: 'All Work intervals must have the same duration.',
    sameRestDuration: 'All Rest intervals must have the same duration.',
  },
  paywall: {
    title: 'Trial Ended',
    body: 'Your 30-day free trial has ended. Purchase to keep using all features.',
    purchase: 'Purchase',
    notNow: 'Not now',
    restore: 'Restore purchases',
  },
  defaultSessions: {
    tabata: 'Tabata Burnout',
    quick: 'Quick HiiT',
    run: 'Interval Run',
  },
} as const;

export default en;
```

- [ ] **Step 3: Create the Spanish dictionary**

Create `src/locales/es.ts`. It is typed against `en` via a `DeepPartialSame` helper so structure must match while values are translated. Use a plain typed object:

```ts
import en from './en';

// es must mirror en's shape exactly; typing as `typeof en` (loosened to string
// for leaf values) makes tsc flag any missing or renamed key.
type Dictionary = {
  [K in keyof typeof en]: typeof en[K] extends readonly string[]
    ? string[]
    : typeof en[K] extends Record<string, unknown>
      ? { [P in keyof typeof en[K]]: typeof en[K][P] extends Record<string, unknown>
          ? { [Q in keyof typeof en[K][P]]: string }
          : string }
      : string;
};

export const es: Dictionary = {
  common: {
    cancel: 'Cancelar',
    save: 'Guardar',
    done: 'Listo',
    delete: 'Eliminar',
    duplicate: 'Duplicar',
    apply: 'Aplicar',
    intervalsCount: { one: '%{count} intervalo', other: '%{count} intervalos' },
  },
  phases: {
    warmup: 'Calentamiento',
    work: 'Trabajo',
    rest: 'Descanso',
    cooldown: 'Enfriamiento',
  },
  sessions: {
    title: 'Mis sesiones',
    empty: 'No hay sesiones. Toca + para añadir una.',
    copyOf: 'Copia de %{name}',
    select: 'SELECCIONAR',
    deleteTitle: 'Eliminar sesión',
    deleteMessage: '¿Eliminar "%{name}"?',
  },
  workout: {
    done: 'HECHO',
    getReady: 'PREPÁRATE',
    next: 'SIGUIENTE',
    finish: 'FIN',
    intervalPrefix: 'INTERVALO ',
    intervalSuffix: ' DE %{total}',
    left: '%{time} restante',
    phase: {
      warmup: 'CALENTAMIENTO',
      work: 'TRABAJO',
      rest: 'RECUPERA',
      cooldown: 'ENFRIAMIENTO',
    },
  },
  congrats: [
    'Lo lograste.',
    'De eso estás hecho.',
    'Cada repetición contó.',
    'Sin nada en el tanque. Perfecto.',
    'Merecido.',
    'Esa es la racha. Mantenla.',
    'Una sesión más en el banco.',
    'El progreso no miente.',
    'Apareciste. Eso lo es todo.',
    'Mañana te alegrarás de haberlo hecho.',
    'Tu yo del futuro te lo agradece.',
    'Sudor bien invertido.',
    'Descansa. Te lo has ganado.',
    'Nada mal.',
    'El sofá no era tan bueno de todos modos.',
    'Hecho. Bien hecho.',
    'Trabajo completado.',
    'Eso pasó.',
    'Hecho.',
    'Sesión cerrada.',
  ],
  settings: {
    subtitle: 'Preferencias',
    title: 'Ajustes',
    appearance: 'Apariencia',
    sectionWorkout: 'Entrenamiento',
    congratsLabel: 'Mensaje de felicitación',
    congratsSub: 'Celebración a pantalla completa al terminar',
    countdownFlashLabel: 'Parpadeo de cuenta atrás',
    countdownFlashSub: 'Los dígitos parpadean en los últimos 3 segundos de cada intervalo',
    keepAwakeLabel: 'Mantener pantalla encendida',
    keepAwakeSub: 'Evita que la pantalla se apague durante el entrenamiento',
    units: 'Unidades',
    speedUnitLabel: 'Unidad de velocidad',
    speedUnitSub: 'Unidad para las velocidades de sesiones de carrera',
    language: 'Idioma',
    languageSub: 'Idioma de la aplicación',
    audio: 'Audio',
    soundOffLabel: 'Silenciar',
    soundOffSub: 'Silenciar todo el audio',
    soundCuesLabel: 'Señales de sonido',
    soundCuesSub: 'Reproduce tonos al cambiar de fase',
    finalBeepLabel: 'Pitido final',
    finalBeepSub: 'Señal de audio en los últimos 3 segundos',
    about: 'Acerca de',
    version: 'Versión',
    rateApp: 'Valorar la app',
  },
  edit: {
    editTitle: 'Editar sesión',
    newTitle: 'Nueva sesión',
    nameLabel: 'NOMBRE DE LA SESIÓN',
    namePlaceholder: 'p. ej. Explosión matutina',
    preview: 'VISTA PREVIA',
    activityType: 'TIPO DE ACTIVIDAD',
    general: 'General',
    run: 'Correr',
    setupMode: 'MODO DE CONFIGURACIÓN',
    easy: 'Fácil',
    advanced: 'Avanzado',
    intervalPresets: 'PREAJUSTES DE INTERVALO',
    speedPresets: 'PREAJUSTES DE VELOCIDAD',
    presetEasy: 'Fácil',
    presetHard: 'Difícil',
    noIntervals: 'Aún no hay intervalos. Añade uno abajo.',
    addInterval: 'Añadir intervalo',
    clearAll: 'Borrar todo',
    rounds: 'Rondas',
    saveChanges: 'GUARDAR CAMBIOS',
    save: 'GUARDAR',
    cancel: 'Cancelar',
  },
  picker: {
    rounds: 'rondas',
    dec: 'dec',
    min: 'min',
    sec: 'seg',
    roundsTitle: 'Rondas',
    speedSuffix: 'Velocidad de %{phase}',
    intervalSpeedTitle: 'Velocidad del intervalo %{n}',
    intervalTitle: 'Intervalo %{n}',
  },
  alerts: {
    cannotSwitchEasyTitle: 'No se puede cambiar a Fácil',
    overwriteTitle: '¿Sobrescribir ajustes?',
    overwriteTimingMessage: 'Aplicar este preajuste reemplazará tus ajustes de tiempo actuales.',
    overwriteSpeedMessage: 'Aplicar este preajuste reemplazará tus ajustes de velocidad actuales.',
    apply: 'Aplicar',
    cancel: 'Cancelar',
    unsavedTitle: 'Cambios sin guardar',
    unsavedMessage: '¿Quieres guardar antes de salir?',
    saveBtn: 'Guardar',
    discard: 'Descartar',
    keepEditing: 'Seguir editando',
    nameRequiredTitle: 'Nombre obligatorio',
    nameRequiredMessage: 'Introduce un nombre para la sesión.',
    noIntervalsTitle: 'Sin intervalos',
    noIntervalsMessage: 'Añade al menos un intervalo.',
  },
  validation: {
    noWorkIntervals: 'No se encontraron intervalos de trabajo.',
    phaseNotAllowed: 'La fase "%{phase}" no puede aparecer entre intervalos de trabajo en modo fácil.',
    mustStartWithWork: 'Los intervalos deben empezar con una fase de Trabajo.',
    workRestPairing: 'Cada intervalo de Trabajo debe ir emparejado con uno de Descanso.',
    expectedWorkAt: 'Se esperaba Trabajo en la posición %{pos}.',
    expectedRestAfterWorkAt: 'Se esperaba Descanso después de Trabajo en la posición %{pos}.',
    sameWorkDuration: 'Todos los intervalos de Trabajo deben tener la misma duración.',
    sameRestDuration: 'Todos los intervalos de Descanso deben tener la misma duración.',
  },
  paywall: {
    title: 'Prueba finalizada',
    body: 'Tu prueba gratuita de 30 días ha finalizado. Compra para seguir usando todas las funciones.',
    purchase: 'Comprar',
    notNow: 'Ahora no',
    restore: 'Restaurar compras',
  },
  defaultSessions: {
    tabata: 'Tabata a tope',
    quick: 'HIIT rápido',
    run: 'Carrera por intervalos',
  },
};

export default es;
```

- [ ] **Step 4: Create the i18n module**

Create `src/lib/i18n.ts`:

```ts
import { useCallback } from 'react';
import { I18n } from 'i18n-js';
import en from '../locales/en';
import es from '../locales/es';
import { useSettings } from './settingsContext';

export type Language = 'en' | 'es';

export const i18n = new I18n(
  { en, es },
  { locale: 'en', defaultLocale: 'en', enableFallback: true },
);

export function detectLanguage(): Language {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    return getLocales()[0]?.languageCode === 'es' ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

export function getCongratsMessages(): string[] {
  const table = i18n.translations[i18n.locale] as typeof en | undefined;
  return (table?.congrats ?? en.congrats) as string[];
}

export function useTranslation() {
  const { settings } = useSettings();
  const locale = settings.language;
  const t = useCallback(
    (scope: string, opts?: object) => i18n.t(scope, { locale, ...opts }),
    [locale],
  );
  return { t, locale };
}
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors. (If `es.ts` is missing or misnames a key, tsc fails here — that is the safety net working; fix the dictionary.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/locales/en.ts src/locales/es.ts src/lib/i18n.ts
git commit -m "feat: add i18n-js, en/es dictionaries, and i18n module"
```

---

### Task 2: Add language to Settings and wire it in App.tsx

**Files:**
- Modify: `src/lib/settings.ts` (Settings type + DEFAULT_SETTINGS)
- Modify: `App.tsx:23` (import), `App.tsx:59-68` (load effect), `App.tsx:76-83` (updateSettings)

**Interfaces:**
- Consumes: `detectLanguage`, `i18n` from `src/lib/i18n.ts`; `Language` type.
- Produces: `Settings.language: 'en' | 'es'`, `Settings.languageIsManuallySet: boolean`.

- [ ] **Step 1: Add fields to the Settings type and defaults**

In `src/lib/settings.ts`, add to the `Settings` interface (after `speedUnitIsManuallySet`):

```ts
  language: 'en' | 'es';
  languageIsManuallySet: boolean;
```

And to `DEFAULT_SETTINGS` (after `speedUnitIsManuallySet: false,`):

```ts
  language: 'en',
  languageIsManuallySet: false,
```

- [ ] **Step 2: Import i18n helpers in App.tsx**

In `App.tsx`, add below the settings import (line 23):

```ts
import { detectLanguage, i18n } from './src/lib/i18n';
```

- [ ] **Step 3: Resolve and apply language on load**

Replace the load effect body (`App.tsx:60-67`) with:

```ts
    loadSettings().then(s => {
      const resolved: Settings = {
        ...s,
        speedUnit: s.speedUnitIsManuallySet ? s.speedUnit : detectSpeedUnit(),
        language: s.languageIsManuallySet ? s.language : detectLanguage(),
      };
      i18n.locale = resolved.language;
      setSettings(resolved);
      setThemeKey(resolved.theme);
      if (!s.speedUnitIsManuallySet || !s.languageIsManuallySet) saveSettings(resolved);
    });
```

- [ ] **Step 4: Handle the language override in updateSettings**

Replace the `updateSettings` body (`App.tsx:77-82`) with:

```ts
    const next: Settings =
      key === ('speedUnit' satisfies keyof Settings)
        ? { ...settings, speedUnit: value as 'km' | 'miles', speedUnitIsManuallySet: true }
        : key === ('language' satisfies keyof Settings)
          ? { ...settings, language: value as 'en' | 'es', languageIsManuallySet: true }
          : { ...settings, [key]: value };
    if (key === ('language' satisfies keyof Settings)) i18n.locale = value as 'en' | 'es';
    setSettings(next);
    saveSettings(next);
    if (key === ('theme' satisfies keyof Settings)) setThemeKey(value as ThemeKey);
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.
Manual: `npx expo start`, launch the app. With device language set to Spanish the app boots without crashing (UI still English until later tasks). With English it also boots. (Just confirming no regressions; visible translation comes next.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/settings.ts App.tsx
git commit -m "feat: persist and auto-detect app language in settings"
```

---

### Task 3: Settings screen — Language control and translated strings

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `useTranslation` from `src/lib/i18n.ts`.

- [ ] **Step 1: Import the hook**

Add to `src/screens/SettingsScreen.tsx` imports:

```ts
import { useTranslation } from '../lib/i18n';
```

- [ ] **Step 2: Use the hook and translate static strings**

In the component body (near `const { settings, updateSettings } = useSettings();`) add:

```ts
  const { t } = useTranslation();
```

Replace these literals (exact mapping):

- `subtitle="Preferences" title="Settings"` → `subtitle={t('settings.subtitle')} title={t('settings.title')}`
- `Appearance` → `{t('settings.appearance')}`
- `title="Workout"` → `title={t('settings.sectionWorkout')}`
- `label="Congratulatory message"` → `label={t('settings.congratsLabel')}`; `sub="Full-screen celebration at workout end"` → `sub={t('settings.congratsSub')}`
- `label="Countdown flash"` → `label={t('settings.countdownFlashLabel')}`; `sub="Digits flash on last 3 seconds of each interval"` → `sub={t('settings.countdownFlashSub')}`
- `label="Keep screen awake"` → `label={t('settings.keepAwakeLabel')}`; `sub="Prevent display sleep during workout"` → `sub={t('settings.keepAwakeSub')}`
- `title="Units"` → `title={t('settings.units')}`
- `label="Speed unit"` → `label={t('settings.speedUnitLabel')}`; `sub="Display unit for Run session speeds"` → `sub={t('settings.speedUnitSub')}`
- `title="Audio"` → `title={t('settings.audio')}`
- `label="Sound off"` → `label={t('settings.soundOffLabel')}`; `sub="Mute all audio"` → `sub={t('settings.soundOffSub')}`
- `label="Sound cues"` → `label={t('settings.soundCuesLabel')}`; `sub="Play tones on phase changes"` → `sub={t('settings.soundCuesSub')}`
- `label="Final countdown beep"` → `label={t('settings.finalBeepLabel')}`; `sub="Audio cue in last 3 seconds"` → `sub={t('settings.finalBeepSub')}`
- `title="About"` → `title={t('settings.about')}`
- `label="Version"` → `label={t('settings.version')}`
- `label="Rate the app"` → `label={t('settings.rateApp')}`

Leave the `Developer` section (dev-only) and the `km/h` / `mph` segmented labels as-is (units are not translated per Global Constraints).

- [ ] **Step 3: Add the Language control**

Insert a new `SettingsSection` immediately after the closing `</SettingsSection>` of the Units section (after `App.tsx`-style line ~111):

```tsx
        {/* ── Language ── */}
        <SettingsSection title={t('settings.language')}>
          <SettingsRow
            label={t('settings.language')}
            sub={t('settings.languageSub')}
            last
            right={
              <View style={styles.segControl}>
                {(['en', 'es'] as const).map(lng => (
                  <Pressable
                    key={lng}
                    onPress={() => updateSettings('language', lng)}
                    style={[
                      styles.segBtn,
                      settings.language === lng && { backgroundColor: T.accent },
                    ]}
                  >
                    <Text style={[
                      styles.segBtnText,
                      { color: settings.language === lng ? T.btnGlyph : T.subText },
                    ]}>
                      {lng === 'en' ? 'English' : 'Español'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            }
          />
        </SettingsSection>
```

(`styles.segControl`, `styles.segBtn`, `styles.segBtnText` already exist and are reused.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.
Manual: Open Settings. Toggle the Language control between English / Español; every label, sub-label, and section title on the Settings screen switches language immediately.

- [ ] **Step 5: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: add language control and translate settings screen"
```

---

### Task 4: Translate the validation layer (workout.ts + sessionDraft.ts)

**Files:**
- Modify: `src/lib/workout.ts:90-92` (type), `src/lib/workout.ts:118-146` (returns)
- Modify: `src/lib/sessionDraft.ts:38-45` (validateDraft)

**Interfaces:**
- Produces:
  - `ConvertToEasyResult` failure becomes `{ ok: false; reasonKey: string; reasonParams?: Record<string, string | number> }`.
  - `validateDraft` failure becomes `{ ok: false; titleKey: string; messageKey: string }`.
- These keys/params are translated by callers in Task 5.

- [ ] **Step 1: Change the ConvertToEasyResult type**

In `src/lib/workout.ts`, replace lines 90-92:

```ts
export type ConvertToEasyResult =
  | { ok: true; warmup: number; work: number; rest: number; rounds: number; cooldown: number }
  | { ok: false; reasonKey: string; reasonParams?: Record<string, string | number> };
```

- [ ] **Step 2: Replace the failure returns in tryConvertToEasy**

Replace each `return { ok: false, reason: ... }` inside `tryConvertToEasy` (lines 118-145) as follows:

- Line 118 → `return { ok: false, reasonKey: 'validation.noWorkIntervals' };`
- Lines 121-122 (the phase loop) →
  ```ts
    if (iv.type !== 'work' && iv.type !== 'rest')
      return { ok: false, reasonKey: 'validation.phaseNotAllowed', reasonParams: { phase: iv.type } };
  ```
  (The caller resolves `phase` to a translated phase word.)
- Line 124 → `if (list[0].type !== 'work') return { ok: false, reasonKey: 'validation.mustStartWithWork' };`
- Line 129 → `return { ok: false, reasonKey: 'validation.workRestPairing' };`
- Line 131 → `if (list[i].type !== 'work')     return { ok: false, reasonKey: 'validation.expectedWorkAt', reasonParams: { pos: i + 1 } };`
- Line 132 → `if (list[i + 1].type !== 'rest') return { ok: false, reasonKey: 'validation.expectedRestAfterWorkAt', reasonParams: { pos: i + 1 } };`
- Line 137 → `if (list[i].dur !== workDur)     return { ok: false, reasonKey: 'validation.sameWorkDuration' };`
- Line 138 → `if (list[i + 1].dur !== restDur) return { ok: false, reasonKey: 'validation.sameRestDuration' };`
- Line 144 → `if (iv.dur !== workDur) return { ok: false, reasonKey: 'validation.sameWorkDuration' };`

Leave the `PHASE_META` import/usage removal alone — `PHASE_META` is still defined and used by WorkoutScreen; only the validation string stopped referencing it.

- [ ] **Step 3: Change validateDraft to return keys**

In `src/lib/sessionDraft.ts`, replace the signature/returns (lines 38-45):

```ts
): { ok: true } | { ok: false; titleKey: string; messageKey: string } {
  // ...existing name check...
    return { ok: false, titleKey: 'alerts.nameRequiredTitle', messageKey: 'alerts.nameRequiredMessage' };
  // ...existing intervals check...
    return { ok: false, titleKey: 'alerts.noIntervalsTitle', messageKey: 'alerts.noIntervalsMessage' };
  return { ok: true };
```

(Keep the existing `if` conditions; only the returned objects change.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: errors ONLY at the two call sites that consume the old shape — `src/hooks/useEditSession.ts:342` (`result.reason`) and `:451` (`validation.title` / `.message`). These are fixed in Task 5. To confirm the lib files themselves are clean, the errors must reference only `useEditSession.ts`. If any error points at `workout.ts` or `sessionDraft.ts`, fix it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workout.ts src/lib/sessionDraft.ts
git commit -m "feat: return translation keys from validation logic"
```

---

### Task 5: Edit cluster — EditSessionScreen, useEditSession, PickerModal, IntervalRow

**Files:**
- Modify: `src/hooks/useEditSession.ts` (pickerTitle, alerts, convert/validation call sites)
- Modify: `src/screens/EditSessionScreen.tsx`
- Modify: `src/components/PickerModal.tsx`
- Modify: `src/components/IntervalRow.tsx`

**Interfaces:**
- Consumes: `i18n` (in the hook), `useTranslation` (in components), the key shapes from Task 4.

- [ ] **Step 1: Import i18n in the hook**

In `src/hooks/useEditSession.ts`, add:

```ts
import { i18n } from '../lib/i18n';
```

- [ ] **Step 2: Translate pickerTitle**

Replace the `pickerTitle` IIFE (`useEditSession.ts:110-125`) with:

```ts
  const pickerTitle = (() => {
    if (!activePicker) return '';
    if (activePicker.type === 'rounds') return i18n.t('picker.roundsTitle');
    if (activePicker.type === 'field') return i18n.t('phases.' + activePicker.field);
    if (activePicker.type === 'speed') {
      const phase = activePicker.field.replace('Speed', '');
      return i18n.t('picker.speedSuffix', { phase: i18n.t('phases.' + phase) });
    }
    if (activePicker.type === 'intervalSpeed') {
      const idx = intervals.findIndex(iv => iv._key === activePicker.key);
      return i18n.t('picker.intervalSpeedTitle', { n: idx + 1 });
    }
    const idx = intervals.findIndex(iv => iv._key === activePicker.key);
    return i18n.t('picker.intervalTitle', { n: idx + 1 });
  })();
```

(`activePicker.field` for `'field'` is `'warmup' | 'work' | 'rest' | 'cooldown'`, matching `phases.*` keys.)

- [ ] **Step 3: Translate the convert-to-easy alert**

Replace `useEditSession.ts:342`:

```ts
        Alert.alert(
          i18n.t('alerts.cannotSwitchEasyTitle'),
          i18n.t(result.reasonKey, result.reasonParams?.phase !== undefined
            ? { ...result.reasonParams, phase: i18n.t('phases.' + result.reasonParams.phase) }
            : result.reasonParams),
        );
```

- [ ] **Step 4: Translate the preset-overwrite alerts**

Replace the timing alert (`useEditSession.ts:407-411`):

```ts
      Alert.alert(
        i18n.t('alerts.overwriteTitle'),
        i18n.t('alerts.overwriteTimingMessage'),
        [
          { text: i18n.t('alerts.cancel'), style: 'cancel' },
          { text: i18n.t('alerts.apply'), onPress: doApply },
        ],
      );
```

Replace the speed alert (`useEditSession.ts:424-428`):

```ts
      Alert.alert(
        i18n.t('alerts.overwriteTitle'),
        i18n.t('alerts.overwriteSpeedMessage'),
        [
          { text: i18n.t('alerts.cancel'), style: 'cancel' },
          { text: i18n.t('alerts.apply'), onPress: doApply },
        ],
      );
```

- [ ] **Step 5: Translate the validation + unsaved-changes alerts**

Replace `useEditSession.ts:451`:

```ts
      Alert.alert(i18n.t(validation.titleKey), i18n.t(validation.messageKey));
```

Replace the cancel/unsaved alert (`useEditSession.ts:472-480`):

```ts
      Alert.alert(
        i18n.t('alerts.unsavedTitle'),
        i18n.t('alerts.unsavedMessage'),
        [
          { text: i18n.t('alerts.saveBtn'), onPress: () => save() },
          { text: i18n.t('alerts.discard'), style: 'destructive', onPress: onBack },
          { text: i18n.t('alerts.keepEditing'), style: 'cancel' },
        ],
      );
```

- [ ] **Step 6: Translate EditSessionScreen**

In `src/screens/EditSessionScreen.tsx` add `import { useTranslation } from '../lib/i18n';` and, in the component body after `const { settings } = useSettings();`, add `const { t } = useTranslation();`.

Change the phase field-label arrays (lines 63-75) to use translated labels:

```ts
  const timeFields: { label: string; field: TimeField }[] = [
    { label: t('phases.warmup'),   field: 'warmup'   },
    { label: t('phases.work'),     field: 'work'     },
    { label: t('phases.rest'),     field: 'rest'     },
    { label: t('phases.cooldown'), field: 'cooldown' },
  ];

  const speedFields: { label: string; field: keyof RunSpeeds }[] = [
    { label: t('phases.warmup'),   field: 'warmupSpeed'   },
    { label: t('phases.work'),     field: 'workSpeed'     },
    { label: t('phases.rest'),     field: 'restSpeed'     },
    { label: t('phases.cooldown'), field: 'cooldownSpeed' },
  ];
```

Replace literals:
- `title={isEditing ? 'Edit Session' : 'New Session'}` → `title={isEditing ? t('edit.editTitle') : t('edit.newTitle')}`
- `SESSION NAME` → `{t('edit.nameLabel')}`
- `placeholder="e.g. Morning Blast"` → `placeholder={t('edit.namePlaceholder')}`
- `PREVIEW` → `{t('edit.preview')}`
- The preview meta (lines 130-132) → `{fmtDuration(previewTotal)} · {t('common.intervalsCount', { count: previewSegments.length })}`
- `ACTIVITY TYPE` → `{t('edit.activityType')}`
- `General` → `{t('edit.general')}`; `Run` → `{t('edit.run')}`
- `SETUP MODE` → `{t('edit.setupMode')}`
- `Easy` (mode label, line 160) → `{t('edit.easy')}`; `Advanced` → `{t('edit.advanced')}`
- `INTERVAL PRESETS` (both occurrences) → `{t('edit.intervalPresets')}`
- `SPEED PRESETS` (both occurrences) → `{t('edit.speedPresets')}`
- `No intervals yet. Add one below.` → `{t('edit.noIntervals')}`
- `Add Interval` → `{t('edit.addInterval')}`
- `Clear All` → `{t('edit.clearAll')}`
- `Rounds` (line 248) → `{t('edit.rounds')}`
- `{isEditing ? 'SAVE CHANGES' : 'SAVE'}` → `{isEditing ? t('edit.saveChanges') : t('edit.save')}`
- `Cancel` (line 297) → `{t('edit.cancel')}`

In the `PresetStrip` component, the `Easy` / `Hard` range labels (lines 339-340): pass them down. Add a `t` to PresetStrip's props OR (simpler) translate at the call sites by passing labels. Easiest surgical change: import `useTranslation` is not available in the nested `PresetStrip` (defined at module scope). Add `t` to its props:

```ts
function PresetStrip({ onApply, T, styles, activePreset, t }: {
  onApply: (level: PresetLevel) => void;
  T: ThemeTokens;
  styles: ReturnType<typeof makeStyles>;
  activePreset?: PresetLevel | null;
  t: (scope: string, opts?: object) => string;
}) {
```

Replace `>Easy<` → `>{t('edit.presetEasy')}<` and `>Hard<` → `>{t('edit.presetHard')}<`, and pass `t={t}` at all four `<PresetStrip ... />` usages.

Leave the swipe `Duplicate` / `Delete` action labels for Step 8.

- [ ] **Step 7: Translate the swipe action labels in EditSessionScreen**

`IntervalSwipeDuplicateAction` and the delete `Pressable` are module-scope. Add `t` to their props the same way and replace `>Duplicate<` → `>{t('common.duplicate')}<` and `>Delete<` → `>{t('common.delete')}<`. Thread `t` from `IntervalSwipeRow` (add `t` to its props and pass it down) and from the `renderItem` in the screen body where `<IntervalSwipeRow ... />` is rendered (`t={t}`).

- [ ] **Step 8: Translate PickerModal**

In `src/components/PickerModal.tsx` add `import { useTranslation } from '../lib/i18n';` and `const { t } = useTranslation();` in the component. Replace:
- `Cancel` → `{t('common.cancel')}`
- `Done` → `{t('common.done')}`
- `rounds` → `{t('picker.rounds')}`
- `dec` → `{t('picker.dec')}`
- `min` → `{t('picker.min')}`
- `sec` → `{t('picker.sec')}`

Leave `picker?.title` (already translated upstream) and the `mph`/`km/h` unit label unchanged.

- [ ] **Step 9: Translate IntervalRow**

In `src/components/IntervalRow.tsx` add `import { useTranslation } from '../lib/i18n';`. Remove the `PHASE_LABELS` constant (lines 6-11) — it is replaced by translations. In the component add `const { t } = useTranslation();` and replace `{PHASE_LABELS[interval.type]}` (line 40) with `{t('phases.' + interval.type)}`.

- [ ] **Step 10: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.
Manual: With language = Español, open Edit Session (new and existing). Confirm: title, all field labels, preset Easy/Hard, Add Interval / Clear All, Save/Cancel, the phase pills in interval rows, the picker title + Done/Cancel + min/sec, and the swipe Duplicate/Delete labels are Spanish. Trigger a switch-to-Easy failure (e.g. an unpaired interval set) and confirm the alert text is Spanish.

- [ ] **Step 11: Commit**

```bash
git add src/hooks/useEditSession.ts src/screens/EditSessionScreen.tsx src/components/PickerModal.tsx src/components/IntervalRow.tsx
git commit -m "feat: translate edit session screen, picker, and interval row"
```

---

### Task 6: Workout cluster — WorkoutScreen + congrats messages

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx`
- Modify: `src/hooks/useWorkoutSession.ts:7-29` (CONGRATS), `:62-63` (selection)

**Interfaces:**
- Consumes: `useTranslation`, `getCongratsMessages` from `src/lib/i18n.ts`.

- [ ] **Step 1: Source congrats from the dictionary**

In `src/hooks/useWorkoutSession.ts`, remove the `CONGRATS` array (lines 7-29) and add `import { getCongratsMessages } from '../lib/i18n';`. Replace the selection (lines 62-63):

```ts
  const [congratsMsg] = useState(() => {
    const list = getCongratsMessages();
    return list[Math.floor(Math.random() * list.length)];
  });
```

- [ ] **Step 2: Translate WorkoutScreen text**

In `src/screens/WorkoutScreen.tsx` add `import { useTranslation } from '../lib/i18n';` and `const { t } = useTranslation();` in the component body (after `const { settings } = useSettings();`).

Replace the phase word usages with the workout-phase keys and the state words:
- Line 150: `{isDone ? 'DONE' : isPreStart ? 'GET READY' : meta.word}` → `{isDone ? t('workout.done') : isPreStart ? t('workout.getReady') : t('workout.phase.' + seg.phase)}`
- Line 235: `{nextMeta.word}` → `{t('workout.phase.' + nextSeg!.phase)}`
- Line 244: `FINISH` → `{t('workout.finish')}`
- Line 231: `NEXT` → `{t('workout.next')}`

Replace the interval counter (lines 190-194):

```tsx
            <Text style={[styles.intervalCounter, isPreStart && { opacity: 0 }]}>
              {t('workout.intervalPrefix')}
              <Text style={{ color: T.onBg }}>{intervalNum}</Text>
              {t('workout.intervalSuffix', { total: segments.length })}
            </Text>
```

Replace the "left" label (line 302): `{displayRemaining} left` → `{t('workout.left', { time: displayRemaining })}`.

`meta`/`nextMeta` are now only used for nothing else — verify: `PHASE_META` import and `meta`/`nextMeta` locals become unused after this change. Remove the now-unused `meta`/`nextMeta` locals (lines 84-85) and the `PHASE_META` import (line 15) **only if** tsc/no-unused flags them; `nextMeta` is still used as a truthiness check on line 229 (`nextMeta ?`), so keep `nextMeta` and its line 85, and keep computing it. Re-check: line 229 uses `nextMeta` as the conditional. So keep `nextMeta`. `meta` (line 84) is used only at line 150 which we changed — remove `const meta = PHASE_META[seg.phase];` and, if `PHASE_META` then has no other references in this file, remove it from the import on line 15. (`nextMeta` still needs `PHASE_META`, so the import stays and line 85 stays.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.
Manual: With language = Español, start a workout. Confirm the big phase word (CALENTAMIENTO/TRABAJO/RECUPERA/ENFRIAMIENTO), PREPÁRATE, HECHO, the "INTERVALO n DE total" line, NEXT/SIGUIENTE, FINISH/FIN, the congrats message, and "%{time} restante" are all Spanish. Switch language to English and repeat.

- [ ] **Step 4: Commit**

```bash
git add src/screens/WorkoutScreen.tsx src/hooks/useWorkoutSession.ts
git commit -m "feat: translate workout screen and congrats messages"
```

---

### Task 7: Sessions list cluster — SessionsListScreen, SessionCard, PaywallModal, alerts.ts

**Files:**
- Modify: `src/screens/SessionsListScreen.tsx`
- Modify: `src/components/SessionCard.tsx`
- Modify: `src/components/PaywallModal.tsx`
- Modify: `src/lib/alerts.ts`

**Interfaces:**
- Consumes: `useTranslation` (components/screens), `i18n` (alerts.ts).

- [ ] **Step 1: Translate alerts.ts**

Replace `src/lib/alerts.ts` body:

```ts
import { Alert } from 'react-native';
import { i18n } from './i18n';

export function confirmDeleteSession(name: string, onConfirm: () => void, onCancel?: () => void) {
  Alert.alert(
    i18n.t('sessions.deleteTitle'),
    i18n.t('sessions.deleteMessage', { name }),
    [
      { text: i18n.t('common.cancel'), style: 'cancel', onPress: onCancel },
      { text: i18n.t('common.delete'), style: 'destructive', onPress: onConfirm },
    ],
  );
}
```

- [ ] **Step 2: Translate SessionsListScreen**

Add `import { useTranslation } from '../lib/i18n';` and `const { t } = useTranslation();` in the component. Replace:
- `title="My Sessions"` → `title={t('sessions.title')}`
- `No sessions yet. Tap + to add one.` (line 92) → `{t('sessions.empty')}`
- The duplicate name (line 36): `name: \`Copy of ${session.name}\`` → `name: t('sessions.copyOf', { name: session.name })`

- [ ] **Step 3: Translate SessionCard**

Add `import { useTranslation } from '../lib/i18n';` and `const { t } = useTranslation();`. Replace:
- The stats intervals (lines 67-69):
  ```tsx
          <Text style={styles.statValue}>{segments.length}</Text>
          <Text style={styles.statLabel}> {t('common.intervalsCount', { count: segments.length })}</Text>
  ```
  Wait — `statValue` already shows the number. Replace the two-Text stat with a single translated string to avoid duplicating the count:
  ```tsx
        <View style={styles.statsRow}>
          <Text style={styles.statValue}>{fmtDuration(total)}</Text>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>{t('common.intervalsCount', { count: segments.length })}</Text>
          </View>
        </View>
  ```
  (Removes the separate numeric `statValue` for intervals; `common.intervalsCount` already includes the number. The duration `statValue` stays.)
- `SELECT` (line 74) → `{t('sessions.select')}`

- [ ] **Step 4: Translate PaywallModal**

Add `import { useTranslation } from '../lib/i18n';` and `const { t } = useTranslation();`. Replace:
- `Trial Ended` → `{t('paywall.title')}`
- The body paragraph → `{t('paywall.body')}`
- `Purchase` → `{t('paywall.purchase')}`
- `Not now` → `{t('paywall.notNow')}`
- `Restore purchases` → `{t('paywall.restore')}`

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.
Manual: With language = Español, on the Sessions list confirm the header, empty state (delete all sessions to see it), the "%{count} intervalos" stat, and SELECCIONAR. Swipe-delete a session → Spanish confirm dialog. Trigger the paywall (Dev: expire trial, then add session) → Spanish paywall.

- [ ] **Step 6: Commit**

```bash
git add src/screens/SessionsListScreen.tsx src/components/SessionCard.tsx src/components/PaywallModal.tsx src/lib/alerts.ts
git commit -m "feat: translate sessions list, card, paywall, and delete alert"
```

---

### Task 8: Localize default session names at seed time

**Files:**
- Modify: `src/lib/sessions.ts:58-99` (DEFAULT_SESSIONS → getDefaultSessions, loadSessions)
- Modify: `src/screens/SessionsListScreen.tsx:31` (loadSessions call)
- Modify: `src/hooks/useEditSession.ts:456` (loadSessions call)

**Interfaces:**
- Consumes: `i18n`, `Language` from `src/lib/i18n.ts`.
- Produces: `getDefaultSessions(language: Language): Session[]`; `loadSessions(language: Language): Promise<Session[]>`.

- [ ] **Step 1: Replace the constant with a factory**

In `src/lib/sessions.ts` add `import { i18n, type Language } from './i18n';` and replace the `DEFAULT_SESSIONS` const (lines 58-88) with:

```ts
export function getDefaultSessions(language: Language): Session[] {
  const name = (key: string) => i18n.t('defaultSessions.' + key, { locale: language });
  return [
    {
      id: 'default-1',
      name: name('tabata'),
      mode: 'easy',
      config: { warmup: 45, high: 20, low: 10, rounds: 8, cooldown: 60 },
    },
    {
      id: 'default-2',
      name: name('quick'),
      mode: 'advanced',
      intervals: [
        { type: 'warmup',   dur: 20 },
        { type: 'work',     dur: 20 },
        { type: 'rest',     dur: 10 },
        { type: 'work',     dur: 30 },
        { type: 'rest',     dur: 15 },
        { type: 'work',     dur: 20 },
        { type: 'rest',     dur: 10 },
        { type: 'cooldown', dur: 30 },
      ],
    },
    {
      id: 'default-run-2',
      name: name('run'),
      mode: 'easy',
      activityType: 'run',
      config: { warmup: 300, high: 30, low: 90, rounds: 6, cooldown: 300 },
      runSpeeds: { warmupSpeed: 7, workSpeed: 11, restSpeed: 6, cooldownSpeed: 5.5 },
    },
  ];
}
```

- [ ] **Step 2: Thread language into loadSessions**

Replace `loadSessions` (lines 90-99):

```ts
export async function loadSessions(language: Language): Promise<Session[]> {
  try {
    const f = sessionsFile();
    if (!f.exists) return getDefaultSessions(language);
    const raw = await f.text();
    return JSON.parse(raw) as Session[];
  } catch {
    return getDefaultSessions(language);
  }
}
```

`deleteSessionById` (line 112) also calls `loadSessions()` — but at that point the file always exists (you can only delete an existing, persisted session). Pass the current locale to satisfy the signature: change line 112 to `const sessions = await loadSessions(i18n.locale as Language);`.

- [ ] **Step 3: Update SessionsListScreen call site**

In `src/screens/SessionsListScreen.tsx`, the component already has `const { settings } = useSettings();`? It does not — add it. Add `import { useSettings } from '../lib/settingsContext';`, add `const { settings } = useSettings();` in the component, and change the load effect (line 31):

```ts
    loadSessions(settings.language).then(setSessions);
```

Add `settings.language` to the effect's dependency array: `}, [settings.language]);` so switching language re-seeds the displayed default names (only matters before first mutation).

- [ ] **Step 4: Update useEditSession call site**

In `src/hooks/useEditSession.ts` (which already imports `i18n` from Task 5), change the save load (line 456):

```ts
    const sessions = await loadSessions(i18n.locale as 'en' | 'es');
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: no errors. (If any other caller of `loadSessions()` exists without an arg, tsc flags it — fix by passing the locale.)
Manual: Delete the app's stored sessions (fresh install or clear data). With device language Spanish, launch: the three default sessions appear with Spanish names (Tabata a tope / HIIT rápido / Carrera por intervalos). Switch the in-app Language to English: names flip to English (because defaults are not yet persisted). Edit/save any session, then confirm names now stay frozen in whatever language was shown.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sessions.ts src/screens/SessionsListScreen.tsx src/hooks/useEditSession.ts
git commit -m "feat: localize default session names at seed time"
```

---

### Task 9: Declare supported locales for iOS

**Files:**
- Modify: `app.json` (`expo.ios.infoPlist`)

- [ ] **Step 1: Add CFBundleLocalizations**

In `app.json`, under `expo.ios.infoPlist`, add (alongside the existing `UIBackgroundModes`):

```json
"CFBundleLocalizations": ["en", "es"]
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors (config-only change; this just confirms nothing else broke).
Manual: Confirm `app.json` is valid JSON (no trailing-comma errors) — `npx expo config --type public` runs without error.

- [ ] **Step 3: Commit**

```bash
git add app.json
git commit -m "chore: declare en/es supported locales for iOS"
```

---

## Self-Review Notes

- **Spec coverage:** library/core module (T1), settings+detection+override (T1-T3), reactivity hook (T1), settings UI (T3), `workout.ts` purity via `reasonKey` (T4), validation strings (T4-T5,T7), default sessions at seed time (T8), `CFBundleLocalizations` (T9), full string inventory across all screens/components (T3,T5,T6,T7). The spec's `labeler` injection for segment labels was dropped because `Segment.label` is never rendered (documented in Global Constraints) — a simplification, not a gap.
- **Type consistency:** `getDefaultSessions`/`loadSessions` take `Language` (= `'en' | 'es'`); `useTranslation().t` signature `(scope: string, opts?: object) => string` is reused where `t` is threaded as a prop (PresetStrip, swipe actions). `ConvertToEasyResult` uses `reasonKey`/`reasonParams`; `validateDraft` uses `titleKey`/`messageKey` — both consumed in Task 5.
- **No placeholders:** all strings and edits are concrete.
