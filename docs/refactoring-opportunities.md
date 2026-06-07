# Refactoring Opportunities

Findings from architectural review of `src/`. Ordered by impact.

---

## Tier 1 — High leverage

### 1. Merge `PhaseIcon` / `ReadyIcon` / `FinishedIcon` → `Icon.tsx`

**Files:** `components/PhaseIcon.tsx`, `components/ReadyIcon.tsx`, `components/FinishedIcon.tsx`

All three are structurally identical: accept `color`/`size`, apply `BASE_SVG_STROKE`, render SVG. The line `const p = { ...BASE_SVG_STROKE, stroke: color }` is copy-pasted across all three. The interface is nearly as complex as the implementation — shallow modules. A single `Icon.tsx` with a type discriminant collapses 3 files into 1.

---

### 2. Extract theme style helpers to `theme.ts`

**Files:** `SessionCard.tsx`, `EditSessionScreen.tsx`, `SettingsScreen.tsx`, `WorkoutScreen.tsx`

The pattern `withOpacity(color, 0x22)` for background + `withOpacity(color, 0x44)` for border appears in at least 6 places across 4 files. Every selected/active state re-derives the same formula inline. Moving a `selectedItemStyle(T, color)` helper to `theme.ts` makes the intent visible at each call site and centralises any future changes.

---

### 3. Move `deleteSession` logic to `lib/sessions.ts`

**Files:** `SessionsListScreen.tsx:31–38`, `useEditSession.ts:267–273`

Both call `confirmDeleteSession`, then load → filter → save. The mutation logic is identical; only the post-delete cleanup differs. The business logic should live in `sessions.ts`, not duplicated across two call sites.

---

### 4. Extract `PickerModal` component

**Files:** `EditSessionScreen.tsx:271–329`, `useEditSession.ts:75–150`

The modal rendering (rounds vs. time wheel layout) and the hook state shape are tightly coupled across two files. Extracting a `PickerModal` component that owns the JSX would let `EditSessionScreen` shrink by ~70 lines and make the picker logic easier to reason about in isolation.

---

## Tier 2 — Medium impact

### 5. Extract `Toggle` / `SettingsRow` / `SettingsSection` to `/components/`

**File:** `SettingsScreen.tsx:18–102`

Three reusable UI components are defined locally and scoped to `SettingsScreen`. Any future settings-like screen would have to duplicate them. Moving them to `components/` makes them available without structural changes.

---

### 6. Move `IntervalRow` to `/components/`

**File:** `EditSessionScreen.tsx:346–368`

Self-contained component defined locally, only accessible from within `EditSessionScreen`. Nothing prevents extracting it.

---

### 7. Simplify audio callback setup in `useWorkoutSession`

**File:** `useWorkoutSession.ts:51–83`

The same `settingsRef.current` destructure + audio call pattern appears three times (onTransition, onCountdown, onFinish). A small factory function would eliminate the repetition and make the audio decision logic easier to follow.

---

## Tier 3 — Hygiene

### 8. `DragHandle` SVG component

**Files:** `SessionCard.tsx:39–41`, `EditSessionScreen.tsx` (IntervalRow)

Identical SVG path string duplicated in both files. A 4-line `DragHandle.tsx` component removes the duplication.

---

### 9. Extract shared time-segment formatter

**File:** `lib/workout.ts`

`fmtDuration` and `fmtTimer` both independently derive hours/minutes/seconds. A shared internal helper would give a single point of change if the formatting logic needs to evolve.
