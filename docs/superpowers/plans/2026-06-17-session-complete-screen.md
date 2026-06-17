# Session Complete Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the workout screen's "done" state with a full-screen celebration screen showing a checkmark hero, session stats, phase recap, and DONE / REPEAT SESSION actions.

**Architecture:** `SessionCompleteScreen` is a new component rendered inside `WorkoutScreen` when `status === 'finished'` — early-return before the main JSX so no route changes are needed and all session data is already in scope. It has its own `LinearGradient` root.

**Tech Stack:** React Native, Expo SDK 56, `expo-linear-gradient`, `react-native-svg`, `expo-google-fonts/inter`, `expo-google-fonts/chakra-petch`, i18n-js.

## Global Constraints

- Fonts available: `Inter_600SemiBold`, `Inter_700Bold`, `Inter_800ExtraBold`, `Inter_900Black`, `ChakraPetch_700Bold` — no others.
- Themes: `tidal` (dark) and `daybreak` (light) — all colors from `T: ThemeTokens`, no hard-coded hex.
- i18n: all user-visible strings must be added to `src/locales/en.ts`, `es.ts`, and `fr.ts` under a new `complete` key.
- Phase type: `'warmup' | 'work' | 'rest' | 'cooldown'` — no `blast`.
- TypeScript must compile clean after every task: `npx tsc --noEmit`.
- No new dependencies — all needed libraries are already installed.

---

## File Map

| File | Action |
|------|--------|
| `src/locales/en.ts` | Add `complete` i18n section |
| `src/locales/es.ts` | Add `complete` i18n section |
| `src/locales/fr.ts` | Add `complete` i18n section |
| `src/screens/SessionCompleteScreen.tsx` | Create — full celebration screen |
| `src/screens/WorkoutScreen.tsx` | Add early-return to render `SessionCompleteScreen` when `isDone` |

---

## Task 1: i18n strings + SessionCompleteScreen static layout

**Files:**
- Modify: `src/locales/en.ts`
- Modify: `src/locales/es.ts`
- Modify: `src/locales/fr.ts`
- Create: `src/screens/SessionCompleteScreen.tsx`

**Interfaces:**
- Produces:
  ```ts
  // src/screens/SessionCompleteScreen.tsx
  export default function SessionCompleteScreen(props: {
    session:  Session;
    segments: Segment[];
    totalDur: number;
    onDone:   () => void;
    onRepeat: () => void;
  }): JSX.Element
  ```

- [ ] **Step 1: Add `complete` section to `src/locales/en.ts`**

  Inside the exported object, after the `workout` block, add:

  ```ts
  complete: {
    eyebrow:       'WORKOUT COMPLETE',
    headline:      'Crushed it!',
    sublinePrefix: 'You finished',
    totalTime:     'Total Time',
    intervals:     'Intervals',
    workTime:      'Work Time',
    sessionRecap:  'Session Recap',
    done:          'DONE',
    repeat:        'REPEAT SESSION',
  },
  ```

- [ ] **Step 2: Add `complete` section to `src/locales/es.ts`**

  ```ts
  complete: {
    eyebrow:       'ENTRENAMIENTO COMPLETO',
    headline:      '¡Lo lograste!',
    sublinePrefix: 'Completaste',
    totalTime:     'Tiempo total',
    intervals:     'Intervalos',
    workTime:      'Tiempo de trabajo',
    sessionRecap:  'Resumen',
    done:          'LISTO',
    repeat:        'REPETIR SESIÓN',
  },
  ```

- [ ] **Step 3: Add `complete` section to `src/locales/fr.ts`**

  ```ts
  complete: {
    eyebrow:       'ENTRAÎNEMENT TERMINÉ',
    headline:      'Bravo !',
    sublinePrefix: 'Vous avez terminé',
    totalTime:     'Durée totale',
    intervals:     'Intervalles',
    workTime:      'Temps de travail',
    sessionRecap:  'Récapitulatif',
    done:          'TERMINER',
    repeat:        'RECOMMENCER',
  },
  ```

