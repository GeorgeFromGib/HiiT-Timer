# Onboarding Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the fresh-install onboarding flow to collect a name/nickname and walk the user through creating their first HIIT session, and stop seeding the 5 hardcoded example sessions on first launch.

**Architecture:** All new UI lives inside the existing `OnboardingModal` component as two additional steps in its `STEPS` array (no new navigation routes). The new "first session" step reuses the existing `buildSessionFromDraft` pure builder from `sessionDraft.ts` rather than any new session-construction logic. Default-session seeding is removed from `loadSessions()`'s no-file fallback in `sessions.ts`; the default folder object is kept (just empty of sessions) so existing folder-filtering logic elsewhere in the app keeps working unchanged.

**Tech Stack:** React Native + Expo, TypeScript, Jest (existing `src/lib/__tests__` / `src/hooks/__tests__` convention — no component-rendering tests exist anywhere in this repo, so none are introduced here; new logic is tested at the pure-function level it already lives at).

**Spec:** No separate spec doc (project convention: skip spec docs unless explicitly requested). The agreed design was reached via an interactive grilling session in this conversation; it is reproduced in full in Global Constraints below so this plan is self-contained.

## Global Constraints

- Scope is fresh installs only: `settings.onboardingVersion === 0`. Upgrading users keep today's flow (`whatsNew` v2 features → `done`) completely unchanged.
- New step order for fresh installs: `whatsNew` → `appearance` → `folders` → `voiceCues` → `name` (NEW) → `sessionSetup` (NEW) → `done`. The three middle steps are untouched, existing code.
- `name` step: mandatory single text field. Persisted as `Settings.name` (new field, default `''`). Stored only — no UI reads/displays it anywhere yet.
- `sessionSetup` step: guided/simplified, not the full `EditSessionScreen`. Activity type is always `general` (no picker). One fixed starting template (`warmup: 45`, `cooldown: 60`, not editable/shown). User can tweak `work` (seconds), `rest` (seconds), `rounds` only. Session is auto-named (`onboarding.firstSessionName`), no name field. Step is skippable — skipping creates no session. The existing `done` step is shown afterward regardless of whether a session was created.
- Default-session removal: `loadSessions()`'s no-file fallback must stop returning the 5 hardcoded example sessions. It **must** keep returning a default folder object (`{ id: 'default', name: 'My Sessions', ... }`) — confirmed necessary because `useEditSession.ts:108` and `SessionsListScreen.tsx:94,199` fall back to/filter on a literal `'default'` folder id; a session with `folderId: 'default'` would be invisible in the flat session list if `data.folders` were truly empty. This must not affect any install that already has a `sessions_v2.json` file — only the true first-run path changes.
- Don't touch the existing `whatsNew` / `appearance` / `folders` / `voiceCues` step bodies, `migrateSessionsToFolders`, or `createDefaultFolder` (still used by legacy-format migration for existing users).
- All new user-facing copy needs `en`, `es`, `fr` entries (project i18n convention — see `i18n-translation-check`).

---

## File Structure

- Modify: `src/lib/settings.ts` — add `name` field.
- Modify: `src/lib/sessions.ts` — remove `getDefaultSessions`, change `loadSessions()` fallback, drop now-unused imports.
- Modify: `src/locales/en.ts`, `src/locales/es.ts`, `src/locales/fr.ts` — remove `defaultSessions` block, add new `onboarding.*` keys.
- Modify: `src/components/OnboardingModal.tsx` — add `name` and `sessionSetup` steps, wire persistence.
- Modify: `src/lib/__tests__/settings.test.ts`, `src/lib/__tests__/sessions.test.ts` — update/add tests.

---

## Task 1: Add `name` field to Settings

**Files:**
- Modify: `src/lib/settings.ts:5-23` (interface), `src/lib/settings.ts:25-43` (`DEFAULT_SETTINGS`)
- Test: `src/lib/__tests__/settings.test.ts`

