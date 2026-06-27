# Spinning: Show Resistance & Power in Next-Up Row

**Date:** 2026-06-27

## Problem

The workout screen's "Next up" row shows the upcoming phase name (and speed for run sessions), but omits resistance and power for spinning sessions. The rider has no advance warning of the upcoming effort level.

## Solution

Add inline text `R{resistance} · {power}W` to the next-up row when `nextSeg.resistance` is defined.

## Design

### Visual

```
NEXT → [icon] WORK  R5 · 120W
```

### Implementation

In `src/screens/WorkoutScreen.tsx`, inside the `nextUpRow` block, add one conditional `<Text>` node after the existing speed node:

```tsx
{nextSeg.resistance !== undefined && (
  <Text style={[styles.nextPhase, { color: nextPhaseColor! }]}>
    {`R${nextSeg.resistance} · ${nextSeg.power}W`}
  </Text>
)}
```

- Uses existing `nextPhase` style — no new styles needed.
- `resistance` and `power` are always set together on spinning segments, so checking `resistance !== undefined` is sufficient.

## Scope

Single file, single JSX block. No new components, styles, types, or translations required.
