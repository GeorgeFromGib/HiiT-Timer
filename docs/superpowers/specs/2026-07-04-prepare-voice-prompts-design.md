# 5-Second "Prepare For" Voice Prompts Design

**Date:** 2026-07-04  
**Status:** Draft  
**Scope:** Add voice announcements 5 seconds before each phase transition

## Overview

Extend the voice prompt system to announce the upcoming phase 5 seconds before it begins. This gives users advance notice to prepare for work intervals, recovery periods, or cooldown. The feature respects the existing `voiceCues` and `soundOff` settings.

## Requirements

1. Trigger "prepare for <phase name>" voice prompt exactly 5 seconds before each segment ends
2. Support all current languages: English, Spanish, French
3. For the final segment (cooldown or last phase), announce "get ready to finish" instead of a phase name
4. Play "prepare" cue AND regular phase transition cue (both, not instead of)
5. Respect existing audio settings (`voiceCues`, `soundOff`)
6. Use precise timing (setTimeout) to avoid drift, consistent with countdown beats

## Implementation

### 1. Timer Engine: Add `onPrepare` Callback

**File:** `src/hooks/useTimerEngine.ts`

Extend the `Callbacks` interface:

```typescript
interface Callbacks {
  onTransition?: (from: Segment | null, to: Segment | null) => void;
  onCountdown?: (secondsLeft: number, segment: Segment) => void;
  onPrepare?: (nextSegment: Segment) => void;  // NEW
  onFinish?: () => void;
}
```

**Timing logic:**
- Schedule the callback using `setTimeout` when entering a segment, firing exactly 5 seconds before the segment ends
- Use the same de-duplication pattern as countdown beats to ensure it fires exactly once
- Clear the timeout on pause, reset, or skip
- Re-schedule on resume if the prepare moment hasn't passed yet

**Implementation detail:** In the `tick` function, when transitioning to a new segment, call `scheduleBeats()` (renamed or extended to `scheduleBeatAndPrepare()`):
- If remaining time in segment > 5 seconds, schedule a timeout for 5 seconds before the end
- Add to `beatTimeoutsRef` for cleanup management

### 2. Audio Layer: Add `onPrepare` to WorkoutAudioCues

**File:** `src/lib/audio.ts`

Extend the interface:

```typescript
export interface WorkoutAudioCues {
  onTransition(to: Phase | null): void;
  onCountdown(): void;
  onPrepare(nextPhase: Phase): void;  // NEW
  onFinish(): void;
  onPreStartTick(): void;
  startKeepAlive(): void;
  stopKeepAlive(): void;
}
```

Implement the method:

```typescript
onPrepare(nextPhase: Phase) {
  const s = settingsRef.current;
  if (!s.voiceCues || s.soundOff) return;
  speakPrepare(nextPhase, s.language);
}
```

### 3. Speech Layer: Add `speakPrepare` Function

**File:** `src/lib/speech.ts`

Add new function:

```typescript
export function speakPrepare(phase: Phase, language: Language): void {
  const text = i18n.t(`speech.prepare.${phase}`, { locale: language });
  speak(text, language).catch(() => {});
}
```

### 4. i18n Translations

**File:** `src/lib/i18n.ts` (or equivalent)

Add translation keys for all phases and all three languages:

**English:**
- `speech.prepare.warmup` → "Prepare for warmup"
- `speech.prepare.work` → "Prepare for work"
- `speech.prepare.rest` → "Prepare for recovery"
- `speech.prepare.cooldown` → "Prepare for cooldown"
- `speech.prepare.circuitRest` → "Prepare for break"
- `speech.prepare.finish` → "Get ready to finish"

**Spanish:**
- `speech.prepare.warmup` → "Prepárate para el calentamiento"
- `speech.prepare.work` → "Prepárate para el trabajo"
- `speech.prepare.rest` → "Prepárate para la recuperación"
- `speech.prepare.cooldown` → "Prepárate para el enfriamiento"
- `speech.prepare.circuitRest` → "Prepárate para el descanso"
- `speech.prepare.finish` → "Prepárate para terminar"

**French:**
- `speech.prepare.warmup` → "Préparez-vous pour l'échauffement"
- `speech.prepare.work` → "Préparez-vous pour l'effort"
- `speech.prepare.rest` → "Préparez-vous pour la récupération"
- `speech.prepare.cooldown` → "Préparez-vous pour le refroidissement"
- `speech.prepare.circuitRest` → "Préparez-vous pour la pause"
- `speech.prepare.finish` → "Préparez-vous à terminer"

### 5. Workout Session: Wire the Callback

**File:** `src/hooks/useWorkoutSession.ts`

Pass the callback to the timer engine:

```typescript
const { state, start, pause, resume, ... } = useTimerEngine(segments, {
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
  onPrepare: (nextSeg) => {  // NEW
    if (nextSeg) {
      const phase = nextSeg.index === segments.length - 1 ? 'finish' : nextSeg.phase;
      cues.onPrepare(phase);
    }
  },
  onFinish: () => {
    cues.onFinish();
    if (settings.hapticFeedback) startHapticBurst();
  },
});
```

**Note:** Detect the final segment by checking if `nextSeg.index === segments.length - 1`. If true, pass `'finish'` as the phase (this will map to the "get ready to finish" translation).

### 6. Handling the Final Segment

Since `Phase` is a union type that doesn't include `'finish'`, one of these approaches:

**Option A (Recommended):** Extend the `Phase` type to include `'finish'`:
```typescript
export type Phase = 'warmup' | 'work' | 'rest' | 'cooldown' | 'circuitRest' | 'finish';
```

Then add `'finish'` to `PHASE_META` (though it won't be used for display):
```typescript
finish: { word: '', icon: '' },  // placeholder, never rendered
```

**Option B:** Overload `onPrepare` to accept `Phase | 'finish'` in the callback signature.

**Selected: Option A** — simpler and clearer.

## Edge Cases

- **Segments < 5 seconds:** If a segment is shorter than 5 seconds, don't schedule a prepare callback (the event would have already passed by the time the segment starts).
- **Paused state:** Clear all prepare timeouts on pause; re-schedule on resume if time remains.
- **Skip action:** Clear any pending prepare timeout when the user skips a segment.
- **Resume from pause:** Recalculate remaining time; if > 5 seconds away from the next transition, schedule the prepare callback.

## Testing

Manual verification:
1. Start a workout with voice cues enabled
2. Monitor that "prepare for <phase>" plays 5 seconds before each transition
3. Verify the final segment says "get ready to finish"
4. Test with voice cues disabled—no audio should play
5. Test pause/resume—prepare callback should re-schedule correctly
6. Test skip—prepare callback for that segment should be skipped

No new test files needed (no tests configured yet per CLAUDE.md).

## Files to Modify

1. `src/hooks/useTimerEngine.ts` — add `onPrepare` callback, scheduling logic
2. `src/lib/audio.ts` — add `onPrepare` method to `WorkoutAudioCues`
3. `src/lib/speech.ts` — add `speakPrepare()` function
4. `src/lib/i18n.ts` — add translation keys for all phases, all languages
5. `src/hooks/useWorkoutSession.ts` — wire callback into timer engine
6. `src/lib/workout.ts` — extend `Phase` type to include `'finish'`, update `PHASE_META`

## Success Criteria

- Voice prompt plays exactly 5 seconds before each phase transition
- Final segment announces "get ready to finish"
- Works in English, Spanish, and French
- Respects `voiceCues` and `soundOff` settings
- Timing is precise (no drift, no duplicate fires)
- Pause/resume and skip actions work correctly
