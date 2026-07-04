# Prepare Voice Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add voice announcements 5 seconds before each phase transition to give users advance notice.

**Architecture:** Extend the timer engine with a new `onPrepare` callback that fires exactly 5 seconds before a segment ends (using precise `setTimeout` like the countdown system). Wire this through the audio layer to trigger a new `speakPrepare()` function. Extend the `Phase` type to include a special `'finish'` phase for the final segment announcement.

**Tech Stack:** 
- Timer: `expo-audio` (already configured), `setTimeout` for precise scheduling
- Speech: `expo-speech` (already configured)
- i18n: existing i18n system with locale-specific translations

## Global Constraints

- Support three languages: English, Spanish, French (matching existing system)
- Respect existing settings: `voiceCues` and `soundOff` must gate the feature
- Use precise `setTimeout` scheduling (not polling) to avoid drift
- Final segment announces "get ready to finish" instead of a phase name

---

## Task 1: Extend Phase Type and PHASE_META

**Files:**
- Modify: `src/lib/workout.ts:1-39`

**Interfaces:**
- Produces: `Phase` now includes `'finish'`; `PHASE_META['finish']` exists

- [ ] **Step 1: Open the file and review the Phase type**

```bash
cat src/lib/workout.ts | head -40
```

Expected output: You see `export type Phase = 'warmup' | 'work' | 'rest' | 'cooldown' | 'circuitRest';` and `PHASE_META` with entries for each phase.

- [ ] **Step 2: Add 'finish' to Phase type**

Edit `src/lib/workout.ts`:

```typescript
export type Phase = 'warmup' | 'work' | 'rest' | 'cooldown' | 'circuitRest' | 'finish';
```

- [ ] **Step 3: Add 'finish' entry to PHASE_META**

Add this line to the `PHASE_META` object (after `circuitRest`):

```typescript
finish: { word: '', icon: '' },
```

