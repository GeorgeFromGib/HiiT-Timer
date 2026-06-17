# Architecture Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four architectural issues found in the codebase — one TypeScript bug, two module depth improvements, and one separation-of-concerns fix — without changing any user-visible behaviour.

**Architecture:** Each task is fully independent and can be committed separately. The TypeScript compiler (`npx tsc --noEmit`) is the primary verification tool since no test framework is installed. Tasks are ordered from smallest to largest change.

**Tech Stack:** React Native, Expo SDK 56, TypeScript, expo-audio

## Global Constraints

- `npx tsc --noEmit` must pass with zero errors after every task
- No new npm dependencies
- No changes to user-visible behaviour — only internal structure changes
- Match existing code style (no extra comments, no reformatting adjacent code)
- CLAUDE.md: read Expo v56 docs at https://docs.expo.dev/versions/v56.0.0/ before writing any audio code

---

### Task 1: Fix TypeScript error in useWorkoutSession

**Files:**
- Modify: `src/hooks/useWorkoutSession.ts:46-48`

**Interfaces:**
- Consumes: `WorkoutAudioCues.onTransition(to: Phase | null)` from `src/lib/audio.ts`
- Consumes: `TimerEngine.onTransition(from: Segment | null, to: Segment | null)` from `src/hooks/useTimerEngine.ts`
- Produces: nothing new — fixes existing wiring

**Background:** `useTimerEngine` fires `onTransition(from: Segment | null, to: Segment | null)`, but `useWorkoutSession` passes `to` (a `Segment | null`) directly to `cues.onTransition` which expects `Phase | null`. The fix extracts `to.phase`.

- [ ] **Step 1: Open the file and locate the error**

File: `src/hooks/useWorkoutSession.ts`, line 46.

Current code (lines 45–48):
```typescript
const { state, start, pause, resume, reset: engineReset, skip, extend } = useTimerEngine(segments, {
  onTransition: (_from, to) => {
    cues.onTransition(to);
  },
```

- [ ] **Step 2: Apply the fix**

Change line 47 from:
```typescript
    cues.onTransition(to);
```
to:
```typescript
    cues.onTransition(to?.phase ?? null);
```

- [ ] **Step 3: Verify TypeScript passes**

Run: `npx tsc --noEmit`
Expected: zero errors (previously one error)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWorkoutSession.ts
git commit -m "fix: pass Phase not Segment to audio cues onTransition"
```

---

### Task 2: Consolidate audio API into one hook

**Files:**
- Modify: `src/lib/audio.ts` — merge `useWorkoutAudio` and `useWorkoutAudioCues` into a single `useWorkoutAudio(settings)` hook; remove `useWorkoutAudioCues` export
- Modify: `src/hooks/useWorkoutSession.ts` — call the new single hook; remove the `settingsRef` workaround

**Interfaces:**
- Produces: `useWorkoutAudio(settings: AudioSettings): WorkoutAudioCues` — callers pass settings as a value; stale-closure handling is internal
- Consumes (from Task 1): `WorkoutAudioCues.onTransition(to: Phase | null)` — unchanged interface

**Background:** Currently `audio.ts` exports two hooks — `useWorkoutAudio()` (raw players) and `useWorkoutAudioCues(getSettings)` (settings-aware cues). The `getSettings` getter is a stale-closure workaround that leaks as a caller responsibility. The consolidated hook handles settings via an internal ref, removing the workaround.

- [ ] **Step 1: Rewrite `src/lib/audio.ts`**

Replace the entire file with the following (the `WorkoutAudioCues` interface is unchanged; `configureAudioSession` is unchanged; `useWorkoutAudio` now accepts settings):

```typescript
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect, useMemo, useRef } from 'react';
import type { Phase } from './workout';

const CUES = {
  keepalive: require('../../assets/audio/keepalive.wav') as number,
  high:      require('../../assets/audio/high.wav')      as number,
  low:       require('../../assets/audio/low.wav')       as number,
  tick:      require('../../assets/audio/tick.wav')      as number,
  finish:    require('../../assets/audio/finish.wav')    as number,
  chime:     require('../../assets/audio/chime.wav')     as number,
} as const;

type CueKey = keyof typeof CUES;

export type AudioSettings = {
  soundOff: boolean;
  soundCues: boolean;
  finalCountdownBeep: boolean;
  soundVolume: number;
};

