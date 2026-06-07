# Sound Off Setting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a master "Sound off" toggle to Settings and wire up the existing `soundCues`/`finalCountdownBeep` toggles that are currently saved but never read during playback.

**Architecture:** `soundOff` is added to the `Settings` type. `useWorkoutSession` accepts settings and gates every audio call through a stable ref. `WorkoutScreen` loads settings on mount and passes them down. The Settings UI dims and disables granular audio rows when `soundOff` is on.

**Tech Stack:** React Native / Expo SDK 56, `expo-keep-awake`, `expo-audio`

> **Note:** This project has no test framework configured. TDD steps are replaced with manual verification instructions.

---

## File Map

| File | Change |
|---|---|
| `src/lib/settings.ts` | Add `soundOff: boolean` field |
| `src/hooks/useWorkoutSession.ts` | Accept `settings` param, gate all audio calls via settings ref |
| `src/screens/WorkoutScreen.tsx` | Load settings, fix `keepScreenAwake`, pass settings to `useWorkoutSession` |
| `src/screens/SettingsScreen.tsx` | Add `disabled` prop to `Toggle`/`SRow`, add "Sound off" row |

---

## Task 1: Add `soundOff` to the Settings type

**Files:**
- Modify: `src/lib/settings.ts`

- [ ] **Step 1: Add field to interface and default**

  Replace the `Settings` interface and `DEFAULT_SETTINGS` in `src/lib/settings.ts`:

  ```ts
  export interface Settings {
    theme: ThemeKey;
    congratsMessage: boolean;
    finalCountdownBeep: boolean;
    keepScreenAwake: boolean;
    soundCues: boolean;
    hapticFeedback: boolean;
    soundOff: boolean;
  }

  export const DEFAULT_SETTINGS: Settings = {
    theme: 'tidal',
    congratsMessage: true,
    finalCountdownBeep: true,
    keepScreenAwake: true,
    soundCues: true,
    hapticFeedback: true,
    soundOff: false,
  };
  ```

  `loadSettings` already spreads `DEFAULT_SETTINGS` over persisted JSON, so existing installs without `soundOff` in their file will default to `false` automatically — no migration needed.

- [ ] **Step 2: Commit**

  ```bash
  git add src/lib/settings.ts
  git commit -m "feat: add soundOff field to Settings"
  ```

---

## Task 2: Gate audio calls in `useWorkoutSession`

**Files:**
- Modify: `src/hooks/useWorkoutSession.ts`

- [ ] **Step 1: Add `settings` parameter and settings ref**

  Update the function signature and add a `settingsRef` alongside the existing `audioRef`. Replace the top of `useWorkoutSession` (from the function signature down to the `useTimerEngine` call) with:

  ```ts
  import type { Settings } from '../lib/settings';
  import { DEFAULT_SETTINGS } from '../lib/settings';

  // Add the import at the top of the file alongside existing imports.
  ```

  Update the function signature:

  ```ts
  export function useWorkoutSession(segments: Segment[], settings: Settings = DEFAULT_SETTINGS): WorkoutSession {
    const audio = useWorkoutAudio();
    const audioRef = useRef(audio);
    audioRef.current = audio;

    const settingsRef = useRef(settings);
    settingsRef.current = settings;
  ```

- [ ] **Step 2: Gate `onTransition`, `onCountdown`, `onFinish`**

  Replace the `useTimerEngine` call:

  ```ts
  const { state, start, pause, resume, reset: engineReset, skip } = useTimerEngine(segments, {
    onTransition: (_from, to) => {
      const { soundOff, soundCues } = settingsRef.current;
      if (to && !soundOff && soundCues) audioRef.current.playChime();
    },
    onCountdown: () => {
      const { soundOff, finalCountdownBeep } = settingsRef.current;
      if (!soundOff && finalCountdownBeep) audioRef.current.playTick();
    },
    onFinish: () => {
      const { soundOff, soundCues } = settingsRef.current;
      if (!soundOff && soundCues) audioRef.current.playFinish();
      audioRef.current.stopKeepAlive();
    },
  });
  ```

- [ ] **Step 3: Gate pre-start ticks in `beginPreStart`**

  Replace `beginPreStart` with:

  ```ts
  const beginPreStart = useCallback(() => {
    setPreStartCount(3);
    const { soundOff, soundCues } = settingsRef.current;
    if (!soundOff && soundCues) audioRef.current.playTick();
    let count = 3;
    preStartIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setPreStartCount(count as 2 | 1);
        const { soundOff: sOff, soundCues: sCues } = settingsRef.current;
        if (!sOff && sCues) audioRef.current.playTick();
      } else {
        clearInterval(preStartIntervalRef.current!);
        preStartIntervalRef.current = null;
        setPreStartCount(null);
        audioRef.current.startKeepAlive();
        start();
      }
    }, 1000);
  }, [start]);
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/hooks/useWorkoutSession.ts
  git commit -m "feat: gate audio calls through settings in useWorkoutSession"
  ```

---

