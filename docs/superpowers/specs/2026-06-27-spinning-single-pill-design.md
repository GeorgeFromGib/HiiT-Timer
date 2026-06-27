# Spinning: Combine R and W into One Pill

**Date:** 2026-06-27

## Problem

The current-phase block shows resistance and power as two separate pills (`R 5` | `120 W`), which uses more horizontal space than necessary and looks visually split.

## Solution

Collapse the two `spinPill` views into one, showing `R 5 · 120 W` in a single pill.

## Design

### Visual

```
[ R  5  ·  120  W ]
```

### Implementation

In `src/screens/WorkoutScreen.tsx`, replace the `spinRow` + two `spinPill` block:

**Before:**
```tsx
<View style={styles.spinRow}>
  <View style={[styles.spinPill, { ... }]}>
    <Text style={[styles.spinPillLabel, { color: phaseColor }]}>R</Text>
    <Text style={[styles.spinPillValue, { color: phaseColor }]}>{seg.resistance}</Text>
  </View>
  <View style={[styles.spinPill, { ... }]}>
    <Text style={[styles.spinPillValue, { color: phaseColor }]}>{seg.power}</Text>
    <Text style={[styles.spinPillLabel, { color: phaseColor }]}>W</Text>
  </View>
</View>
```

**After:**
```tsx
<View style={[styles.spinPill, {
  backgroundColor: withOpacity(phaseColor, 0x21),
  borderColor:     withOpacity(phaseColor, 0x59),
}]}>
  <Text style={[styles.spinPillLabel, { color: phaseColor }]}>R</Text>
  <Text style={[styles.spinPillValue, { color: phaseColor }]}>{seg.resistance}</Text>
  <Text style={[styles.spinPillLabel, { color: phaseColor }]}>·</Text>
  <Text style={[styles.spinPillValue, { color: phaseColor }]}>{seg.power}</Text>
  <Text style={[styles.spinPillLabel, { color: phaseColor }]}>W</Text>
</View>
```

- `spinRow` style and its wrapper `View` are removed (now unused).
- `spinPill` style already has `flexDirection: 'row'`, `gap: 4`, `paddingHorizontal: 14` — no style changes needed.
- The `·` separator uses `spinPillLabel` style for size/weight consistency.

## Scope

Single file (`src/screens/WorkoutScreen.tsx`), single JSX block. Remove the unused `spinRow` style from `makeStyles` too.