export async function configureAudioSession() {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'mixWithOthers',
  });
}

export interface WorkoutAudioCues {
  onTransition(to: Phase | null): void;
  onCountdown(): void;
  onFinish(): void;
  onPreStartTick(): void;
  startKeepAlive(): void;
  stopKeepAlive(): void;
}

export function useWorkoutAudio(settings: AudioSettings): WorkoutAudioCues {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const playersRef   = useRef<Partial<Record<CueKey, AudioPlayer>>>({});
  const keepAliveRef = useRef<AudioPlayer | null>(null);

  const getPlayer = (key: CueKey): AudioPlayer => {
    if (!playersRef.current[key]) {
      playersRef.current[key] = createAudioPlayer(CUES[key]);
    }
    return playersRef.current[key]!;
  };

  useEffect(() => {
    (['chime', 'tick', 'finish'] as const).forEach(getPlayer);
  }, []);

  const playCue = async (key: CueKey, volume = 1) => {
    try {
      const p = getPlayer(key);
      p.volume = volume;
      await p.seekTo(0);
      p.play();
    } catch (e) {
      console.warn('cue failed', key, e);
    }
  };

  const startKeepAlive = () => {
    if (keepAliveRef.current) return;
    const p = createAudioPlayer(CUES.keepalive);
    p.loop = true;
    p.volume = 0;
    p.play();
    keepAliveRef.current = p;
  };

  const stopKeepAlive = () => {
    keepAliveRef.current?.pause();
    keepAliveRef.current?.remove();
    keepAliveRef.current = null;
  };

  useEffect(() => () => {
    stopKeepAlive();
    Object.values(playersRef.current).forEach((p) => p?.remove());
    playersRef.current = {};
  }, []);

  return useMemo<WorkoutAudioCues>(() => ({
    onTransition(to) {
      const s = settingsRef.current;
      if (to && !s.soundOff && s.soundCues) playCue('chime', s.soundVolume / 100);
    },
    onCountdown() {
      const s = settingsRef.current;
      if (!s.soundOff && s.finalCountdownBeep) playCue('tick', s.soundVolume / 100);
    },
    onFinish() {
      const s = settingsRef.current;
      if (!s.soundOff && s.soundCues) playCue('finish', s.soundVolume / 100);
      stopKeepAlive();
    },
    onPreStartTick() {
      const s = settingsRef.current;
      if (!s.soundOff && s.soundCues) playCue('tick', s.soundVolume / 100);
    },
    startKeepAlive,
    stopKeepAlive,
  }), []); // stable: playCue/stopKeepAlive captured at mount but close over playersRef/keepAliveRef (refs, always current)
}
```

- [ ] **Step 2: Update `src/hooks/useWorkoutSession.ts`**

Remove the `settingsRef` workaround and call the unified hook directly.

Replace lines 29–32 (the ref + cues setup):
```typescript
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const cues = useWorkoutAudioCues(() => settingsRef.current);
```
with:
```typescript
  const cues = useWorkoutAudio(settings);
```

Also update the import at the top of the file — change:
```typescript
import { configureAudioSession, useWorkoutAudioCues } from '../lib/audio';
```
to:
```typescript
import { configureAudioSession, useWorkoutAudio } from '../lib/audio';
```

- [ ] **Step 3: Verify TypeScript passes**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/audio.ts src/hooks/useWorkoutSession.ts
git commit -m "refactor: consolidate audio into single useWorkoutAudio(settings) hook"
```

---

### Task 3: Extract pre-start countdown into its own hook

**Files:**
- Create: `src/hooks/usePreStartCountdown.ts`
- Modify: `src/hooks/useWorkoutSession.ts` — replace inline countdown logic with the new hook

**Interfaces:**
- Produces:
  ```typescript
  function usePreStartCountdown(callbacks: {
    onTick?: () => void;
    onComplete: () => void;
  }): {
    count: 3 | 2 | 1 | null;
    begin: () => void;
    cancel: () => void;
    isRunning: () => boolean; // reads a ref — safe in useCallback deps
  }
  ```
- Consumes: nothing new

**Background:** The 3-2-1 countdown before workout start is scattered across `useWorkoutSession` — state, an interval ref, `beginPreStart`, and parts of `handlePlayPause` and `reset`. Extracting it concentrates countdown logic in one place and makes `useWorkoutSession` read as: timer + audio + countdown composition.

