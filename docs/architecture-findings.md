# Architecture Findings

Deepening opportunities surfaced via `/improve-codebase-architecture`. Vocabulary from [LANGUAGE.md](https://github.com/anthropics/claude-code) — **module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality**.

---

## 1. WorkoutScreen: orchestration buried inside a render module

**Files:** `src/screens/WorkoutScreen.tsx`, `src/hooks/useTimerEngine.ts`, `src/lib/audio.ts`

**Problem:** `WorkoutScreen` (365 lines) does two distinct jobs: orchestration (when to start the timer, when to play audio, when to show congrats) and rendering. The orchestration is untestable without a full screen render. A pre-start countdown (`setInterval` at line 94) runs *outside* `useTimerEngine` — a second implicit timer with no enforced relationship to the main engine. The audio keep-alive and timer engine are silently coupled: if audio dies, the timer continues but nobody knows.

**Solution:** Extract a `useWorkoutSession` hook that owns the full lifecycle — pre-start countdown, audio cue decisions, keep-alive lifecycle, phase-transition state. `WorkoutScreen` receives a narrow interface and only renders.

**Benefits:**
- **Locality:** when pre-start/audio/phase logic breaks, there is one place to look and fix.
- **Leverage:** tests can exercise the state machine (pre-start → running → paused → finished) without rendering anything.

---

## 2. `useEditSession`: interface as wide as its implementation

**Files:** `src/hooks/useEditSession.ts`, `src/screens/EditSessionScreen.tsx`

**Problem:** The hook returns 27 separate items — raw state setters, derived values, picker state, and save logic all poured into one flat object. The interface is as wide as the implementation; callers must learn everything the implementation knows. The seam between hook and screen is so blurry that `EditSessionScreen` takes a `session: Session` prop (line 41) but the hook also receives it as a parameter (line 63) — both ends share responsibility for initialization.

**Solution:** Deepen `useEditSession` by replacing 27 loose items with a small set of cohesive intent operations: `openPicker(field)`, `commitPicker()`, `toggleMode()`, `saveSession()`, plus one read-only `draft` object for rendering.

**Benefits:**
- **Leverage:** `EditSessionScreen` calls intent operations, not state mutations — changes to picker or save logic stay inside the hook.
- **Locality:** validation, mode-switching, and save logic are in one place rather than split between hook and screen.

---

## 3. Segment expansion: the same logic in two modules

**Files:** `src/lib/workout.ts`, `src/hooks/useEditSession.ts` (lines 116–136)

**Problem:** `workout.ts` exports `expandWorkout` and `intervalsToSegments`, defining "how intervals become segments." But `useEditSession` reconstructs this logic during easy→advanced mode conversion (lines 131–136), manually building the interval array in a way that mirrors `expandWorkout`. Two places own the same invariant. If the segment structure changes, both must be updated.

**Solution:** Deepen `workout.ts` with a `buildAdvancedFromEasy(easyConfig)` function as the canonical conversion. `useEditSession` calls it; `workout.ts` owns the invariant.

**Benefits:**
- **Locality:** interval-structure changes are a one-file edit.
- **Leverage:** the conversion logic can be tested directly through `workout.ts`'s interface without touching the hook or screen.

---

## 4. Settings: module declared, seam never reached

**Files:** `src/lib/settings.ts`, `src/screens/SettingsScreen.tsx`, `src/screens/WorkoutScreen.tsx`, `src/lib/audio.ts`

**Problem:** `Settings` defines `finalCountdownBeep`, `hapticFeedback`, `soundCues`, and `keepScreenAwake`. `SettingsScreen` lets users toggle them. None are ever consumed — the audio module always plays ticks, `keepScreenAwake` is always on, haptics never fire. The settings module exists but the seam it should sit at has no adapters reading from it. Deletion test: deleting the settings-toggle UI would cause zero behavioral change.

**Solution:** Add a settings context (mirroring the existing `ThemeContext`) that `useWorkoutAudio` and `WorkoutScreen` consume. The depth comes from `settings.ts` actually governing behavior, not just persisting data.

**Benefits:**
- **Leverage:** users' choices have actual effect; adding a new setting means one place to declare it and one place to consume it.
- **Locality:** all settings-driven behavior flows from one context.

---

## 5. `SessionCard` and `PhaseStrip`: segment expansion at render time

**Files:** `src/components/SessionCard.tsx`, `src/components/PhaseStrip.tsx`

**Problem:** Both components call `getSessionSegments(session)` and `totalDuration(segments)` directly on every render. `SessionsListScreen` renders one `SessionCard` + one `PhaseStrip` per session — 10 sessions means 20 segment-expansion calls per render with no memoization.

**Solution:** Add `useMemo` calls inside each component keyed to `session`, or accept pre-computed `segments` as a prop so `SessionsListScreen` controls when expansion runs.

**Benefits:**
- **Leverage:** `SessionsListScreen` computes once, passes down.
- **Locality:** the "how do we display a session" decision is in one place.