- [ ] **Step 4: Create `src/screens/SessionCompleteScreen.tsx`**

  ```tsx
  import React, { useMemo } from 'react';
  import { Pressable, StyleSheet, Text, View } from 'react-native';
  import { LinearGradient } from 'expo-linear-gradient';
  import Svg, { Path } from 'react-native-svg';
  import { useTheme, withOpacity, buttonShadow, type ThemeTokens } from '../theme';
  import { useTranslation } from '../lib/i18n';
  import PhaseStrip from '../components/PhaseStrip';
  import { fmtTimer, type Segment } from '../lib/workout';
  import type { Session } from '../lib/sessions';

  interface Props {
    session:  Session;
    segments: Segment[];
    totalDur: number;
    onDone:   () => void;
    onRepeat: () => void;
  }

  function StatCard({ label, value, accent, T }: { label: string; value: string; accent?: string; T: ThemeTokens }) {
    const styles = useMemo(() => makeStyles(T), [T]);
    return (
      <View style={[styles.statCard, { backgroundColor: T.card, borderColor: T.hairline }]}>
        <Text style={[styles.statValue, { color: accent ?? T.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: T.faintText }]}>{label}</Text>
      </View>
    );
  }

  export default function SessionCompleteScreen({ session, segments, totalDur, onDone, onRepeat }: Props) {
    const { T } = useTheme();
    const { t } = useTranslation();
    const styles = useMemo(() => makeStyles(T), [T]);

    const workSecs = segments
      .filter(s => s.phase === 'work')
      .reduce((sum, s) => sum + s.duration, 0);

    return (
      <LinearGradient colors={T.bgGradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.root}>
        {/* Radial accent glow at top */}
        <View style={[styles.accentGlow, { backgroundColor: withOpacity(T.accent, 0x22) }]} />

        {/* Eyebrow */}
        <Text style={[styles.eyebrow, { color: T.accent }]}>
          {t('complete.eyebrow')}
        </Text>

        {/* Hero checkmark */}
        <View style={styles.heroWrap}>
          <View style={[styles.checkCircle, { backgroundColor: T.accent, shadowColor: T.accent }]}>
            <Svg width={58} height={58} viewBox="0 0 48 48" fill="none">
              <Path
                d="M10 25l9.5 9.5L38 15"
                stroke={T.btnGlyph}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </View>

        {/* Headline */}
        <View style={styles.headlineWrap}>
          <Text style={[styles.headline, { color: T.text }]}>
            {t('complete.headline')}
          </Text>
          <Text style={[styles.subline, { color: T.subText }]}>
            {t('complete.sublinePrefix')}{' '}
            <Text style={{ color: T.text, fontFamily: 'Inter_800ExtraBold' }}>{session.name}</Text>
          </Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard label={t('complete.totalTime')} value={fmtTimer(totalDur)} accent={T.accent} T={T} />
          <StatCard label={t('complete.intervals')} value={String(segments.length)} T={T} />
          <StatCard label={t('complete.workTime')} value={fmtTimer(workSecs)} T={T} />
        </View>

        {/* Phase recap */}
        <View style={styles.recapWrap}>
          <Text style={[styles.recapLabel, { color: T.faintText }]}>
            {t('complete.sessionRecap')}
          </Text>
          <PhaseStrip segments={segments} />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={onDone}
            style={[styles.doneBtn, { backgroundColor: T.accent, ...buttonShadow(T) }]}
          >
            <Text style={[styles.doneBtnText, { color: T.btnGlyph }]}>
              {t('complete.done')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onRepeat}
            style={[styles.repeatBtn, { backgroundColor: T.ghostBg, borderColor: T.hairline }]}
          >
            <Svg width={16} height={16} viewBox="0 0 20 20" fill="none">
              <Path d="M3 10a7 7 0 1 1 2.3 5.2" stroke={T.subText} strokeWidth={2} strokeLinecap="round" />
              <Path d="M3 5v4h4" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={[styles.repeatBtnText, { color: T.subText }]}>
              {t('complete.repeat')}
            </Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  function makeStyles(T: ThemeTokens) { return StyleSheet.create({
    root: {
      flex: 1,
      paddingTop: 54,
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    accentGlow: {
      position: 'absolute',
      top: -120,
      left: '50%',
      marginLeft: -180,
      width: 360,
      height: 360,
      borderRadius: 180,
    },
    eyebrow: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 11,
      letterSpacing: 11 * 0.24,
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    heroWrap: {
      alignItems: 'center',
      marginTop: 14,
      marginBottom: 4,
    },
    checkCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.4,
      shadowRadius: 34,
      elevation: 8,
    },
    headlineWrap: {
      alignItems: 'center',
      marginTop: 6,
    },
    headline: {
      fontFamily: 'Inter_900Black',
      fontSize: 30,
      letterSpacing: 30 * -0.02,
      lineHeight: 32,
    },
    subline: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13.5,
      marginTop: 6,
      textAlign: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      gap: 9,
      marginTop: 22,
    },
    statCard: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 13,
      alignItems: 'center',
      gap: 4,
    },
    statValue: {
      fontFamily: 'ChakraPetch_700Bold',
      fontSize: 25,
      lineHeight: 25,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 9.5,
      letterSpacing: 9.5 * 0.12,
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    recapWrap: {
      marginTop: 16,
    },
    recapLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      letterSpacing: 10 * 0.14,
      textTransform: 'uppercase',
      marginBottom: 8,
      paddingLeft: 2,
    },
    actions: {
      marginTop: 'auto',
      paddingTop: 20,
      gap: 10,
    },
    doneBtn: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.55,
      shadowRadius: 26,
      elevation: 8,
    },
    doneBtnText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 14.5,
      letterSpacing: 14.5 * 0.05,
      textTransform: 'uppercase',
    },
    repeatBtn: {
      width: '100%',
      paddingVertical: 13,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
    },
    repeatBtnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13.5,
      letterSpacing: 13.5 * 0.05,
      textTransform: 'uppercase',
    },
  }); }
  ```