- [ ] **Step 1: Create `src/hooks/usePreStartCountdown.ts`**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';

export function usePreStartCountdown(callbacks: {
  onTick?: () => void;
  onComplete: () => void;
}) {
  const [count, setCount] = useState<null | 3 | 2 | 1>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const cancel = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setCount(null);
  }, []);

  const begin = useCallback(() => {
    setCount(3);
    callbacksRef.current.onTick?.();
    let c = 3;
    intervalRef.current = setInterval(() => {
      c -= 1;
      if (c > 0) {
        setCount(c as 2 | 1);
        callbacksRef.current.onTick?.();
      } else {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setCount(null);
        callbacksRef.current.onComplete();
      }
    }, 1000);
  }, []);

  // Reads a ref — always returns current value, safe to call inside useCallback
  const isRunning = useCallback(() => intervalRef.current !== null, []);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  return { count, begin, cancel, isRunning };
}
```

- [ ] **Step 2: Rewrite countdown usage in `src/hooks/useWorkoutSession.ts`**

Add the import at the top:
```typescript
import { usePreStartCountdown } from './usePreStartCountdown';
```

Remove these lines from the function body:
```typescript
  const [preStartCount, setPreStartCount] = useState<null | 3 | 2 | 1>(null);
  const preStartIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

Remove the `useEffect` cleanup for `preStartIntervalRef` (lines 60–62):
```typescript
  useEffect(() => () => {
    if (preStartIntervalRef.current) clearInterval(preStartIntervalRef.current);
  }, []);
```

Remove the `beginPreStart` callback (lines 64–81):
```typescript
  const beginPreStart = useCallback(() => {
    setPreStartCount(3);
    cues.onPreStartTick();
    let count = 3;
    preStartIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setPreStartCount(count as 2 | 1);
        cues.onPreStartTick();
      } else {
        clearInterval(preStartIntervalRef.current!);
        preStartIntervalRef.current = null;
        setPreStartCount(null);
        cues.startKeepAlive();
        start();
      }
    }, 1000);
  }, [start, cues]);
```

Add the countdown hook call after the `cues` line:
```typescript
  const countdown = usePreStartCountdown({
    onTick: () => cues.onPreStartTick(),
    onComplete: () => { cues.startKeepAlive(); start(); },
  });
```

Replace `handlePlayPause` (currently uses `preStartIntervalRef.current` and `beginPreStart`):
```typescript
  const handlePlayPause = useCallback(() => {
    if (countdown.isRunning()) {
      countdown.cancel();
      return;
    }
    if (state.status === 'idle' || state.status === 'finished') {
      countdown.begin();
    } else if (state.status === 'running') {
      pause();
    } else {
      resume();
    }
  }, [countdown, state.status, pause, resume]);
```

Replace `reset` (currently clears `preStartIntervalRef`):
```typescript
  const reset = useCallback(() => {
    countdown.cancel();
    engineReset();
  }, [countdown, engineReset]);
```

Replace the return value — change `preStartCount` to `countdown.count`:
```typescript
  return {
    status: countdown.count !== null ? 'preStart' : state.status,
    preStartCount: countdown.count,
    elapsed: state.elapsed,
    currentIndex: state.currentIndex,
    remainingInSegment: state.remainingInSegment,
    remainingTotal: state.remainingTotal,
    congratsMsg,
    handlePlayPause,
    reset,
    skip,
    extend,
  };
```