**Interfaces:**
- Produces: `Settings.name: string`, `DEFAULT_SETTINGS.name === ''`. Later tasks (OnboardingModal) read/write this via the existing `updateSettings('name', value)` from `useSettings()`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/__tests__/settings.test.ts`, inside the existing `describe('loadSettings / saveSettings', ...)` block (after the "merges a partial saved file" test):

```typescript
  it('defaults name to an empty string', async () => {
    expect((await loadSettings()).name).toBe('');
  });

  it('round-trips a saved name', async () => {
    const custom: Settings = { ...DEFAULT_SETTINGS, name: 'Alex' };
    await saveSettings(custom);
    expect(await loadSettings()).toEqual(custom);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/settings.test.ts -t "defaults name"`
Expected: FAIL — `TypeError` or `undefined` is not `''`, since `Settings` has no `name` field yet.

- [ ] **Step 3: Implement**

In `src/lib/settings.ts`, add to the `Settings` interface (after `onboardingVersion: number;` at line 22):

```typescript
  onboardingVersion: number;
  name: string;
```

And to `DEFAULT_SETTINGS` (after `onboardingVersion: 0,` at line 42):

```typescript
  onboardingVersion: 0,
  name: '',
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/__tests__/settings.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings.ts src/lib/__tests__/settings.test.ts
git commit -m "feat: add name field to Settings"
```

---

## Task 2: Stop seeding hardcoded default sessions on fresh install

**Files:**
- Modify: `src/lib/sessions.ts:1-8` (imports), `src/lib/sessions.ts:153-216` (delete `getDefaultSessions`), `src/lib/sessions.ts:252-261` (`loadSessions` fallback)
- Test: `src/lib/__tests__/sessions.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `loadSessions()` fallback now returns `{ folders: [createDefaultFolder()], sessions: [] }` when no `sessions_v2.json` exists. `getDefaultSessions` no longer exists (was unused outside this file and its own tests once the fallback stops calling it).

- [ ] **Step 1: Write the failing test**

In `src/lib/__tests__/sessions.test.ts`:

1. Delete the entire `describe('getDefaultSessions', ...)` block (lines 198-226) — the function it tests is being removed.
2. Replace the test `'returns the default folder and default sessions when no file exists'` (lines 233-237) with:

```typescript
  it('returns an empty session list in the default folder when no file exists', async () => {
    const data = await loadSessions();
    expect(data.folders).toEqual([expect.objectContaining({ id: 'default', name: 'My Sessions' })]);
    expect(data.sessions).toEqual([]);
  });
```

3. Remove the now-unused imports `getDefaultSessions` from the top `import { ... } from '../sessions'` block (line 6), and remove the now-unused `SPEED_PRESETS, INCLINE_PRESETS, SPIN_PRESETS` import line (line 25) — check first whether `SPEED_PRESETS`/`INCLINE_PRESETS` are still referenced elsewhere in this test file (they are, via `DEFAULT_RUN_SPEEDS`/`DEFAULT_RUN_INCLINES` assertions in `getSessionSegments` tests) — only drop `getDefaultSessions` from the sessions import and leave the `presets` import line as-is if anything else in it is still used; if `SPIN_PRESETS` becomes unused after removing the deleted test block, drop just that name from the import.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/sessions.test.ts -t "returns an empty session list"`
Expected: FAIL — currently returns 5 sessions, not `[]`.

- [ ] **Step 3: Implement**

In `src/lib/sessions.ts`, change the top imports (lines 1-7) from:

```typescript
import { readJsonFile, writeJsonFile } from './jsonFile';
import { syncSessionsData } from './workoutSync';
import type { Interval, Segment, WorkoutConfig, Phase } from './workout';
import { expandWorkout, intervalsToSegments, expandCircuit } from './workout';
import { i18n, type Language } from './i18n';
import { SPEED_PRESETS, SPIN_PRESETS, INCLINE_PRESETS } from './presets';
import { INTENSITY_PRESETS } from './intensityPresets';
```

to:

```typescript
import { readJsonFile, writeJsonFile } from './jsonFile';
import { syncSessionsData } from './workoutSync';
import type { Interval, Segment, WorkoutConfig, Phase } from './workout';
import { expandWorkout, intervalsToSegments, expandCircuit } from './workout';
import { type Language } from './i18n';
import { SPEED_PRESETS, INCLINE_PRESETS } from './presets';
```

(`i18n` value, `SPIN_PRESETS`, and `INTENSITY_PRESETS` were only used inside `getDefaultSessions`, which is being deleted; `Language`, `SPEED_PRESETS`, `INCLINE_PRESETS` are still used elsewhere in this file at `loadSessions`'s signature and `DEFAULT_RUN_SPEEDS`/`DEFAULT_RUN_INCLINES`.)

Delete the entire `getDefaultSessions` function (lines 153-216, from `export function getDefaultSessions(language: Language = 'en'): Session[] {` through its closing `}`).

Change `loadSessions` (lines 252-261) from:

```typescript
export async function loadSessions(language: Language = 'en'): Promise<SessionsData> {
  const parsed = await readJsonFile<Session[] | SessionsData>(SESSIONS_FILE);
  if (!parsed) {
    return { folders: [createDefaultFolder()], sessions: getDefaultSessions(language) };
  }
  if (Array.isArray(parsed)) {
    return migrateSessionsToFolders(parsed);
  }
  return parsed;
}
```

to:

```typescript
export async function loadSessions(language: Language = 'en'): Promise<SessionsData> {
  const parsed = await readJsonFile<Session[] | SessionsData>(SESSIONS_FILE);
  if (!parsed) {
    return { folders: [createDefaultFolder()], sessions: [] };
  }
  if (Array.isArray(parsed)) {
    return migrateSessionsToFolders(parsed);
  }
  return parsed;
}
```

(The `language` parameter is kept even though it's now unused in this function's body — it's part of a public signature called from 4 other files (`EditSessionScreen.tsx`, `SettingsScreen.tsx`, `FoldersScreen.tsx`, `SessionsListScreen.tsx`); changing it would ripple an unrelated signature change through files this task has no reason to touch.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/__tests__/sessions.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (confirms no other file imports `getDefaultSessions`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/sessions.ts src/lib/__tests__/sessions.test.ts
git commit -m "fix: stop seeding hardcoded example sessions on fresh install"
```

---

## Task 3: Remove now-unused `defaultSessions` locale keys

**Files:**
- Modify: `src/locales/en.ts:331-337`, `src/locales/es.ts:333-339`, `src/locales/fr.ts:333-339`

**Interfaces:**
- Consumes: Task 2 (the only code that read these keys, `getDefaultSessions`, is deleted).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Remove the block from `en.ts`**

Delete from `src/locales/en.ts`:

```typescript
  defaultSessions: {
    example1: 'Standard Example',
    example2: 'Advanced Example',
    example3: 'Treadmill Example',
    circuit1: 'Calisthenics Example',
    spinning1: 'Spinning Example',
  },
```

- [ ] **Step 2: Remove the block from `es.ts`**

Delete from `src/locales/es.ts`:

```typescript
  defaultSessions: {
    example1: 'Ejemplo Estándar',
    example2: 'Ejemplo Avanzado',
    example3: 'Ejemplo de Cinta',
    circuit1: 'Ejemplo de Calistenia',
    spinning1: 'Ejemplo de Spinning',
  },
```

- [ ] **Step 3: Remove the block from `fr.ts`**

Delete from `src/locales/fr.ts`:

```typescript
  defaultSessions: {
    example1: 'Exemple Standard',
    example2: 'Exemple Avancé',
    example3: 'Exemple Tapis',
    circuit1: 'Exemple de Callisthénie',
    spinning1: 'Exemple de Spinning',
  },
```

- [ ] **Step 4: Run the full test suite**

Run: `npx jest`
Expected: PASS — `src/lib/__tests__/i18n.test.tsx` checks locale key parity across `en`/`es`/`fr`; removing the same block from all three keeps them in sync.

- [ ] **Step 5: Commit**

```bash
git add src/locales/en.ts src/locales/es.ts src/locales/fr.ts
git commit -m "chore: remove unused defaultSessions locale keys"
```

---

## Task 4: Add new onboarding copy keys

**Files:**
- Modify: `src/locales/en.ts:173-198` (`onboarding` block), `src/locales/es.ts:175-200`, `src/locales/fr.ts:175-200`

**Interfaces:**
- Produces: the following new keys under `onboarding.*` in all three locale files, consumed by Task 5 and Task 6:
  `nameTitle`, `nameSub`, `namePlaceholder`, `sessionSetupTitle`, `sessionSetupSub`, `sessionSetupWork`, `sessionSetupRest`, `sessionSetupRounds`, `sessionSetupCreate`, `sessionSetupSkip`, `firstSessionName`.

- [ ] **Step 1: Add keys to `en.ts`**

In `src/locales/en.ts`, inside the `onboarding` block, insert after `voiceCuesSub` (line 192) and before `settingsTitle`:

```typescript
    nameTitle: 'What should we call you?',
    nameSub: "We'll use this to personalize your experience.",
    namePlaceholder: 'Your name or nickname',
    sessionSetupTitle: "Let's set up your first session",
    sessionSetupSub: "We'll create a simple session to get you moving — you can fully customize it anytime.",
    sessionSetupWork: 'Work',
    sessionSetupRest: 'Rest',
    sessionSetupRounds: 'Rounds',
    sessionSetupCreate: 'Create & Continue',
    sessionSetupSkip: 'Skip for now',
    firstSessionName: 'My First Session',
```

- [ ] **Step 2: Add keys to `es.ts`**

In `src/locales/es.ts`, same position:

```typescript
    nameTitle: '¿Cómo te llamamos?',
    nameSub: 'Lo usaremos para personalizar tu experiencia.',
    namePlaceholder: 'Tu nombre o apodo',
    sessionSetupTitle: 'Configuremos tu primera sesión',
    sessionSetupSub: 'Crearemos una sesión sencilla para que empieces — podrás personalizarla del todo cuando quieras.',
    sessionSetupWork: 'Trabajo',
    sessionSetupRest: 'Descanso',
    sessionSetupRounds: 'Rondas',
    sessionSetupCreate: 'Crear y continuar',
    sessionSetupSkip: 'Omitir por ahora',
    firstSessionName: 'Mi primera sesión',
```

- [ ] **Step 3: Add keys to `fr.ts`**

In `src/locales/fr.ts`, same position:

```typescript
    nameTitle: 'Comment devons-nous vous appeler ?',
    nameSub: 'Nous l\'utiliserons pour personnaliser votre expérience.',
    namePlaceholder: 'Votre nom ou surnom',
    sessionSetupTitle: 'Configurons votre première séance',
    sessionSetupSub: 'Nous allons créer une séance simple pour commencer — vous pourrez la personnaliser entièrement plus tard.',
    sessionSetupWork: 'Travail',
    sessionSetupRest: 'Repos',
    sessionSetupRounds: 'Tours',
    sessionSetupCreate: 'Créer et continuer',
    sessionSetupSkip: 'Ignorer pour l\'instant',
    firstSessionName: 'Ma première séance',
```

- [ ] **Step 4: Run tests to verify locale parity**

Run: `npx jest src/lib/__tests__/i18n.test.tsx`
Expected: PASS — confirms `en`/`es`/`fr` still expose the identical key set.

- [ ] **Step 5: Commit**

```bash
git add src/locales/en.ts src/locales/es.ts src/locales/fr.ts
git commit -m "feat: add onboarding copy for name and first-session-setup steps"
```

---

## Task 5: Add the mandatory "name" step to OnboardingModal

**Files:**
- Modify: `src/components/OnboardingModal.tsx`

**Interfaces:**
- Consumes: `settings.name` / `updateSettings('name', ...)` from Task 1. `t('onboarding.nameTitle')` etc. from Task 4.
- Produces: `STEPS` now includes `'name'` for fresh installs (consumed by Task 6, which appends `'sessionSetup'` right after it). A `name` local state and a `isNameStepValid` boolean gating the Continue button — Task 6's Continue-button `disabled` prop reads this same boolean via a combined condition.

- [ ] **Step 1: Add local state and re-sync effect**

In `src/components/OnboardingModal.tsx`, change the state block (lines 23-25):

```typescript
  const [showFolders, setShowFolders] = useState(!settings.hideFolders);
  const [voiceCues, setVoiceCues] = useState(settings.voiceCues);
  const [step, setStep] = useState(0);
```

to:

```typescript
  const [showFolders, setShowFolders] = useState(!settings.hideFolders);
  const [voiceCues, setVoiceCues] = useState(settings.voiceCues);
  const [name, setName] = useState(settings.name);
  const [step, setStep] = useState(0);
```

And the re-sync effect (lines 39-45):

```typescript
  useEffect(() => {
    if (!visible) return;
    setShowFolders(!settings.hideFolders);
    setVoiceCues(settings.voiceCues);
    setStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
```

to:

```typescript
  useEffect(() => {
    if (!visible) return;
    setShowFolders(!settings.hideFolders);
    setVoiceCues(settings.voiceCues);
    setName(settings.name);
    setStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
```

- [ ] **Step 2: Add `'name'` to the STEPS array**

Change line 32 from:

```typescript
  const STEPS = ['whatsNew', ...(isFreshInstall ? ['appearance', 'folders', 'voiceCues'] : []), 'done'] as const;
```

to:

```typescript
  const STEPS = ['whatsNew', ...(isFreshInstall ? ['appearance', 'folders', 'voiceCues', 'name'] : []), 'done'] as const;
```

- [ ] **Step 3: Persist name on confirm**

Change `handleConfirm` (lines 47-52) from:

```typescript
  function handleConfirm() {
    updateSettings('hideFolders', !showFolders);
    updateSettings('voiceCues', voiceCues);
    updateSettings('onboardingVersion', CURRENT_ONBOARDING_VERSION);
    onConfirm(showFolders);
  }
```

to:

```typescript
  function handleConfirm() {
    updateSettings('hideFolders', !showFolders);
    updateSettings('voiceCues', voiceCues);
    updateSettings('name', name.trim());
    updateSettings('onboardingVersion', CURRENT_ONBOARDING_VERSION);
    onConfirm(showFolders);
  }
```

- [ ] **Step 4: Gate the Continue button on the name step**

Change `handleNext` (lines 54-60) from:

```typescript
  function handleNext() {
    if (lastStep) {
      handleConfirm();
    } else {
      setStep(s => s + 1);
    }
  }
```

to:

```typescript
  const isNameStepValid = currentStep !== 'name' || name.trim().length > 0;

  function handleNext() {
    if (!isNameStepValid) return;
    if (lastStep) {
      handleConfirm();
    } else {
      setStep(s => s + 1);
    }
  }
```

- [ ] **Step 5: Render the name step**

Add the `TextInput` import to the top `react-native` import (line 2), from:

```typescript
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
```

to:

```typescript
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
```

Add a new step block after the `voiceCues` block (after line 238's closing `)}`, before the `done` block starting at line 240):

```typescript
            {currentStep === 'name' && (
              <View style={styles.optionBlock}>
                <View style={styles.glyph}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={T.btnGlyph} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx={12} cy={8} r={4} />
                    <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </Svg>
                </View>
                <Text style={styles.optionTitle}>{t('onboarding.nameTitle')}</Text>
                <Text style={styles.optionSub}>{t('onboarding.nameSub')}</Text>
                <TextInput
                  style={styles.nameInput}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('onboarding.namePlaceholder')}
                  placeholderTextColor={T.faintText}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={40}
                />
              </View>
            )}
```

- [ ] **Step 6: Wire the disabled state onto the Continue button**

Change the footer button (lines 261-263) from:

```typescript
              <Pressable style={styles.confirmBtn} onPress={handleNext}>
                <Text style={styles.confirmBtnText}>{lastStep ? t('onboarding.confirm') : t('onboarding.next')}</Text>
              </Pressable>
```

to:

```typescript
              <Pressable
                style={[styles.confirmBtn, !isNameStepValid && styles.confirmBtnDisabled]}
                onPress={handleNext}
                disabled={!isNameStepValid}
              >
                <Text style={styles.confirmBtnText}>{lastStep ? t('onboarding.confirm') : t('onboarding.next')}</Text>
              </Pressable>
```

- [ ] **Step 7: Add the new styles**

In `makeStyles` (the `StyleSheet.create` call starting at line 307), add after `optionToggleRow` (lines 459-461):

```typescript
    optionToggleRow: {
      marginTop: 22,
    },
    nameInput: {
      marginTop: 22,
      width: '100%',
      borderWidth: 1,
      borderColor: T.hairline,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: T.text,
      backgroundColor: T.card,
    },
```

And add `confirmBtnDisabled` after `confirmBtn` (lines 489-499):

```typescript
    confirmBtnDisabled: {
      opacity: 0.45,
    },
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Manual verification**

There is no component-test harness in this repo (confirmed: no test file anywhere under `src/components`). Verify by running the app on a dev build (per this project's `expo-audio`/background-audio note, Expo Go is not sufficient for later features, but is fine for this UI-only check):
1. `npx expo start`, launch on a simulator/device with no existing app data (or use the Settings → Developer → "Show onboarding on next launch" toggle to re-trigger).
2. Confirm the wizard now shows a "What should we call you?" step after Voice Cues, that Continue is disabled until text is entered, and that it's back-navigable.

- [ ] **Step 10: Commit**

```bash
git add src/components/OnboardingModal.tsx
git commit -m "feat: add name step to fresh-install onboarding"
```

---

## Task 6: Add the skippable "first session setup" step

**Files:**
- Modify: `src/components/OnboardingModal.tsx`

**Interfaces:**
- Consumes: `buildSessionFromDraft` from `src/lib/sessionDraft.ts` (existing, already tested in `src/lib/__tests__/sessionDraft.test.ts` — signature: `buildSessionFromDraft(input: SessionDraftInput): Session`, see that file for the full `SessionDraftInput` shape). `loadSessions`/`saveSessions`/`DEFAULT_RUN_SPEEDS`/`DEFAULT_RUN_INCLINES` from `src/lib/sessions.ts`. `t('onboarding.sessionSetup*')`/`t('onboarding.firstSessionName')` from Task 4.
- Produces: `STEPS` now ends `..., 'name', 'sessionSetup', 'done'` for fresh installs. `handleConfirm` becomes `async` and persists the built session (if the step wasn't skipped) before calling `onConfirm`.

- [ ] **Step 1: Add local state for the session draft**

Add the `sessionDraft` import at the top of `src/components/OnboardingModal.tsx` (after the existing `settingsContext` import, line 6):

```typescript
import { useSettings } from '../lib/settingsContext';
import { buildSessionFromDraft } from '../lib/sessionDraft';
import { loadSessions, saveSessions, DEFAULT_RUN_SPEEDS, DEFAULT_RUN_INCLINES } from '../lib/sessions';
```

Add state (after the `name` state added in Task 5):

```typescript
  const [name, setName] = useState(settings.name);
  const [createFirstSession, setCreateFirstSession] = useState(false);
  const [sessionWork, setSessionWork] = useState(30);
  const [sessionRest, setSessionRest] = useState(15);
  const [sessionRounds, setSessionRounds] = useState(8);
  const [step, setStep] = useState(0);
```

Reset the draft numbers (not `createFirstSession` — see Step 4) in the re-sync effect, after `setName(settings.name);`:

```typescript
    setSessionWork(30);
    setSessionRest(15);
    setSessionRounds(8);
```

- [ ] **Step 2: Add `'sessionSetup'` to STEPS**

Change the STEPS line (updated by Task 5) from:

```typescript
  const STEPS = ['whatsNew', ...(isFreshInstall ? ['appearance', 'folders', 'voiceCues', 'name'] : []), 'done'] as const;
```

to:

```typescript
  const STEPS = ['whatsNew', ...(isFreshInstall ? ['appearance', 'folders', 'voiceCues', 'name', 'sessionSetup'] : []), 'done'] as const;
```

- [ ] **Step 3: Build and persist the session in `handleConfirm`**

Change `handleConfirm` (updated by Task 5) from:

```typescript
  function handleConfirm() {
    updateSettings('hideFolders', !showFolders);
    updateSettings('voiceCues', voiceCues);
    updateSettings('name', name.trim());
    updateSettings('onboardingVersion', CURRENT_ONBOARDING_VERSION);
    onConfirm(showFolders);
  }
```

to:

```typescript
  async function handleConfirm() {
    updateSettings('hideFolders', !showFolders);
    updateSettings('voiceCues', voiceCues);
    updateSettings('name', name.trim());
    updateSettings('onboardingVersion', CURRENT_ONBOARDING_VERSION);
    if (createFirstSession) {
      const session = buildSessionFromDraft({
        mode: 'easy',
        name: t('onboarding.firstSessionName'),
        existingId: undefined,
        folderId: 'default',
        intervals: [],
        easyConfig: { warmup: 45, high: sessionWork, low: sessionRest, rounds: sessionRounds, cooldown: 60 },
        activityType: undefined,
        runSpeeds: DEFAULT_RUN_SPEEDS,
        runInclines: DEFAULT_RUN_INCLINES,
        inclineEnabled: true,
        spinValues: undefined,
        circuitData: undefined,
      });
      const data = await loadSessions();
      await saveSessions({ ...data, sessions: [...data.sessions, session] });
    }
    onConfirm(showFolders);
  }
```

- [ ] **Step 4: Make `handleNext` await the async confirm**

Change `handleNext` (updated by Task 5) from:

```typescript
  const isNameStepValid = currentStep !== 'name' || name.trim().length > 0;

  function handleNext() {
    if (!isNameStepValid) return;
    if (lastStep) {
      handleConfirm();
    } else {
      setStep(s => s + 1);
    }
  }
```

to:

```typescript
  const isNameStepValid = currentStep !== 'name' || name.trim().length > 0;

  async function handleNext() {
    if (!isNameStepValid) return;
    if (lastStep) {
      await handleConfirm();
    } else {
      setStep(s => s + 1);
    }
  }

  function handleSkipSessionSetup() {
    setCreateFirstSession(false);
    setStep(s => s + 1);
  }
```

- [ ] **Step 5: Render the session-setup step**

Add a small inline stepper component above `OnboardingModal` (after the `Props` interface, before `export default function OnboardingModal`):

```typescript
function NumberStepper({ T, value, onChange, min, max, step: incrementBy }: {
  T: ThemeTokens;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  const styles = useMemo(() => makeStepperStyles(T), [T]);
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.btn}
        onPress={() => onChange(Math.max(min, value - incrementBy))}
      >
        <Text style={styles.btnText}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        style={styles.btn}
        onPress={() => onChange(Math.min(max, value + incrementBy))}
      >
        <Text style={styles.btnText}>+</Text>
      </Pressable>
    </View>
  );
}
```

Add its styles function alongside `makeSwatchStyles` (after that function, near the bottom of the file):

```typescript
function makeStepperStyles(T: ThemeTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    btn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: T.ghostBg,
      borderWidth: 1,
      borderColor: T.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 18,
      color: T.text,
    },
    value: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 16,
      color: T.text,
      minWidth: 36,
      textAlign: 'center',
    },
  });
}
```

Add the step block after the `name` block added in Task 5 (before the `done` block):

```typescript
            {currentStep === 'sessionSetup' && (
              <View style={styles.optionBlock}>
                <View style={styles.glyph}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={T.btnGlyph} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx={12} cy={12} r={9} />
                    <Path d="M12 7v5l3 3" />
                  </Svg>
                </View>
                <Text style={styles.optionTitle}>{t('onboarding.sessionSetupTitle')}</Text>
                <Text style={styles.optionSub}>{t('onboarding.sessionSetupSub')}</Text>
                <View style={styles.sessionSetupRow}>
                  <Text style={styles.sessionSetupLabel}>{t('onboarding.sessionSetupWork')}</Text>
                  <NumberStepper T={T} value={sessionWork} onChange={v => { setSessionWork(v); setCreateFirstSession(true); }} min={5} max={300} step={5} />
                </View>
                <View style={styles.sessionSetupRow}>
                  <Text style={styles.sessionSetupLabel}>{t('onboarding.sessionSetupRest')}</Text>
                  <NumberStepper T={T} value={sessionRest} onChange={v => { setSessionRest(v); setCreateFirstSession(true); }} min={5} max={120} step={5} />
                </View>
                <View style={styles.sessionSetupRow}>
                  <Text style={styles.sessionSetupLabel}>{t('onboarding.sessionSetupRounds')}</Text>
                  <NumberStepper T={T} value={sessionRounds} onChange={v => { setSessionRounds(v); setCreateFirstSession(true); }} min={1} max={30} step={1} />
                </View>
                <Pressable style={styles.skipLink} onPress={handleSkipSessionSetup}>
                  <Text style={styles.skipLinkText}>{t('onboarding.sessionSetupSkip')}</Text>
                </Pressable>
              </View>
            )}