- [ ] **Step 5: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no output (zero errors).

- [ ] **Step 6: Commit**

  ```bash
  git add src/locales/en.ts src/locales/es.ts src/locales/fr.ts src/screens/SessionCompleteScreen.tsx
  git commit -m "feat: add SessionCompleteScreen static layout with i18n strings"
  ```

---

## Task 2: Entry animations + confetti

**Files:**
- Modify: `src/screens/SessionCompleteScreen.tsx`

**Interfaces:**
- Consumes: `SessionCompleteScreen` from Task 1 (same file, adding animations to existing elements)
- Produces: no new public interface

- [ ] **Step 1: Add animation imports and state**

  Add to imports at top of `SessionCompleteScreen.tsx`:

  ```tsx
  import React, { useEffect, useMemo, useRef, useState } from 'react';
  import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
  ```

  (Replace the existing `React, { useMemo }` and `{ Pressable, StyleSheet, Text, View }` imports with the above.)

- [ ] **Step 2: Add animation logic inside `SessionCompleteScreen` component**

  Add these declarations at the top of the component body (after the `workSecs` calculation):

  ```tsx
  const checkAnim    = useRef(new Animated.Value(0)).current;
  const eyebrowAnim  = useRef(new Animated.Value(0)).current;
  const headlineAnim = useRef(new Animated.Value(0)).current;
  const statsAnim    = useRef(new Animated.Value(0)).current;
  const recapAnim    = useRef(new Animated.Value(0)).current;

  const NUM_CONFETTI = 14;
  const confettiAnims = useRef(
    Array.from({ length: NUM_CONFETTI }, () => new Animated.Value(0)),
  ).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    Animated.spring(checkAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }).start();
    [
      { anim: eyebrowAnim,  delay: 0   },
      { anim: headlineAnim, delay: 100 },
      { anim: statsAnim,    delay: 180 },
      { anim: recapAnim,    delay: 260 },
    ].forEach(({ anim, delay }) =>
      Animated.timing(anim, { toValue: 1, duration: 500, delay, useNativeDriver: true }).start(),
    );
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loops = confettiAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2600 + (i % 5) * 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [reduceMotion]);
  ```

- [ ] **Step 3: Wrap each section in its Animated.View**

  Replace the static layout sections with animated wrappers. The full updated return block:

  ```tsx
  return (
    <LinearGradient colors={T.bgGradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.root}>
      {/* Accent glow */}
      <View style={[styles.accentGlow, { backgroundColor: withOpacity(T.accent, 0x22) }]} />

      {/* Confetti */}
      {!reduceMotion && confettiAnims.map((anim, i) => {
        const PHASES = ['warmup', 'work', 'rest', 'cooldown'] as const;
        const color  = T.phases[PHASES[i % PHASES.length]];
        const sz     = 5 + (i % 3) * 2;
        return (
          <Animated.View
            key={i}
            style={[
              styles.confetti,
              {
                left:            `${(i * 37 + 11) % 100}%`,
                width:           sz,
                height:          sz,
                borderRadius:    i % 2 === 0 ? sz / 2 : 2,
                backgroundColor: color,
                opacity:         anim.interpolate({ inputRange: [0, 0.08, 0.9, 1], outputRange: [0, 0.9, 0.9, 0] }),
                transform:       [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 640] }) }],
              },
            ]}
          />
        );
      })}

      {/* Eyebrow */}
      <Animated.View style={{ opacity: eyebrowAnim, transform: [{ translateY: eyebrowAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <Text style={[styles.eyebrow, { color: T.accent }]}>{t('complete.eyebrow')}</Text>
      </Animated.View>

      {/* Hero checkmark */}
      <View style={styles.heroWrap}>
        <Animated.View style={{
          opacity:   checkAnim,
          transform: [{ scale: checkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }}>
          <View style={[styles.checkCircle, { backgroundColor: T.accent, shadowColor: T.accent }]}>
            <Svg width={58} height={58} viewBox="0 0 48 48" fill="none">
              <Path d="M10 25l9.5 9.5L38 15" stroke={T.btnGlyph} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        </Animated.View>
      </View>

      {/* Headline */}
      <Animated.View style={[styles.headlineWrap, { opacity: headlineAnim, transform: [{ translateY: headlineAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
        <Text style={[styles.headline, { color: T.text }]}>{t('complete.headline')}</Text>
        <Text style={[styles.subline, { color: T.subText }]}>
          {t('complete.sublinePrefix')}{' '}
          <Text style={{ color: T.text, fontFamily: 'Inter_800ExtraBold' }}>{session.name}</Text>
        </Text>
      </Animated.View>

      {/* Stats */}
      <Animated.View style={[styles.statsRow, { opacity: statsAnim, transform: [{ translateY: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
        <StatCard label={t('complete.totalTime')} value={fmtTimer(totalDur)} accent={T.accent} T={T} />
        <StatCard label={t('complete.intervals')} value={String(segments.length)} T={T} />
        <StatCard label={t('complete.workTime')} value={fmtTimer(workSecs)} T={T} />
      </Animated.View>

      {/* Phase recap */}
      <Animated.View style={[styles.recapWrap, { opacity: recapAnim, transform: [{ translateY: recapAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
        <Text style={[styles.recapLabel, { color: T.faintText }]}>{t('complete.sessionRecap')}</Text>
        <PhaseStrip segments={segments} />
      </Animated.View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable onPress={onDone} style={[styles.doneBtn, { backgroundColor: T.accent, ...buttonShadow(T) }]}>
          <Text style={[styles.doneBtnText, { color: T.btnGlyph }]}>{t('complete.done')}</Text>
        </Pressable>
        <Pressable onPress={onRepeat} style={[styles.repeatBtn, { backgroundColor: T.ghostBg, borderColor: T.hairline }]}>
          <Svg width={16} height={16} viewBox="0 0 20 20" fill="none">
            <Path d="M3 10a7 7 0 1 1 2.3 5.2" stroke={T.subText} strokeWidth={2} strokeLinecap="round" />
            <Path d="M3 5v4h4" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.repeatBtnText, { color: T.subText }]}>{t('complete.repeat')}</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
  ```