- [ ] **Step 3: Verify TypeScript passes**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePreStartCountdown.ts src/hooks/useWorkoutSession.ts
git commit -m "refactor: extract pre-start countdown into usePreStartCountdown hook"
```

---

### Task 4: Move session persistence out of useEditSession

**Files:**
- Modify: `src/hooks/useEditSession.ts` — replace `save()`, `cancel()`, `deleteSession()` with `buildSavePayload()` and `getDeleteTarget()`; remove `loadSessions`, `saveSessions`, `deleteSessionById`, `confirmDeleteSession` imports; remove `Language` type import
- Modify: `src/screens/EditSessionScreen.tsx` — implement `handleSave`, `handleCancel`, `handleDelete` at the screen level

**Interfaces:**
- Produces (from useEditSession):
  ```typescript
  type SavePayload =
    | { ok: true; session: Session; isNew: boolean }
    | { ok: false; titleKey: string; messageKey: string };

  buildSavePayload(): SavePayload
  getDeleteTarget(): { id: string; name: string } | null
  ```
- Removes from useEditSession: `save()`, `cancel()`, `deleteSession()`

**Background:** `useEditSession.save()` calls `loadSessions`, `saveSessions`, and `onBack()` — I/O and navigation inside a form-state hook. Moving persistence to the screen leaves the hook as pure form state. `cancel()` is also removed: `draft.hasChanges` is already exposed, so the screen can own the unsaved-changes dialog directly without any threading of callbacks through the hook.

- [ ] **Step 1: Update `EditSessionInterface` in `src/hooks/useEditSession.ts`**

Locate the `EditSessionInterface` type (around line 64). It currently includes:
```typescript
  save:          () => Promise<void>;
  cancel:        () => void;
  deleteSession: () => void;
```

Replace those three lines with:
```typescript
  buildSavePayload: () => SavePayload;
  getDeleteTarget:  () => { id: string; name: string } | null;
```

- [ ] **Step 2: Add `SavePayload` type to `src/hooks/useEditSession.ts`**

Add after the existing type definitions (after line 32, before the `PHASES` constant):
```typescript
export type SavePayload =
  | { ok: true; session: Session; isNew: boolean }
  | { ok: false; titleKey: string; messageKey: string };
```

- [ ] **Step 3: Remove I/O and unused imports from `src/hooks/useEditSession.ts`**

Change the `sessions` import (line 4):
```typescript
import { loadSessions, saveSessions, deleteSessionById, getSessionSegments, speedForPhase, type Session, type RunSpeeds, DEFAULT_RUN_SPEEDS } from '../lib/sessions';
```
to:
```typescript
import { getSessionSegments, speedForPhase, type Session, type RunSpeeds, DEFAULT_RUN_SPEEDS } from '../lib/sessions';
```

Delete this line entirely:
```typescript
import { confirmDeleteSession } from '../lib/alerts';
```

Change the i18n import — `Language` was only used in `loadSessions(i18n.locale as Language)` which is being removed:
```typescript
import { i18n, type Language } from '../lib/i18n';
```
→
```typescript
import { i18n } from '../lib/i18n';
```

- [ ] **Step 4: Replace `save` with `buildSavePayload` in the hook body**

Find the `save` function (around line 453):
```typescript
  const save = async () => {
    const validation = validateDraft(name, mode, intervals);
    if (!validation.ok) {
      Alert.alert(i18n.t(validation.titleKey), i18n.t(validation.messageKey));
      return;
    }
    const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
    const updated = buildSessionFromDraft(mode, name.trim(), easyConfig, cleanIntervals, activityType, runSpeeds, existing?.id);
    const sessions = await loadSessions(i18n.locale as Language);
    const next = existing
      ? sessions.map(s => (s.id === updated.id ? updated : s))
      : [...sessions, updated];
    await saveSessions(next);
    onBack();
  };
```

Replace it with:
```typescript
  function buildSavePayload(): SavePayload {
    const validation = validateDraft(name, mode, intervals);
    if (!validation.ok) {
      return { ok: false, titleKey: validation.titleKey, messageKey: validation.messageKey };
    }
    const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
    const session = buildSessionFromDraft(mode, name.trim(), easyConfig, cleanIntervals, activityType, runSpeeds, existing?.id);
    return { ok: true, session, isNew: !existing };
  }
```

- [ ] **Step 5: Replace `deleteSession` with `getDeleteTarget` in the hook body**

Find the `deleteSession` function (around line 491):
```typescript
  function deleteSession() {
    if (!existing) return;
    confirmDeleteSession(existing.name, async () => {
      await deleteSessionById(existing.id);
      onBack();
    });
  }
```

Replace it with:
```typescript
  function getDeleteTarget(): { id: string; name: string } | null {
    if (!existing) return null;
    return { id: existing.id, name: existing.name };
  }
