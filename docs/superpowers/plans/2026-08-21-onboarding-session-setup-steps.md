# Onboarding Session-Setup Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the onboarding wizard's single "Work / Rest / Rounds" session-setup screen with three sequential questions (session length → work → recovery), calculating rounds and deriving warmup/cooldown instead of asking the user for them directly.

**Architecture:** All changes live in `src/components/OnboardingModal.tsx`'s existing step-array/render-block pattern (no new files, no new navigation routes) plus one new pure helper function in `src/lib/workout.ts` (the only genuinely new *logic* here — everything else is reused: `computeRoundsForTargetDuration` already exists and is tested, `MIN_TARGET_DURATION_MINUTES`/`MAX_TARGET_DURATION_MINUTES` already exist).

**Tech Stack:** React Native + Expo, TypeScript, Jest.

**Spec:** No separate spec doc (project convention: skip spec docs unless explicitly requested — see `docs/superpowers/plans/2026-08-21-onboarding-enhancement.md`, the prior onboarding plan, for the same convention). The design here was agreed via clarifying questions earlier in this conversation; it is reproduced in full in Global Constraints below.

## Global Constraints

- Replace the single `'sessionSetup'` step with three steps, in this order: `'sessionDuration'` → `'sessionWork'` → `'sessionRecover'`, inserted into `STEPS` exactly where `'sessionSetup'` currently sits (between `'name'` and `'done'`).
- `'sessionDuration'`: asks total session length in minutes. Bounds: `MIN_TARGET_DURATION_MINUTES` (10) to `MAX_TARGET_DURATION_MINUTES` (180), imported from `src/hooks/usePickerState.ts` — not hardcoded. Step 5 (a 1-minute increment across a 10–180 range would take up to 170 taps to reach the top; 5-minute steps still land exactly on the 10/15 threshold and keep the stepper usable). Initial value 15.
- `'sessionWork'`: asks work-interval seconds. Bounds unchanged: min 5, max 300, step 5. Initial value 30.
- `'sessionRecover'`: asks recovery-interval seconds. Bounds unchanged: min 5, max 120, step 5. Initial value 15. This step ALSO shows a live summary ("`<rounds>` rounds · ~`<minutes>` min total") that recomputes on every render from current state — not memoized/cached, so it stays correct across back/forward navigation.
- Rounds are calculated via the existing `computeRoundsForTargetDuration(warmup, work, rest, cooldown, targetSeconds)` from `src/lib/workout.ts` — never asked directly, never reimplemented.
- Warmup/cooldown are derived from total duration via a NEW pure function `warmupCooldownForDuration(durationMinutes: number): number` in `src/lib/workout.ts`: returns `180` for `durationMinutes < 15`, else `300`. This is the one new piece of logic in this plan and gets a real unit test.
- "Skip for now" (existing i18n key `onboarding.sessionSetupSkip`, existing `styles.skipLink`/`styles.skipLinkText`) appears on all three new steps. Pressing it from any of them jumps straight to `'done'` (`setStep(STEP_COUNT - 1)`), not just one step forward.
- The primary button shows `onboarding.sessionSetupCreate` ("Create & Continue") only on `'sessionRecover'` (the last of the three); `'sessionDuration'`/`'sessionWork'` show the generic `onboarding.next` ("Continue").
- `createFirstSession` is armed (`setCreateFirstSession(true)`) only when leaving `'sessionRecover'` via the primary button — not on the first two steps, not via Skip (which already explicitly sets it `false`).
- Must not affect the upgrader path — `STEPS` for `!isFreshInstall` stays `['whatsNew', 'done']`, untouched.
- Surgical: don't touch the `whatsNew`/`appearance`/`folders`/`voiceCues`/`name`/`done` step blocks, don't touch `src/lib/sessions.ts` or `src/lib/sessionDraft.ts`. Only `src/components/OnboardingModal.tsx`, `src/lib/workout.ts`, `src/lib/__tests__/workout.test.ts`, and the three locale files change.
- No component-test harness exists in this repo (confirmed in the prior onboarding plan) — UI wiring in `OnboardingModal.tsx` is verified by manual read-through/`tsc`, not automated tests. Only the new pure function gets a unit test.
- All new copy needs identical keys across `en`/`es`/`fr` (enforced at compile time — `es.ts`/`fr.ts` are typed `: typeof en`, so a missing or extra key fails `tsc`, not `src/lib/__tests__/i18n.test.tsx`, which only tests translation lookup/language detection, not key-set parity — corrected here per the final-review finding that flagged this plan's original, inaccurate attribution). Now-orphaned old keys (`sessionSetupTitle`, `sessionSetupSub`, `sessionSetupWork`, `sessionSetupRest`, `sessionSetupRounds`) are removed from all three locale files as part of the task that orphans them.

---

## File Structure

- Modify: `src/lib/workout.ts` — add `warmupCooldownForDuration`.
- Modify: `src/lib/__tests__/workout.test.ts` — test it.
- Modify: `src/locales/en.ts`, `src/locales/es.ts`, `src/locales/fr.ts` — swap old `sessionSetup*` copy for the three new steps' copy.
- Modify: `src/components/OnboardingModal.tsx` — the three-step restructure, state, skip/confirm logic, styles, icons.

---

## Task 1: Add `warmupCooldownForDuration` to workout.ts

**Files:**
- Modify: `src/lib/workout.ts` (add function immediately after `computeRoundsForTargetDuration`, currently at lines 151-159)
- Test: `src/lib/__tests__/workout.test.ts` (add `describe` block immediately after the existing `describe('computeRoundsForTargetDuration', ...)` block, currently lines 136-149)

**Interfaces:**
- Produces: `warmupCooldownForDuration(durationMinutes: number): number`, returning `180` or `300`. Consumed by Task 3 (used in `OnboardingModal.tsx` to compute both the session's actual saved warmup/cooldown and the live summary).

- [ ] **Step 1: Write the failing test**

Add to `src/lib/__tests__/workout.test.ts`, right after the closing `});` of the `describe('computeRoundsForTargetDuration', ...)` block (line 149):

```typescript
describe('warmupCooldownForDuration', () => {
  it('returns 180 seconds for sessions under 15 minutes', () => {
    expect(warmupCooldownForDuration(10)).toBe(180);
    expect(warmupCooldownForDuration(14)).toBe(180);
  });

  it('returns 300 seconds for sessions of 15 minutes or longer', () => {
    expect(warmupCooldownForDuration(15)).toBe(300);
    expect(warmupCooldownForDuration(60)).toBe(300);
  });
});
```

Add `warmupCooldownForDuration` to the existing `import { ... } from '../workout';` block at the top of the file (line 8, right after `computeRoundsForTargetDuration,`):

```typescript
  computeRoundsForTargetDuration,
  warmupCooldownForDuration,
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/workout.test.ts -t "warmupCooldownForDuration"`
Expected: FAIL — `warmupCooldownForDuration` is not exported/defined.

- [ ] **Step 3: Implement**

In `src/lib/workout.ts`, add immediately after the closing `}` of `computeRoundsForTargetDuration` (line 159):

```typescript

/** Sessions under 15 minutes get a shorter 3-minute warmup/cooldown; 15+ minute sessions get the recommended 5 minutes. */
export function warmupCooldownForDuration(durationMinutes: number): number {
  return durationMinutes < 15 ? 180 : 300;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/__tests__/workout.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workout.ts src/lib/__tests__/workout.test.ts
git commit -m "feat: add warmupCooldownForDuration helper"
```

---

## Task 2: Replace onboarding session-setup copy in all three locales

**Files:**
- Modify: `src/locales/en.ts` (onboarding block, currently lines 173-209 — remove `sessionSetupTitle`/`sessionSetupSub`/`sessionSetupWork`/`sessionSetupRest`/`sessionSetupRounds` at lines 196, 197, 198, 199, 200; add new keys in their place)
- Modify: `src/locales/es.ts` (onboarding block, currently lines 175-211 — same removal/addition, at lines 198-202)
- Modify: `src/locales/fr.ts` (onboarding block, currently lines 175-211 — same removal/addition, at lines 198-202)

**Interfaces:**
- Produces: `onboarding.sessionDurationTitle`, `onboarding.sessionDurationSub`, `onboarding.sessionWorkTitle`, `onboarding.sessionWorkSub`, `onboarding.sessionRecoverTitle`, `onboarding.sessionRecoverSub`, `onboarding.sessionSetupSummary` (with `%{rounds}`/`%{minutes}` interpolation) in all three locales. Consumed by Task 3's JSX.
- Keeps unchanged: `onboarding.sessionSetupCreate`, `onboarding.sessionSetupSkip`, `onboarding.firstSessionName`.

- [ ] **Step 1: Edit `en.ts`**

In `src/locales/en.ts`, remove these 5 lines (currently 196-200):

```typescript
    sessionSetupTitle: "Let's set up your first session",
    sessionSetupSub: "We'll create a simple session to get you moving — you can fully customize it anytime.",
    sessionSetupWork: 'Work',
    sessionSetupRest: 'Rest',
    sessionSetupRounds: 'Rounds',
```

Replace them with:

```typescript
    sessionDurationTitle: 'How long do you want your session?',
    sessionDurationSub: 'Total time, including warmup and cooldown. You can fine-tune everything later.',
    sessionWorkTitle: 'How long is each work interval?',
    sessionWorkSub: 'Your high-intensity push, in seconds.',
    sessionRecoverTitle: 'How long do you want to recover?',
    sessionRecoverSub: 'Time between work intervals to catch your breath, in seconds.',
    sessionSetupSummary: '%{rounds} rounds · ~%{minutes} min total',
```

- [ ] **Step 2: Edit `es.ts`**

In `src/locales/es.ts`, remove these 5 lines (currently 198-202):

```typescript
    sessionSetupTitle: 'Configuremos tu primera sesión',
    sessionSetupSub: 'Crearemos una sesión sencilla para que empieces — podrás personalizarla del todo cuando quieras.',
    sessionSetupWork: 'Trabajo',
    sessionSetupRest: 'Descanso',
    sessionSetupRounds: 'Rondas',
```

Replace them with:

```typescript
    sessionDurationTitle: '¿Cuánto quieres que dure tu sesión?',
    sessionDurationSub: 'Tiempo total, incluyendo calentamiento y enfriamiento. Podrás ajustarlo todo más tarde.',
    sessionWorkTitle: '¿Cuánto dura cada intervalo de trabajo?',
    sessionWorkSub: 'Tu esfuerzo de alta intensidad, en segundos.',
    sessionRecoverTitle: '¿Cuánto quieres recuperar?',
    sessionRecoverSub: 'Tiempo entre intervalos de trabajo para recuperar el aliento, en segundos.',
    sessionSetupSummary: '%{rounds} rondas · ~%{minutes} min en total',
```

- [ ] **Step 3: Edit `fr.ts`**

In `src/locales/fr.ts`, remove these 5 lines (currently 198-202):

```typescript
    sessionSetupTitle: 'Configurons votre première séance',
    sessionSetupSub: 'Nous allons créer une séance simple pour commencer — vous pourrez la personnaliser entièrement plus tard.',
    sessionSetupWork: 'Travail',
    sessionSetupRest: 'Repos',
    sessionSetupRounds: 'Tours',
```

Replace them with:

```typescript
    sessionDurationTitle: 'Quelle durée voulez-vous pour votre séance ?',
    sessionDurationSub: 'Temps total, échauffement et récupération finale inclus. Vous pourrez tout ajuster plus tard.',
    sessionWorkTitle: 'Quelle est la durée de chaque intervalle de travail ?',
    sessionWorkSub: 'Votre effort de haute intensité, en secondes.',
    sessionRecoverTitle: 'Combien de temps voulez-vous récupérer ?',
    sessionRecoverSub: 'Temps entre les intervalles de travail pour reprendre son souffle, en secondes.',
    sessionSetupSummary: '%{rounds} tours · ~%{minutes} min au total',
```

- [ ] **Step 4: Run tests to verify locale parity**

Run: `npx jest src/lib/__tests__/i18n.test.tsx`
Expected: PASS — confirms `en`/`es`/`fr` still expose an identical key set (5 keys removed and 7 keys added, identically, in all three files).

- [ ] **Step 5: Commit**

```bash
git add src/locales/en.ts src/locales/es.ts src/locales/fr.ts
git commit -m "feat: replace onboarding session-setup copy with 3-step copy"
```

---

## Task 3: Restructure OnboardingModal's session-setup step into three steps

**Files:**
- Modify: `src/components/OnboardingModal.tsx`

**Interfaces:**
- Consumes: `warmupCooldownForDuration`, `computeRoundsForTargetDuration` from `../lib/workout` (Task 1). `MIN_TARGET_DURATION_MINUTES`, `MAX_TARGET_DURATION_MINUTES` from `../hooks/usePickerState` (pre-existing). The 7 new locale keys + unchanged `sessionSetupCreate`/`sessionSetupSkip`/`firstSessionName` (Task 2).
- Produces: nothing consumed by a later task — this is the last task in this plan.

- [ ] **Step 1: Add imports**

Change the import block at the top of `src/components/OnboardingModal.tsx` (lines 1-10) from:

```typescript
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, withOpacity, THEME_PREVIEWS, type ThemeTokens, type ThemePreview } from '../theme';
import { useSettings } from '../lib/settingsContext';
import { buildSessionFromDraft } from '../lib/sessionDraft';
import { loadSessions, saveSessions, DEFAULT_RUN_SPEEDS, DEFAULT_RUN_INCLINES } from '../lib/sessions';
import { useTranslation } from '../lib/i18n';
import { SettingsToggle } from './SettingsToggle';
```

to:

```typescript
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, withOpacity, THEME_PREVIEWS, type ThemeTokens, type ThemePreview } from '../theme';
import { useSettings } from '../lib/settingsContext';
import { buildSessionFromDraft } from '../lib/sessionDraft';
import { loadSessions, saveSessions, DEFAULT_RUN_SPEEDS, DEFAULT_RUN_INCLINES } from '../lib/sessions';
import { computeRoundsForTargetDuration, warmupCooldownForDuration } from '../lib/workout';
import { MIN_TARGET_DURATION_MINUTES, MAX_TARGET_DURATION_MINUTES } from '../hooks/usePickerState';
import { useTranslation } from '../lib/i18n';
import { SettingsToggle } from './SettingsToggle';
```

- [ ] **Step 2: Replace `sessionRounds` state with `sessionDurationMinutes`, add derived values**

Change the state block (lines 53-61) from:

```typescript
  const [showFolders, setShowFolders] = useState(!settings.hideFolders);
  const [voiceCues, setVoiceCues] = useState(settings.voiceCues);
  const [name, setName] = useState(settings.name);
  const [createFirstSession, setCreateFirstSession] = useState(false);
  const [sessionWork, setSessionWork] = useState(30);
  const [sessionRest, setSessionRest] = useState(15);
  const [sessionRounds, setSessionRounds] = useState(8);
  const [step, setStep] = useState(0);
  const [confirming, setConfirming] = useState(false);
```

to:

```typescript
  const [showFolders, setShowFolders] = useState(!settings.hideFolders);
  const [voiceCues, setVoiceCues] = useState(settings.voiceCues);
  const [name, setName] = useState(settings.name);
  const [createFirstSession, setCreateFirstSession] = useState(false);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(15);
  const [sessionWork, setSessionWork] = useState(30);
  const [sessionRest, setSessionRest] = useState(15);
  const [step, setStep] = useState(0);
  const [confirming, setConfirming] = useState(false);
```

Right after the `STEPS`/`STEP_COUNT`/`lastStep`/`currentStep` block (lines 67-71 — do not modify those lines themselves, just insert after them), add the derived session values:

```typescript
  const sessionWarmupCooldown = warmupCooldownForDuration(sessionDurationMinutes);
  const sessionRounds = computeRoundsForTargetDuration(
    sessionWarmupCooldown, sessionWork, sessionRest, sessionWarmupCooldown, sessionDurationMinutes * 60,
  );
  const sessionActualMinutes = Math.round(
    (sessionWarmupCooldown * 2 + sessionRounds * (sessionWork + sessionRest)) / 60,
  );
```

- [ ] **Step 3: Update the `STEPS` array**

Change line 68 from:

```typescript
  const STEPS = ['whatsNew', ...(isFreshInstall ? ['appearance', 'folders', 'voiceCues', 'name', 'sessionSetup'] : []), 'done'] as const;
```

to:

```typescript
  const STEPS = ['whatsNew', ...(isFreshInstall ? ['appearance', 'folders', 'voiceCues', 'name', 'sessionDuration', 'sessionWork', 'sessionRecover'] : []), 'done'] as const;
```

- [ ] **Step 4: Update the re-sync effect**

Change the re-sync effect (lines 75-86) from:

```typescript
  useEffect(() => {
    if (!visible) return;
    setShowFolders(!settings.hideFolders);
    setVoiceCues(settings.voiceCues);
    setName(settings.name);
    setSessionWork(30);
    setSessionRest(15);
    setSessionRounds(8);
    setStep(0);
    setConfirming(false);
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
    setSessionDurationMinutes(15);
    setSessionWork(30);
    setSessionRest(15);
    setStep(0);
    setConfirming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
```

- [ ] **Step 5: Update `handleConfirm`'s session build**

Change the `easyConfig` line inside `handleConfirm` (line 100) from:

```typescript
        easyConfig: { warmup: 45, high: sessionWork, low: sessionRest, rounds: sessionRounds, cooldown: 60 },
```

to:

```typescript
        easyConfig: { warmup: sessionWarmupCooldown, high: sessionWork, low: sessionRest, rounds: sessionRounds, cooldown: sessionWarmupCooldown },
```

- [ ] **Step 6: Update `handleNext`'s flag-arming condition**

Change line 118 (inside `handleNext`) from:

```typescript
    if (currentStep === 'sessionSetup') setCreateFirstSession(true);
```

to:

```typescript
    if (currentStep === 'sessionRecover') setCreateFirstSession(true);
```

- [ ] **Step 7: Update `handleSkipSessionSetup` to jump to `'done'`**

Change `handleSkipSessionSetup` (lines 127-130) from:

```typescript
  function handleSkipSessionSetup() {
    setCreateFirstSession(false);
    setStep(s => s + 1);
  }
```

to:

```typescript
  function handleSkipSessionSetup() {
    setCreateFirstSession(false);
    setStep(STEP_COUNT - 1);
  }
```

- [ ] **Step 8: Replace the single `sessionSetup` render block with three**

Delete the entire `{currentStep === 'sessionSetup' && ( ... )}` block (lines 333-359):

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
                  <NumberStepper T={T} value={sessionWork} onChange={setSessionWork} min={5} max={300} step={5} />
                </View>
                <View style={styles.sessionSetupRow}>
                  <Text style={styles.sessionSetupLabel}>{t('onboarding.sessionSetupRest')}</Text>
                  <NumberStepper T={T} value={sessionRest} onChange={setSessionRest} min={5} max={120} step={5} />
                </View>
                <View style={styles.sessionSetupRow}>
                  <Text style={styles.sessionSetupLabel}>{t('onboarding.sessionSetupRounds')}</Text>
                  <NumberStepper T={T} value={sessionRounds} onChange={setSessionRounds} min={1} max={30} step={1} />
                </View>
                <Pressable style={styles.skipLink} onPress={handleSkipSessionSetup}>
                  <Text style={styles.skipLinkText}>{t('onboarding.sessionSetupSkip')}</Text>
                </Pressable>
              </View>
            )}