- [ ] **Step 4: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workout.ts
git commit -m "feat: add 'finish' phase type for prepare voice prompts"
```

---

## Task 2: Add speakPrepare Function to Speech Layer

**Files:**
- Modify: `src/lib/speech.ts:1-25`

**Interfaces:**
- Consumes: `Phase` (now includes `'finish'`), `Language` type, `i18n` object
- Produces: `speakPrepare(phase: Phase, language: Language) => void`

- [ ] **Step 1: Review current speech.ts structure**

```bash
cat src/lib/speech.ts
```

Expected: You see `speakPhase()` and `speakComplete()` using `i18n.t()` for translations.

- [ ] **Step 2: Add speakPrepare function**

Add this function to `src/lib/speech.ts` after the `speakPhase` function:

```typescript
export function speakPrepare(phase: Phase, language: Language): void {
  const text = i18n.t(`speech.prepare.${phase}`, { locale: language });
  speak(text, language).catch(() => {});
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: No errors related to the new function.

- [ ] **Step 4: Commit**

```bash
git add src/lib/speech.ts
git commit -m "feat: add speakPrepare function for phase announcements"
```

---

## Task 3: Add i18n Translations for All Phases and Languages

**Files:**
- Modify: `src/lib/i18n.ts` (locate the speech.prepare keys section)

**Interfaces:**
- Consumes: `speech.prepare` translation namespace
- Produces: Translation keys for `speech.prepare.warmup`, `speech.prepare.work`, `speech.prepare.rest`, `speech.prepare.cooldown`, `speech.prepare.circuitRest`, `speech.prepare.finish` in en, es, fr

- [ ] **Step 1: Review i18n.ts structure**

```bash
grep -A 5 "speech.phases" src/lib/i18n.ts | head -20
```

Expected: You see how translations are structured (likely a nested object or locale-specific files).

- [ ] **Step 2: Add prepare translations for English**

Locate the English translations section and add this block (or equivalent depending on structure):

```typescript
// Under the speech namespace, add:
prepare: {
  warmup: 'Prepare for warmup',
  work: 'Prepare for work',
  rest: 'Prepare for recovery',
  cooldown: 'Prepare for cooldown',
  circuitRest: 'Prepare for break',
  finish: 'Get ready to finish',
}
```

- [ ] **Step 3: Add prepare translations for Spanish**

```typescript
prepare: {
  warmup: 'Prepárate para el calentamiento',
  work: 'Prepárate para el trabajo',
  rest: 'Prepárate para la recuperación',
  cooldown: 'Prepárate para el enfriamiento',
  circuitRest: 'Prepárate para el descanso',
  finish: 'Prepárate para terminar',
}
```

- [ ] **Step 4: Add prepare translations for French**

```typescript
prepare: {
  warmup: 'Préparez-vous pour l\'échauffement',
  work: 'Préparez-vous pour l\'effort',
  rest: 'Préparez-vous pour la récupération',
  cooldown: 'Préparez-vous pour le refroidissement',
  circuitRest: 'Préparez-vous pour la pause',
  finish: 'Préparez-vous à terminer',
}
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat: add i18n translations for prepare voice prompts (en, es, fr)"
```

---

## Task 4: Add onPrepare Callback to Timer Engine

**Files:**
- Modify: `src/hooks/useTimerEngine.ts:30-102`

**Interfaces:**
- Consumes: `Segment` type, existing callback system
- Produces: `onPrepare?: (nextSegment: Segment) => void` in `Callbacks` interface; scheduling logic in `useTimerEngine`

- [ ] **Step 1: Review useTimerEngine.ts to understand callback system**

```bash
cat src/hooks/useTimerEngine.ts | grep -A 20 "interface Callbacks"
```

Expected: You see `onTransition`, `onCountdown`, `onFinish` callbacks with their signatures.

- [ ] **Step 2: Add onPrepare to Callbacks interface**

Edit `src/hooks/useTimerEngine.ts` around line 30. Update the `Callbacks` interface:

```typescript
interface Callbacks {
  onTransition?: (from: Segment | null, to: Segment | null) => void;
  onCountdown?: (secondsLeft: number, segment: Segment) => void;
  onPrepare?: (nextSegment: Segment) => void;
  onFinish?: () => void;
}
```

- [ ] **Step 3: Review the scheduleBeats function (lines 84-102)**

```bash
cat src/hooks/useTimerEngine.ts | sed -n '84,102p'
```

Expected: You see how timeouts are scheduled for countdown beats.

- [ ] **Step 4: Extend scheduleBeats to include prepare callback**

Replace the `scheduleBeats` function with this updated version:

```typescript
const scheduleBeats = (segIndex: number, remainingSeconds: number) => {
  clearBeats();
  
  // Schedule prepare callback at 5 seconds
  if (remainingSeconds > 5) {
    const delayMs = (remainingSeconds - 5) * 1000;
    beatTimeoutsRef.current.push(
      setTimeout(() => {
        if (statusRef.current === 'running') {
          const nextSeg = segmentsRef.current[segIndex + 1];
          if (nextSeg) cbRef.current.onPrepare?.(nextSeg);
        }
      }, delayMs),
    );
  }
  
  // Schedule countdown beats (3, 2, 1)
  [3, 2, 1].forEach((beat) => {
    const delayMs = (remainingSeconds - beat) * 1000;
    if (delayMs >= 0) {
      beatTimeoutsRef.current.push(
        setTimeout(() => {
          if (statusRef.current === 'running') {
            const seg = segmentsRef.current[segIndex];
            if (seg) cbRef.current.onCountdown?.(beat, seg);
          }
        }, delayMs),
      );
    }
  });
};
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTimerEngine.ts
git commit -m "feat: add onPrepare callback to timer engine for 5-second prompts"
```

---

## Task 5: Add onPrepare Method to WorkoutAudioCues

**Files:**
- Modify: `src/lib/audio.ts:38-135`

**Interfaces:**
- Consumes: `WorkoutAudioCues` interface, `Phase` type, `speakPrepare` function, `AudioSettings` type
- Produces: `onPrepare(nextPhase: Phase) => void` method in `WorkoutAudioCues`

- [ ] **Step 1: Review WorkoutAudioCues interface**

```bash
cat src/lib/audio.ts | sed -n '38,45p'
```

Expected: You see the interface with `onTransition`, `onCountdown`, `onFinish` methods.

- [ ] **Step 2: Add onPrepare to WorkoutAudioCues interface**

Edit `src/lib/audio.ts`. Update the interface (around line 38):

```typescript
export interface WorkoutAudioCues {
  onTransition(to: Phase | null): void;
  onCountdown(): void;
  onPrepare(nextPhase: Phase): void;
  onFinish(): void;
  onPreStartTick(): void;
  startKeepAlive(): void;
  stopKeepAlive(): void;
}
```

- [ ] **Step 3: Review the return statement of useWorkoutAudio (around line 102)**

```bash
cat src/lib/audio.ts | sed -n '102,135p'
```

Expected: You see the useMemo return object with method implementations.

- [ ] **Step 4: Add onPrepare implementation to the returned object**

In the `useMemo` return block, add this method after `onCountdown`:

```typescript
    onPrepare(nextPhase: Phase) {
      const s = settingsRef.current;
      if (!s.voiceCues || s.soundOff) return;
      speakPrepare(nextPhase, s.language);
    },
```

Note: Make sure to import `speakPrepare` at the top of the file. Add to the import from `'./speech'`:

```typescript
import { speakPhase, speakComplete, speakPrepare } from './speech';
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audio.ts
git commit -m "feat: add onPrepare method to audio layer for voice prompts"
```

---

## Task 6: Wire onPrepare Callback in Workout Session

**Files:**
- Modify: `src/hooks/useWorkoutSession.ts:38-90`

**Interfaces:**
- Consumes: `useTimerEngine` hook with updated `Callbacks`, `useWorkoutAudio` with updated `onPrepare` method, `segments` parameter
- Produces: Wired callback that passes phase information from timer to audio layer

- [ ] **Step 1: Review useWorkoutSession timer engine setup (lines 75-90)**

```bash
cat src/hooks/useWorkoutSession.ts | sed -n '75,90p'
```

Expected: You see the callback object passed to `useTimerEngine`.

- [ ] **Step 2: Add onPrepare callback to the timer engine config**

Edit `src/hooks/useWorkoutSession.ts`. In the `useTimerEngine` call, add this callback after `onCountdown`:

```typescript
    onPrepare: (nextSeg) => {
      const totalSegments = segments.length;
      const isLastSegment = nextSeg.index === totalSegments - 1;
      const phase = isLastSegment ? 'finish' : nextSeg.phase;
      cues.onPrepare(phase);
    },
```

The full callback object should look like:

```typescript
  const { state, start, pause, resume, reset: engineReset, skip, extend, replaceSegments, getSegments } = useTimerEngine(segments, {
    onTransition: (_from, to) => {
      cues.onTransition(to?.phase ?? null);
      if (to !== null && settings.hapticFeedback) {
        startHapticBurst();
      }
    },
    onCountdown: () => {
      cues.onCountdown();
      onCountdownBeatRef.current?.();
    },
    onPrepare: (nextSeg) => {
      const totalSegments = segments.length;
      const isLastSegment = nextSeg.index === totalSegments - 1;
      const phase = isLastSegment ? 'finish' : nextSeg.phase;
      cues.onPrepare(phase);
    },
    onFinish: () => {
      cues.onFinish();
      if (settings.hapticFeedback) startHapticBurst();
    },
  });
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWorkoutSession.ts
git commit -m "feat: wire onPrepare callback in workout session"
```

---

## Task 7: Manual Testing

**Interfaces:**
- Consumes: All implemented changes above

- [ ] **Step 1: Start the dev server**

```bash
npx expo start --ios
```

(or your preferred platform)

- [ ] **Step 2: Start a workout with voice cues enabled**

Navigate to Settings, ensure:
- Voice Cues: enabled
- Sound Off: disabled

Start a short session (e.g., 10 seconds warmup, 10 seconds work, 10 seconds rest).

- [ ] **Step 3: Listen for "prepare for" announcements**

At the 5-second mark of each phase:
- During warmup (at 5s): Should hear "Prepare for work"
- During work (at 5s): Should hear "Prepare for recovery"
- During rest (at 5s): Should hear "Prepare for cooldown"
- During cooldown (at 5s): Should hear "Get ready to finish"

- [ ] **Step 4: Verify transition announcements still play**

After the "prepare" announcement, when the phase actually transitions, the normal phase announcement should play ("Work", "Recovery", "Cooldown", etc.).

- [ ] **Step 5: Test with voice cues disabled**

In Settings, toggle Voice Cues off. Start a new workout. Verify no "prepare for" announcements play.

- [ ] **Step 6: Test pause/resume**

Start a workout, pause it at 8 seconds into a phase, resume it. Verify the prepare announcement still fires at the right time.

- [ ] **Step 7: Test skip**

Start a workout, skip a segment at 7 seconds in. Verify no "prepare for" announcement fires for the skipped segment.

- [ ] **Step 8: Test language switching**

In Settings, change language to Spanish or French. Start a new workout. Verify announcements are in the selected language.

- [ ] **Step 9: Commit testing notes (optional)**

If you discovered any issues, document them and fix them before committing. Otherwise:

```bash
git log --oneline | head -10
```

Verify all 6 feature commits are present.

---

## Success Criteria

✅ "Prepare for <phase>" voice announcement plays exactly 5 seconds before each phase transition  
✅ Final segment announces "Get ready to finish"  
✅ Works in English, Spanish, and French  
✅ Respects `voiceCues` and `soundOff` settings  
✅ Timing is precise (no drift, no duplicate fires)  
✅ Pause/resume and skip actions work correctly  
✅ Regular phase transition announcements still play