## Task 3: Load settings in WorkoutScreen

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx`

- [ ] **Step 1: Update imports**

  In `src/screens/WorkoutScreen.tsx`, replace the `expo-keep-awake` import and add settings imports:

  ```ts
  // Remove:
  import { useKeepAwake } from 'expo-keep-awake';

  // Add:
  import { activateKeepAwakeAsync, deactivateKeepAwakeAsync } from 'expo-keep-awake';
  import { loadSettings, DEFAULT_SETTINGS, type Settings } from '../lib/settings';
  ```

  Also update the React import to add `useState` (WorkoutScreen currently only imports `useEffect, useMemo, useRef`):

  ```ts
  import React, { useEffect, useMemo, useRef, useState } from 'react';
  ```

- [ ] **Step 2: Load settings state and replace `useKeepAwake`**

  Inside `WorkoutScreen`, remove the `useKeepAwake()` call and add:

  ```ts
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (settings.keepScreenAwake) {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwakeAsync();
    }
    return () => { deactivateKeepAwakeAsync(); };
  }, [settings.keepScreenAwake]);
  ```

- [ ] **Step 3: Pass settings to `useWorkoutSession`**

  Change:

  ```ts
  } = useWorkoutSession(SEGMENTS);
  ```

  To:

  ```ts
  } = useWorkoutSession(SEGMENTS, settings);
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/screens/WorkoutScreen.tsx
  git commit -m "feat: load settings in WorkoutScreen, wire keepScreenAwake and audio settings"
  ```

---

## Task 4: Update SettingsScreen — `disabled` prop and "Sound off" row

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Add `disabled` prop to `Toggle`**

  Replace the `Toggle` function signature and `onPress` handler:

  ```tsx
  function Toggle({ value, onChange, disabled = false }: {
    value: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
  }) {
  ```

  Update the `Pressable`'s `onPress`:

  ```tsx
  <Pressable
    onPress={() => { if (!disabled) onChange(!value); }}
    style={[
      styles.toggleTrack,
      {
        backgroundColor: value ? T.accent : T.ghostBg,
        borderColor: value ? T.accent : T.hairline,
        shadowColor: value ? T.accent : 'transparent',
        shadowOpacity: value ? 0.33 : 0,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 5,
      },
    ]}
  >
  ```

  No other changes to `Toggle` — the dimming is handled at the row level.

- [ ] **Step 2: Add `disabled` prop to `SRow`**

  Replace the `SRow` function signature and return:

  ```tsx
  function SRow({
    label,
    sub,
    right,
    last,
    disabled,
  }: {
    label: string;
    sub?: string;
    right: React.ReactNode;
    last?: boolean;
    disabled?: boolean;
  }) {
    const { T } = useTheme();
    const styles = useMemo(() => makeStyles(T), [T]);
    return (
      <View style={[styles.row, !last && styles.rowBorder, disabled && { opacity: 0.4 }]}>
        <View style={styles.rowLabels}>
          <Text style={styles.rowLabel}>{label}</Text>
          {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
        </View>
        {right}
      </View>
    );
  }
  ```

- [ ] **Step 3: Replace the "Audio & Haptics" section**

  Replace the existing `<SSection title="Audio & Haptics">` block with:

  ```tsx
  <SSection title="Audio & Haptics">
    <SRow
      label="Sound off"
      sub="Mute all audio"
      right={<Toggle value={settings.soundOff} onChange={v => update('soundOff', v)} />}
    />
    <SRow
      label="Sound cues"
      sub="Play tones on phase changes"
      disabled={settings.soundOff}
      right={<Toggle value={settings.soundCues} onChange={v => update('soundCues', v)} disabled={settings.soundOff} />}
    />
    <SRow
      label="Final countdown beep"
      sub="Audio cue in last 3 seconds"
      disabled={settings.soundOff}
      right={<Toggle value={settings.finalCountdownBeep} onChange={v => update('finalCountdownBeep', v)} disabled={settings.soundOff} />}
    />
    <SRow
      label="Haptic feedback"
      sub="Vibrate on interval transitions"
      disabled={settings.soundOff}
      right={<Toggle value={settings.hapticFeedback} onChange={v => update('hapticFeedback', v)} disabled={settings.soundOff} />}
      last
    />
  </SSection>
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Manual verification**

  Start the app:

  ```bash
  npx expo start --ios
  ```

  Check the following:
  - Settings → "Audio & Haptics" shows "Sound off" at the top
  - Toggling "Sound off" on dims the three rows below it; their toggles do nothing when tapped
  - Toggling "Sound off" back off restores full opacity and interactivity
  - Starting a workout with "Sound off" on produces no audio cues
  - Starting a workout with "Sound off" off and "Sound cues" off produces no chime/tick/finish but does respect that state
  - Starting a workout with "Sound off" off and "Final countdown beep" off silences the last-3-seconds ticks only
  - "Keep screen awake" off prevents the display from staying awake during workout

- [ ] **Step 6: Commit**

  ```bash
  git add src/screens/SettingsScreen.tsx
  git commit -m "feat: add Sound off toggle with disabled state for granular audio rows"
  ```
