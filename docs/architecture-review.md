# Architecture Review — Deepening Opportunities

> Vocabulary: **module** = anything with an interface + implementation. **Depth** = leverage at the interface (a lot of behaviour behind a small interface). **Seam** = where an interface lives. **Locality** = change, bugs, knowledge concentrated in one place. **Deletion test** = if deleting the module concentrates complexity elsewhere, it was earning its keep.

---

## 1. `useEditSession` — interface as wide as its implementation

**Files**: `src/hooks/useEditSession.ts`, `src/screens/EditSessionScreen.tsx`

**Problem**: The hook exports 18+ values and functions — name, difficulty, mode, warmup, work, rest, cooldown, rounds, intervals, activePicker, pickerMinutes, pickerSeconds, pickerRounds, plus setters and actions. Easy-mode state (`warmup`, `work`, `rest`, `cooldown`) and advanced-mode state (`intervals`) coexist simultaneously, so the hook manages dead state depending on which mode is active. The picker modal (4 `useState`) has nothing in common with persistence and is mixed in. The caller must understand everything; the seam provides no leverage.

**Solution**: Split into three composable modules with narrow interfaces:
- `useEditSessionForm` — name, difficulty, mode, fieldValues as a discriminated union by mode
- `useEditSessionPicker` — open/close/commit lifecycle for the time-picker modal
- `useEditSessionPersistence` — load, save, delete

The session form becomes a single typed union value rather than N parallel states.

**Benefits**:
- *Locality*: picker bugs don't send you through save logic; mode-conversion bugs live in one hook
- *Leverage*: callers get a typed session-shape union rather than managing mode branches themselves
- *Testability*: persistence testable without mounting a time-picker; form conversion testable without triggering saves

---

## 2. Theme data has two sources of truth

**Files**: `src/theme.ts` (lines 22–60), `src/screens/SettingsScreen.tsx` (lines 23–47)

**Problem**: `SettingsScreen` declares its own `THEMES` array with hardcoded colors (tidal bg, daybreak bg, accent, phase colors) duplicating what `theme.ts` already owns. A color change in `theme.ts` requires a matching edit in `SettingsScreen.tsx` with no compiler enforcement. The deletion test applied to `theme.ts`'s tokens: deleting them and using only `SettingsScreen`'s copy would break live theming — meaning `theme.ts` is doing real work that `SettingsScreen` is pretending to own.

**Solution**: Export a `THEME_PREVIEWS` map (or similar) from `theme.ts` keyed by theme name. `SettingsScreen` reads from that map rather than redeclaring colors. Single writer, one place to change.

**Benefits**:
- *Locality*: color changes are made in one file
- *Leverage*: the theme module now owns preview data, not just runtime tokens
- Zero risk of preview colors drifting from live colors

---

## 3. `useWorkoutSession` — audio/timer seam is invisible

**Files**: `src/hooks/useWorkoutSession.ts`, `src/lib/audio.ts`

**Problem**: The hook decides which cue to play on each timer callback (chime on transition, tick on countdown, finish sound on completion) with no seam between "what happened" and "what sound plays". Testing timer-orchestration logic (pre-start countdown, state transitions) requires audio to fire unconditionally. Swapping cue sets (e.g., per theme) means editing the hook. Deleting `audio.ts` would require editing `useWorkoutSession` — the caller knows too much about the audio module's internals.

**Solution**: Lift the event→cue mapping into a thin `WorkoutAudioCue` module (or a configuration passed into `useWorkoutSession`). The hook fires events; the mapping decides what plays. With `audio.ts` behind a real seam, you have two concrete adapters: real audio and a no-op for testing.

**Benefits**:
- *Leverage*: timer hook shrinks; event-to-cue mapping is one readable table
- *Locality*: changing which sound plays on which event is a one-file change
- *Testability*: inject a no-op adapter; timer logic is testable without mocking native audio APIs

---

## 4. `EditSessionScreen` inlines `IntervalRow` across 702 lines

**Files**: `src/screens/EditSessionScreen.tsx` (lines 335–367)

**Problem**: The inline `IntervalRow` (phase label, duration display, drag handle, delete button) can't be tested, reused, or read in isolation. The screen also renders two completely different UIs (easy-mode grid vs. advanced-mode drag list) in one component body — you must hold both mental models in your head to read either. The 300-line style block compounds this. Deleting the screen would reveal that `IntervalRow` is earning its keep as a standalone concept.

**Solution**: Extract `IntervalRow` to `src/components/IntervalRow.tsx`. The two mode UIs can stay in one file but benefit from the cleanup — the screen becomes a coordinator between the form hook and one of two well-named render paths.

**Benefits**:
- *Locality*: styling, interactions, and types for an interval row live in one file
- *Leverage*: the screen component becomes a thin layout coordinator
- Future reuse (e.g., a row preview elsewhere) is free

---

## 5. Time formatting — two implementations for the same concept

**Files**: `src/screens/WorkoutScreen.tsx` (lines 27–37), `src/lib/workout.ts`

**Problem**: `tfmt()` (local to WorkoutScreen) and `fmtDuration()` (in workout.ts) both format seconds into a display string, but produce slightly different output. Any future screen must either rediscover `fmtDuration()` or rewrite its own `tfmt()`. Deleting `tfmt()` would force callers to `fmtDuration()` — complexity concentrates there, which is the right place.

**Solution**: Delete `tfmt()` and unify on `fmtDuration()` (rename to `formatSeconds()` if needed and tune its output once). Duration display belongs in `workout.ts` alongside the types that carry durations.

**Benefits**:
- *Locality*: one place to fix how durations display
- *Leverage*: any future screen gets consistent formatting for free
