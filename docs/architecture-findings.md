# Architecture Findings

Deepening opportunities surfaced from a codebase review. Organised using the vocabulary of deep modules: **depth** (leverage at the interface), **locality** (change concentrated in one place), and **seam** (where behaviour can be altered without editing in place).

---

## Summary

The codebase is well-structured. The data layer (`workout.ts`, `sessions.ts`, `settings.ts`) is pure and portable. The realtime engine (`timerEngine.ts`, `audio.ts`) handles complexity correctly. No circular dependencies. The main friction concentrates in `EditSessionScreen.tsx`, which combines three complex concerns without sufficient abstraction, and in a handful of duplications and dead wires elsewhere.

---

## Deepening Opportunities

### 1. Deepen `EditSessionScreen` state into a `useEditSession` hook

**Files:** `src/EditSessionScreen.tsx`

**Problem:** The screen manages 13+ separate state variables (`name`, `difficulty`, `mode`, `warmup`, `work`, `rest`, `rounds`, `cooldown`, `intervals`, `activePicker`, `pickerMinutes`, `pickerSeconds`, `pickerRounds`). Opening a picker requires atomically setting three variables — miss one and the modal shows stale data. The `tryConvertToEasy` mode-conversion logic also lives inside the component, making it untestable without mounting a full screen. The interface of this module *is* its implementation.

**Solution:** Extract a `useEditSession(session)` hook that owns all form state and exposes commands (`setName`, `toggleMode`, `openPicker`, `commitPicker`, `addInterval`, etc.) plus a single derived state object. `EditSessionScreen` becomes a thin renderer.

**Benefits:**
- *Locality* — all form state transitions and validation live in one place.
- *Leverage* — callers get a clean command surface; the picker lifecycle invariant is enforced once, not spread across 3 call sites.
- *Testability* — the hook's state machine is testable without the React Native renderer; every transition (mode switch, picker open/commit, conversion failure) can be a unit test.

---

### 2. Move `tryConvertToEasy` into `workout.ts`

**Files:** `src/EditSessionScreen.tsx`, `src/workout.ts`

**Problem:** The mode-conversion logic — validating that an advanced interval list matches the easy warmup/work/rest/cooldown/rounds pattern — is a pure data transformation buried inside a UI file. It belongs with the data model that defines what a workout *is*. Deletion test: remove it from the screen → complexity doesn't disappear, it reappears anywhere else that needs to convert session modes.

**Solution:** Move `tryConvertToEasy(intervals): WorkoutConfig | null` to `workout.ts` as a pure function alongside `expandWorkout` and `intervalsToSegments`.

**Benefits:**
- *Locality* — conversion logic lives next to the types it operates on.
- *Leverage* — any future screen or tool that handles session mode switching gets it for free.
- *Testability* — pure function with no React deps; every edge case (odd round count, wrong pattern) becomes a one-liner test.

---

### 3. Eliminate the `fmtDuration` triplication

**Files:** `src/EditSessionScreen.tsx`, `src/components/SessionCard.tsx`, `src/WorkoutScreen.tsx`

**Problem:** A `fmtDuration(seconds)` utility is independently defined in three files. They appear identical today; they will silently diverge. This is a shallow seam — the function has no depth, but its absence from `workout.ts` creates coupling by duplication.

**Solution:** Add `fmtDuration` to `workout.ts` (it formats values of the `duration` field — it belongs with the type), delete the three local copies.

**Benefits:** One place to fix edge cases (e.g. hours-long durations). Trivially testable as a pure function.

---

### 4. Close the `soundCues` / `hapticFeedback` dead wire

**Files:** `src/audio.ts`, `src/WorkoutScreen.tsx`, `src/settings.ts`

**Problem:** `settings.ts` declares `soundCues` and `hapticFeedback` toggles; `SettingsScreen` renders them. But neither is checked before `playCue()` fires — audio always plays regardless of user preference. The seam exists (settings → behaviour) but the wire is cut. Users who toggle these off see no change.

**Solution:** Pass the relevant settings into `useWorkoutAudio()` (or read them at the call site in `WorkoutScreen`), and guard cue playback behind the toggle. Add haptic calls (via `expo-haptics`) gated on the haptic toggle.

**Benefits:**
- *Leverage* — the audio module's interface already implies controllability; making it real closes a behavioural lie.
- *Locality* — the setting and its effect live in adjacent modules connected by a clear seam, not silently disconnected.

---

### 5. Centralise `DIFFICULTY_COLORS` in `sessions.ts`

**Files:** `src/EditSessionScreen.tsx`, `src/components/SessionCard.tsx`, `src/sessions.ts`

**Problem:** A `DIFFICULTY_COLORS` mapping (`Easy → green`, `Medium → yellow`, `Hard → red`) is defined independently in two files. `Difficulty` is a type owned by `sessions.ts`; its visual representation is a theme concern, but the mapping itself (which difficulty = which semantic colour) is domain knowledge.

**Solution:** Export `DIFFICULTY_COLORS` from `sessions.ts` (or `theme.ts` if phase colours also live there). Delete the duplicates.

**Benefits:** Adding a new difficulty tier requires one change, not two.

---

## Module Depth Reference

| Module | Depth | Notes |
|---|---|---|
| `workout.ts` | High | Pure functions, clean contract. `expandWorkout` hides significant complexity behind a small interface. |
| `timerEngine.ts` | Very high | Wall-clock drift compensation, deduplication, pause/resume — all behind a clean hook interface. |
| `audio.ts` | Medium | Keep-alive trick is sophisticated; interface exposes more than callers need (`playCue` vs `cueForPhase`). Settings wire missing. |
| `sessions.ts` | Medium | Handles two data models + I/O. `getSessionSegments` is a thin adapter (shallow). |
| `settings.ts` | Shallow | Pure CRUD. Appropriate given its role. |
| `theme.ts` | Shallow | Design tokens + React context. Appropriate. |
| `EditSessionScreen.tsx` | Low | Interface is its implementation. Prime candidate for deepening via hook extraction. |
| `WorkoutScreen.tsx` | High | Fat controller by design — correct for workout display. Wires 3 deep modules cleanly. |
| `WheelColumn.tsx` | Shallow | Magic numbers, no prop-change response. Fragile scroll binding. |