```

Replace it with:

```typescript
            {currentStep === 'sessionDuration' && (
              <View style={styles.optionBlock}>
                <View style={styles.glyph}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={T.btnGlyph} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx={12} cy={12} r={9} />
                    <Path d="M12 7v5l3 3" />
                  </Svg>
                </View>
                <Text style={styles.optionTitle}>{t('onboarding.sessionDurationTitle')}</Text>
                <Text style={styles.optionSub}>{t('onboarding.sessionDurationSub')}</Text>
                <View style={styles.stepperCentered}>
                  <NumberStepper T={T} value={sessionDurationMinutes} onChange={setSessionDurationMinutes} min={MIN_TARGET_DURATION_MINUTES} max={MAX_TARGET_DURATION_MINUTES} step={5} />
                </View>
                <Pressable style={styles.skipLink} onPress={handleSkipSessionSetup}>
                  <Text style={styles.skipLinkText}>{t('onboarding.sessionSetupSkip')}</Text>
                </Pressable>
              </View>
            )}

            {currentStep === 'sessionWork' && (
              <View style={styles.optionBlock}>
                <View style={styles.glyph}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={T.btnGlyph} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
                  </Svg>
                </View>
                <Text style={styles.optionTitle}>{t('onboarding.sessionWorkTitle')}</Text>
                <Text style={styles.optionSub}>{t('onboarding.sessionWorkSub')}</Text>
                <View style={styles.stepperCentered}>
                  <NumberStepper T={T} value={sessionWork} onChange={setSessionWork} min={5} max={300} step={5} />
                </View>
                <Pressable style={styles.skipLink} onPress={handleSkipSessionSetup}>
                  <Text style={styles.skipLinkText}>{t('onboarding.sessionSetupSkip')}</Text>
                </Pressable>
              </View>
            )}

            {currentStep === 'sessionRecover' && (
              <View style={styles.optionBlock}>
                <View style={styles.glyph}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Rect x={7} y={6} width={4} height={12} rx={2} fill={T.btnGlyph} />
                    <Rect x={13} y={6} width={4} height={12} rx={2} fill={T.btnGlyph} />
                  </Svg>
                </View>
                <Text style={styles.optionTitle}>{t('onboarding.sessionRecoverTitle')}</Text>
                <Text style={styles.optionSub}>{t('onboarding.sessionRecoverSub')}</Text>
                <View style={styles.stepperCentered}>
                  <NumberStepper T={T} value={sessionRest} onChange={setSessionRest} min={5} max={120} step={5} />
                </View>
                <Text style={styles.sessionSummary}>
                  {t('onboarding.sessionSetupSummary', { rounds: sessionRounds, minutes: sessionActualMinutes })}
                </Text>
                <Pressable style={styles.skipLink} onPress={handleSkipSessionSetup}>
                  <Text style={styles.skipLinkText}>{t('onboarding.sessionSetupSkip')}</Text>
                </Pressable>
              </View>
            )}