```

- [ ] **Step 6: Delete `cancel` from the hook body and return statement**

Find and delete the entire `cancel` function (around line 475):
```typescript
  function cancel() {
    if (hasChanges) {
      Alert.alert(
        i18n.t('alerts.unsavedTitle'),
        i18n.t('alerts.unsavedMessage'),
        [
          { text: i18n.t('alerts.saveBtn'), onPress: () => save() },
          { text: i18n.t('alerts.discard'), style: 'destructive', onPress: onBack },
          { text: i18n.t('alerts.keepEditing'), style: 'cancel' },
        ],
      );
    } else {
      onBack();
    }
  }
```

In the return statement (around line 514), replace:
```typescript
    save,
    cancel,
    deleteSession,
```
with:
```typescript
    buildSavePayload,
    getDeleteTarget,
```

- [ ] **Step 7: Add `handleSave`, `handleCancel`, `handleDelete` to `src/screens/EditSessionScreen.tsx`**

Add these imports at the top of EditSessionScreen.tsx (if not already present):
```typescript
import { loadSessions, saveSessions, deleteSessionById } from '../lib/sessions';
import { confirmDeleteSession } from '../lib/alerts';
import { i18n, type Language } from '../lib/i18n';
import { Alert } from 'react-native';
```

Add these three functions to the screen component body (before the JSX return):

```typescript
async function handleSave() {
  const payload = editSession.buildSavePayload();
  if (!payload.ok) {
    Alert.alert(i18n.t(payload.titleKey), i18n.t(payload.messageKey));
    return;
  }
  const sessions = await loadSessions(i18n.locale as Language);
  const next = payload.isNew
    ? [...sessions, payload.session]
    : sessions.map(s => (s.id === payload.session.id ? payload.session : s));
  await saveSessions(next);
  onBack();
}

function handleCancel() {
  if (!editSession.draft.hasChanges) { onBack(); return; }
  Alert.alert(
    i18n.t('alerts.unsavedTitle'),
    i18n.t('alerts.unsavedMessage'),
    [
      { text: i18n.t('alerts.saveBtn'), onPress: handleSave },
      { text: i18n.t('alerts.discard'), style: 'destructive', onPress: onBack },
      { text: i18n.t('alerts.keepEditing'), style: 'cancel' },
    ],
  );
}

function handleDelete() {
  const target = editSession.getDeleteTarget();
  if (!target) return;
  confirmDeleteSession(target.name, async () => {
    await deleteSessionById(target.id);
    onBack();
  });
}
```

- [ ] **Step 8: Replace call sites in `src/screens/EditSessionScreen.tsx`**

Find and replace:
- `editSession.save()` → `handleSave()`
- `editSession.cancel()` → `handleCancel()`
- `editSession.deleteSession()` → `handleDelete()`

- [ ] **Step 9: Verify TypeScript passes**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 10: Smoke test manually**

1. Open the app and navigate to Edit Session for an existing session
2. Make a change and tap Save — confirm session saves and returns to list
3. Open an existing session, tap Delete — confirm delete dialog appears and session is removed
4. Open a new session, make changes, tap back/cancel — confirm "unsaved changes" dialog appears with Save option that works

- [ ] **Step 11: Commit**

```bash
git add src/hooks/useEditSession.ts src/screens/EditSessionScreen.tsx
git commit -m "refactor: move session persistence out of useEditSession into screen"
```

---

## Self-Review

### Spec coverage

| Issue | Task |
|---|---|
| TypeScript error: Segment passed where Phase expected | Task 1 |
| Audio: two hooks with leaky getSettings getter pattern | Task 2 |
| useWorkoutSession: countdown logic scattered across hook | Task 3 |
| useEditSession: I/O (loadSessions/saveSessions) inside form-state hook | Task 4 |

**Skipped (by design):**
- Segment domain consolidation: moving `getSessionSegments` to `workout.ts` creates a circular dependency (`workout.ts` → `sessions.ts` → `workout.ts`). The current split is the correct place given the import graph.
- Navigation context: App.tsx navigation works correctly. The only screen that constructs routes is `SessionsListScreen`. Not broken enough to justify a large refactor.

### Placeholder scan

No TBDs, todos, or vague instructions found.

### Type consistency

- `SavePayload` defined in Task 4 Step 2, used in Steps 4, 9
- `WorkoutAudioCues` interface unchanged across Task 2
- `usePreStartCountdown` return type defined in Task 3 Step 1, consumed in Steps 2
- `isRunning()` is a function (not a boolean) — all call sites use `countdown.isRunning()` ✓