```

Note: adjusting any stepper marks `createFirstSession = true` — the user only gets a session if they engaged with the step at all; pressing "Skip for now" always wins by explicitly setting it back to `false`, which is why `handleSkipSessionSetup` calls `setCreateFirstSession(false)` unconditionally rather than just advancing the step.

- [ ] **Step 6: Add the remaining styles**

Add to `makeStyles`, after `optionToggleRow`/`nameInput` (added in Task 5):

```typescript
    sessionSetupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginTop: 18,
    },
    sessionSetupLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 14,
      color: T.text,
    },
    skipLink: {
      marginTop: 24,
      paddingVertical: 6,
    },
    skipLinkText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: T.faintText,
      textDecorationLine: 'underline',
    },
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Run the full test suite**

Run: `npx jest`
Expected: PASS — no existing test touches `OnboardingModal` directly; this confirms nothing else broke (e.g. `sessionDraft.test.ts`, `sessions.test.ts` still green).

- [ ] **Step 9: Manual verification**

On a dev build (or Expo Go, UI-only check) with onboarding reset via Settings → Developer:
1. Walk through: What's New → Appearance → Folders → Voice Cues → Name (enter a name) → First Session Setup.
2. Tweak Work/Rest/Rounds with the +/− steppers, tap "Create & Continue", confirm the `done` step appears, then confirm the Sessions list shows exactly one session (the auto-named one) — no example sessions present.
3. Repeat from a clean state, this time tapping "Skip for now" on the session-setup step — confirm the Sessions list is empty afterward.
4. Repeat from a clean state as an "upgrader" (can't easily simulate without a real prior-version settings file; skip if impractical) — confirm the short flow (What's New → Done) is unaffected by these changes.

