# Confetti Toggle — Design Spec

**Date:** 2026-06-19

## Summary

Wire the existing `congratsMessage` setting to control the confetti animation on the session complete screen. Currently the setting exists but has no effect on confetti; particles always play unless the system Reduce Motion flag is on.

## Scope

Two files touched, no new settings, no i18n changes.

## Changes

### `src/screens/WorkoutScreen.tsx`

- Read `settings.congratsMessage` (already available via `useSettings`)
- Pass it as a new prop `showConfetti: boolean` to `SessionCompleteScreen`

### `src/screens/SessionCompleteScreen.tsx`

- Add `showConfetti: boolean` to the `Props` interface
- Change every confetti guard from `!reduceMotion` to `showConfetti && !reduceMotion`:
  - The confetti `useEffect` animation loop
  - The `confettiAnims.map(...)` render block

## Behaviour

| `congratsMessage` | System Reduce Motion | Confetti shown |
|---|---|---|
| on | off | yes |
| on | on | no |
| off | off | no |
| off | on | no |

The complete screen itself is unaffected — it always shows. Only the falling particles are gated.

## Out of scope

- Settings label / subtitle wording (unchanged)
- i18n files (no changes)
- `settings.ts` (no new field needed)