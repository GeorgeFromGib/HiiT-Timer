# Finished State Design

**Date:** 2026-06-05  
**Feature:** Show a finished state on the workout screen when the interval session completes.

## Summary

When `state.status === 'finished'`, the phase center block transitions to an accent-colored "DONE" state instead of freezing on the last segment's appearance.

## Visual Design

The finished state mirrors the `isPreStart` pattern exactly, replacing the phase block contents:

| Element | Finished state |
|---|---|
| Icon badge | `FinishedIcon` (checkmark SVG), accent color (`T.accent`), same 52×52 badge |
| Phase label | `"DONE"` in `T.accent` |
| Countdown row | **Hidden** — no digits displayed |
| Interval counter | **Hidden** |
| Progress bar | **Hidden** |
| Next-up row | **Hidden** |
| Timeline bar | All segments at full opacity (completed), marker at far right |
| Controls | Reset enabled, skip disabled (unchanged from current `isDone` behaviour) |

## Component Changes

### New: `src/components/FinishedIcon.tsx`

A checkmark SVG icon with the same props interface as `ReadyIcon`:

```ts
interface Props { color: string; size?: number; }
```

Renders a simple tick/checkmark inside a 24×24 viewBox, stroke-based to match the existing icon style.

### Modified: `src/WorkoutScreen.tsx`

Add `isDone` branches parallel to the existing `isPreStart` branches in the phase block:

- Icon badge `backgroundColor` / `borderColor`: use `T.accent` when `isDone` (same hex-opacity pattern as `isPreStart`)
- Icon rendered: `<FinishedIcon color={T.accent} size={30} />` when `isDone`
- Phase label `color` / `textShadowColor`: `T.accent` when `isDone`
- Phase label text: `"DONE"` when `isDone`
- Countdown row: wrapped in `{!isDone && ...}` to hide entirely
- Interval counter: wrapped in `{!isDone && ...}`
- Progress bar: wrapped in `{!isDone && ...}`
- Next-up row: wrapped in `{!isDone && ...}`

No layout changes — the `flex: 1` phase block centres its visible children automatically.

## Constraints

- No new dependencies required.
- `FinishedIcon` follows the exact prop shape and stroke style of `ReadyIcon` for consistency.
- The timeline bar already handles `isDone` correctly (all segments at `currentIndex > i` opacity, marker position based on `chevronLeft` — which at finish will be at 100%).
