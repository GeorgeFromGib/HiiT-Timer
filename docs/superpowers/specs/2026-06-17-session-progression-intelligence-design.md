# Session Progression Intelligence — Design

**Date:** 2026-06-17
**Status:** Approved

## Goal

Detect when a user has mastered a session (3 full completions since last level-up) and offer them a post-workout editor to increase difficulty — either saving the result as a new session or overwriting the current one.

## Decisions

| Question | Decision |
|---|---|
| Mastery threshold | 3 full completions since last progression action. Named constant `MASTERY_THRESHOLD = 3`. |
| Full completion | `onFinish` fires. Bailing mid-session records nothing. |
| History storage | New `history_v1.json` via expo-file-system, same pattern as `sessions_v2.json`. |
| Post-mastery flow | Two-step modal in WorkoutScreen: mastery notice → parameter editor. |
| Parameter selection | User independently toggles: rounds (+1/+2/+3), work time (+5s/+10s/+15s), rest time (−5s/−10s/−15s). Single-select per row. Confirm disabled until at least one is chosen. |
| Save modes | (1) New session: clone + apply adjustments, name = `"${original.name} +"`, save to list. (2) Update current: apply adjustments in-place, keep original name. Destructive — shows warning. |
| On confirm | Navigate to Sessions list. Do not auto-start the new/updated session. |
| Mastery clock reset | After either save mode, a progression event is recorded so the clock resets. |
| Rest time floor | 5s (matches existing EditSession validation). |
| Advanced mode extra round | Repeat last work+rest interval pair N times, inserted before trailing cooldown. |

## Architecture

### Data model (`history_v1.json`)

```ts
type CompletionRecord = {
  sessionId: string;
  completedAt: number; // Date.now()
};

type ProgressionEvent = {
  sessionId: string;
  actedAt: number; // Date.now() — written when user confirms either save mode
};

type HistoryFile = {
  completions: CompletionRecord[];
  progressions: ProgressionEvent[];
};
```

Mastery check: count completions with `completedAt > lastProgression.actedAt` for that `sessionId`. If no progression event exists, count all completions.

### Files

| Action | File | Responsibility |
|---|---|---|
| Create | `src/lib/history.ts` | Load/save history, pure helpers, async API |
| Modify | `src/lib/sessions.ts` | Add `ProgressionAdjustments` type + `applyProgressionAdjustments()` |
| Create | `src/components/ProgressionModal.tsx` | Two-step post-workout modal |
| Modify | `src/screens/WorkoutScreen.tsx` | Record completions on finish, show modal, handle confirm |

### `applyProgressionAdjustments`

```ts
type ProgressionAdjustments = {
  extraRounds?: number;     // +1 / +2 / +3
  workTimeDelta?: number;   // positive seconds e.g. +10
  restTimeDelta?: number;   // negative seconds e.g. -10
};

function applyProgressionAdjustments(
  session: Session,
  adj: ProgressionAdjustments,
  saveMode: 'new' | 'update'
): Session
// 'new'    → new uuid (via newId()), name = `${session.name} +`
// 'update' → preserves id and name
// Easy: adjusts config.rounds, config.high, config.low (floored at 5s)
// Advanced: adjusts dur on all type:'work' and type:'rest' intervals (floored at 5s);
//           inserts last work+rest pair N times before trailing cooldown for extraRounds
```

## Modal UI

**Step 1 — Mastery notice**
```
Session mastered
You have completed "[Name]" X times. Ready to level up?

[Not today]    [Let's go]
```

**Step 2 — Parameter editor**
```
Make it harder

Rounds      [+1]  [+2]  [+3]
Work time   [+5s] [+10s] [+15s]
Rest time   [-5s] [-10s] [-15s]

Save as:
(●) New session — "[Name] +"
( ) Update "[Name]"  ⚠ This will permanently change the session

[preview: e.g. "8 → 9 rounds, 20s → 30s work"]

[Cancel]    [Confirm]
```

- Confirm is disabled until at least one parameter chip is selected.
- Tapping a chip again deselects it.
- Preview updates live.

## Out of Scope

- Sessions-list badges or difficulty indicators
- Per-interval granular control in advanced mode (global adjustment only)
- Cross-device sync or cloud history
- Warmup/cooldown adjustments
- Undo after "Update current"
