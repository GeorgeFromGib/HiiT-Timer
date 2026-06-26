# Smart Add Interval Design

**Date:** 2026-06-26
**Scope:** Advanced and Circuit session modes in `EditSessionScreen`

## Problem

Tapping "Add Interval" always inserts `{ type: 'work', dur: 30 }` — the user must then tap the phase pill to cycle the type, and manually set the duration. For circuit sessions, the activity label is also lost. This is repetitive when building sequences that repeat the same durations (e.g., 6× push-ups at 40 s, 6× rest at 20 s).

## Solution

Two changes working together:

1. **Copy-from-previous** — when a new interval is added, find the last existing interval of the same type and copy its `dur` (and `activityLabel` for circuit work phases). No defaults need to change; the logic is purely additive.

2. **Inline type picker** — tapping "Add Interval" expands an inline pill row so the user selects the phase type before the interval is inserted. Tapping any pill adds the interval (with copied settings) and collapses back to the button.

## Architecture

### Hook change: `addInterval(type: Phase)`

`addInterval` in `useEditSession` gains a `type` parameter and the copy logic:

```ts
function addInterval(type: Phase) {
  setTimingDirty(true);
  setActiveTimingPreset(null);
  const last = [...intervals].reverse().find(iv => iv.type === type);
  setIntervals(ivs => [...ivs, toLocal({
    type,
    dur:           last?.dur ?? 30,
    activityLabel: last?.activityLabel,
  })]);
}
```

The `EditSessionInterface` signature updates to `addInterval: (type: Phase) => void`.

### Screen change: inline pill row

`EditSessionScreen` adds one local state variable: `showAddPhasePicker: boolean` (default `false`).

The interval action bar renders conditionally:

**Collapsed** (normal):
```
[ + Add Interval ]        [ Clear All ]
```

**Expanded** (after tapping "Add Interval"):
```
[ WORK ]  [ REST ]  [ Cancel ]        [ Clear All ]
```

Circuit mode: pills are `work`, `rest`.
Advanced mode: pills are `work`, `rest`, `warmup`, `cooldown`.

Tapping a pill: calls `addInterval(phase)` → `setShowAddPhasePicker(false)`.
Tapping Cancel: `setShowAddPhasePicker(false)`.

The pill appearance reuses the existing `phasePill` / `phasePillText` style + `T.phases[phase]` color — no new styles required. The cancel pill uses `T.subText` / `T.hairline`.

## Files changed

| File | Change |
|---|---|
| `src/hooks/useEditSession.ts` | `addInterval(type: Phase)` — typed parameter + copy logic |
| `src/screens/EditSessionScreen.tsx` | `showAddPhasePicker` state + expanded pill row in both circuit and advanced interval action bars |

## Out of scope

- Easy mode is unaffected (it has no interval list).
- The phase pills reuse existing styles; no new i18n strings are needed.
- No change to `IntervalRow`, `IntervalSwipeRow`, or picker modals.

## Success criteria

1. In circuit mode: tapping "Add Interval" shows `[WORK] [REST] [Cancel]`. Tapping WORK adds a work interval with the same `dur` and `activityLabel` as the last work interval in the list (or 30 s / empty if none). Tapping REST copies the last rest interval's `dur`.
2. In advanced mode: same behavior with 4 phase options.
3. Tapping Cancel collapses without adding anything.
4. TypeScript compiles with no errors (`npx tsc --noEmit`).