- [ ] **Step 4: Add `confetti` style to `makeStyles`**

  Inside `makeStyles`, add before the closing `}`:

  ```ts
  confetti: {
    position: 'absolute',
    top: 0,
  },
  ```

- [ ] **Step 5: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no output.

- [ ] **Step 6: Commit**

  ```bash
  git add src/screens/SessionCompleteScreen.tsx
  git commit -m "feat: add entry animations and confetti to SessionCompleteScreen"
  ```

---

## Task 3: Wire SessionCompleteScreen into WorkoutScreen

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx`

**Interfaces:**
- Consumes:
  ```ts
  // from Task 1/2
  import SessionCompleteScreen from './SessionCompleteScreen';
  // Props needed:
  // session  — already a prop of WorkoutScreen
  // segments — already in WorkoutScreen state
  // totalDur — already computed as TOTAL_DUR in WorkoutScreen
  // onDone   — calls onBack (already a prop of WorkoutScreen)
  // onRepeat — calls reset (already returned from useWorkoutSession)
  ```

- [ ] **Step 1: Add import to `WorkoutScreen.tsx`**

  Add this import after the existing screen imports:

  ```tsx
  import SessionCompleteScreen from './SessionCompleteScreen';
  ```

- [ ] **Step 2: Add early-return when done**

  After the `isDone` constant is declared (line ~114 in WorkoutScreen.tsx), add:

  ```tsx
  if (isDone) {
    return (
      <SessionCompleteScreen
        session={session}
        segments={segments}
        totalDur={TOTAL_DUR}
        onDone={onBack}
        onRepeat={reset}
      />
    );
  }
  ```

  This must come before the `return (` of the main JSX but after all hooks (React hooks cannot be conditional — all `useRef`, `useState`, `useMemo`, `useEffect`, `useCallback` calls must remain above this early-return).

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no output.

- [ ] **Step 4: Visual verification — run the app and complete a workout**

  ```bash
  npx expo start --ios
  ```

  Checklist:
  - Workout finishes → SessionCompleteScreen appears immediately (no flash of old done state)
  - Tidal theme: dark gradient bg, teal glow, teal accent circle, teal DONE button
  - Daybreak theme: warm paper bg, coral glow, coral accent circle, coral DONE button
  - Checkmark circle springs in from scale 0.7
  - Eyebrow → headline → stats → recap fade+slide in with staggered delays
  - Confetti falls continuously from top with phase colors
  - Total Time and Work Time display in `m:ss` format
  - Intervals count matches the session
  - PhaseStrip renders colored segment proportions
  - Tapping DONE navigates back to Sessions list
  - Tapping REPEAT SESSION restarts the workout from idle state

- [ ] **Step 5: Commit**

  ```bash
  git add src/screens/WorkoutScreen.tsx
  git commit -m "feat: show SessionCompleteScreen when workout finishes"
  ```