```

- [ ] **Step 9: Update the footer button's label condition**

Change line 387 from:

```typescript
                <Text style={styles.confirmBtnText}>{lastStep ? t('onboarding.confirm') : currentStep === 'sessionSetup' ? t('onboarding.sessionSetupCreate') : t('onboarding.next')}</Text>
```

to:

```typescript
                <Text style={styles.confirmBtnText}>{lastStep ? t('onboarding.confirm') : currentStep === 'sessionRecover' ? t('onboarding.sessionSetupCreate') : t('onboarding.next')}</Text>
```

- [ ] **Step 10: Replace the now-dead styles with new ones**

In `makeStyles` (the `StyleSheet.create` call), change (lines 600-611):

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
```

to:

```typescript
    stepperCentered: {
      marginTop: 22,
    },
    sessionSummary: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: T.subText,
      textAlign: 'center',
      marginTop: 16,
    },
```

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (only the pre-existing unrelated jest-types errors in test files, as established by the prior onboarding plan's baseline).

- [ ] **Step 12: Run the full test suite**

Run: `npx jest`
Expected: PASS — confirms `workout.test.ts` (Task 1) and `i18n.test.tsx` (Task 2) are still green, and nothing else broke.

- [ ] **Step 13: Manual verification**

There is no component-test harness in this repo. Verify by running the app on a dev build or Expo Go and resetting onboarding (Settings → Developer → "Show onboarding on next launch"):
1. Walk through to the session-setup portion: confirm three separate screens appear in order (duration → work → recover), each with one stepper.
2. On the duration step, confirm the stepper's floor is 10 and it can go well above 15 (e.g. to 30+).
3. Adjust duration below 15, then above 15, and back below 15 while on the recover step — confirm the summary text's round count changes accordingly (verifying the derived values are live, not stale).
4. Tap "Create & Continue" on the recover step, confirm you land on the "done" screen, then confirm the created session's warmup/cooldown/rounds match the derived values shown in the summary (open the new session in Edit to check).
5. Repeat from a clean state, tapping "Skip for now" from each of the three steps in three separate runs — confirm all three correctly jump straight to "done" with no session created.

- [ ] **Step 14: Commit**

```bash
git add src/components/OnboardingModal.tsx
git commit -m "feat: split onboarding session setup into duration/work/recover steps"
```

---

## Self-Review Notes

- **Spec coverage:** every Global Constraints bullet maps to a task step — new helper + test (Task 1), copy swap in all 3 locales (Task 2), the full component restructure including STEPS order, bounds reuse, skip-jumps-to-done, button label condition, flag-arming condition, live summary, and dead-style cleanup (Task 3).
- **Placeholder scan:** no TBDs; every step shows literal before/after code or literal copy.
- **Type consistency:** `warmupCooldownForDuration(durationMinutes: number): number` (Task 1) is called identically in Task 3 Step 2. The 7 locale keys added in Task 2 are referenced by the exact same names in Task 3 Step 8's JSX. `sessionWarmupCooldown`/`sessionRounds`/`sessionActualMinutes` are declared once (Task 3 Step 2) and reused without redeclaration in Steps 5, 8, and 9.
