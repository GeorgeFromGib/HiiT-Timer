# Spinning: Single Combined R/W Pill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the two separate spinning pills (R and W) in the current-phase block into one single pill showing `R 5 · 120 W`.

**Architecture:** Single JSX change in `WorkoutScreen.tsx` — replace the `spinRow` wrapper + two `spinPill` children with one `spinPill` containing all five text nodes. Remove the now-unused `spinRow` style from `makeStyles`.

**Tech Stack:** React Native, TypeScript, Expo SDK 56.

## Global Constraints

- Touch only `src/screens/WorkoutScreen.tsx`.
- No new styles or components — reuse existing `spinPill`, `spinPillLabel`, `spinPillValue`.
- Remove the `spinRow` style from `makeStyles` since it becomes unused.
- No tests infrastructure exists — verify manually in the simulator.

---

### Task 1: Combine spinning R and W into one pill

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx` (JSX block ~line 221–238; `makeStyles` `spinRow` style ~line 512–517)

**Interfaces:**
- Consumes: `seg.resistance: number | undefined`, `seg.power: number | undefined`, `phaseColor: string`, existing styles `spinPill`, `spinPillLabel`, `spinPillValue`
- Produces: single pill rendering `R {resistance} · {power} W` in the current-phase block

- [ ] **Step 1: Replace the spinRow + two spinPill block**

Find this block in `src/screens/WorkoutScreen.tsx` (around line 221):

```tsx
{seg.resistance !== undefined && !isDone && !isPreStart && (
  <View style={styles.spinRow}>
    <View style={[styles.spinPill, {
      backgroundColor: withOpacity(phaseColor, 0x21),
      borderColor:     withOpacity(phaseColor, 0x59),
    }]}>
      <Text style={[styles.spinPillLabel, { color: phaseColor }]}>R</Text>
      <Text style={[styles.spinPillValue, { color: phaseColor }]}>{seg.resistance}</Text>
    </View>
    <View style={[styles.spinPill, {
      backgroundColor: withOpacity(phaseColor, 0x21),
      borderColor:     withOpacity(phaseColor, 0x59),
    }]}>
      <Text style={[styles.spinPillValue, { color: phaseColor }]}>{seg.power}</Text>
      <Text style={[styles.spinPillLabel, { color: phaseColor }]}>W</Text>
    </View>
  </View>
)}
```

Replace it with:

```tsx
{seg.resistance !== undefined && !isDone && !isPreStart && (
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
)}
```

- [ ] **Step 2: Remove the unused `spinRow` style from `makeStyles`**

Find and delete this block in `makeStyles` (around line 512):

```ts
spinRow: {
  flexDirection: 'row',
  gap: 12,
  justifyContent: 'center',
},
```

- [ ] **Step 3: Verify in simulator**

Run:
```bash
npx expo start --ios
```

1. Open a spinning session and start it.
2. Confirm the current-phase block shows one pill: `R 5 · 120 W` (values match the session's spin settings).
3. Advance through phases — confirm values update for each phase (warmup, work, rest, cooldown).
4. Open a non-spinning session — confirm no visual change.

- [ ] **Step 4: Commit**

```bash
git add src/screens/WorkoutScreen.tsx
git commit -m "feat(spinning): combine resistance and power into one pill"
```
