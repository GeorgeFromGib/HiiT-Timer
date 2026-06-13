# Review Prompt — Design Spec

**Date:** 2026-06-13

## Overview

Automatically request an App Store / Play Store review after a user completes workouts, using an exponential backoff strategy. Maximum 3 prompts lifetime; after that, never ask again.

## Data Model

New file: `src/lib/reviewState.ts`

```typescript
interface ReviewState {
  promptsShown: number;          // 0–3; stop when this reaches 3
  totalWorkouts: number;         // lifetime completed workouts
  workoutsAtLastPrompt: number;  // snapshot of totalWorkouts when last prompt fired
}

const DEFAULT_REVIEW_STATE: ReviewState = {
  promptsShown: 0,
  totalWorkouts: 0,
  workoutsAtLastPrompt: 0,
};
```

Persisted to `review_state_v1.json` via `expo-file-system`, following the same pattern as `settings_v1.json`.

## Threshold Sequence

Workouts required since last prompt before the next ask:

| Prompt # | Workouts since last prompt | Ratio |
|----------|---------------------------|-------|
| 1st      | 5                         | —     |
| 2nd      | 12                        | 2.4×  |
| 3rd      | 29                        | 2.4×  |

```typescript
const REVIEW_THRESHOLDS = [5, 12, 29] as const;
```

`REVIEW_THRESHOLDS[promptsShown]` gives the gap required before the next ask.

## Core Logic

`checkAndRequestReview()` — called once per workout completion:

1. Load state, increment `totalWorkouts`, save immediately
2. If `promptsShown >= 3` → return (never ask again)
3. Compute `gap = totalWorkouts - workoutsAtLastPrompt`
4. If `gap < REVIEW_THRESHOLDS[promptsShown]` → return (threshold not met)
5. Call `requestReview()` from `expo-store-review`
6. Update state: `promptsShown + 1`, `workoutsAtLastPrompt = totalWorkouts`, save

## WorkoutScreen Integration

In `src/screens/WorkoutScreen.tsx`, add a `useEffect` that watches `status === 'finished'`:

- Fires `checkAndRequestReview()` after a **1500ms delay** so the congrats animation settles before the system overlay appears
- Cleans up the timeout on unmount

## Dependency

`expo-store-review` (install via `expo install expo-store-review`):
- Wraps StoreKit on iOS, in-app review API on Android
- Silently no-ops on unsupported devices
- Apple enforces a hard cap of 3 native prompts per 365 days — aligns exactly with this design's 3-prompt maximum

## Files Changed

| File | Change |
|------|--------|
| `src/lib/reviewState.ts` | New — ReviewState type, load/save, `checkAndRequestReview` |
| `src/screens/WorkoutScreen.tsx` | Add `useEffect` watching `status === 'finished'` |
| `package.json` / `package-lock.json` | Add `expo-store-review` |

## Out of Scope

- The existing "Rate the app" row in SettingsScreen is unchanged — it remains a manual fallback
- No UI changes — the system overlay is provided entirely by the OS
- No Android-specific behaviour differences — `expo-store-review` handles the abstraction