- [ ] **Step 10: Commit**

```bash
git add src/components/OnboardingModal.tsx
git commit -m "feat: add guided first-session setup step to onboarding"
```

---

## Self-Review Notes

- **Spec coverage:** every bullet in Global Constraints maps to a task — Settings field (Task 1), default-session removal (Task 2), locale cleanup (Task 3), new copy (Task 4), name step (Task 5), session-setup step + skip behavior (Task 6). The `'default'`-folder technical constraint discovered during research is explicitly preserved in Task 2.
- **Placeholder scan:** no TBDs; every step has literal code or literal copy strings.
- **Type consistency:** `SessionDraftInput` fields used in Task 6's `buildSessionFromDraft` call match the interface at `src/lib/sessionDraft.ts:4-17` exactly (checked against the file directly, not from memory). `Settings.name` (Task 1) matches the `updateSettings('name', ...)` call added in Task 5.
- **Test-coverage gap, stated explicitly:** this repo has zero component-rendering tests anywhere (`src/components` has no `__tests__` dir at all) — automated testing in this codebase stops at pure lib/hook functions. All the new *logic* introduced here (Settings field persistence, default-session removal) gets real Jest tests in Tasks 1–2; the new step *UI* in Tasks 5–6 is glue code around already-tested pure functions (`buildSessionFromDraft`, `loadSessions`, `saveSessions`) and is verified manually per this repo's existing convention, not left unverified.
