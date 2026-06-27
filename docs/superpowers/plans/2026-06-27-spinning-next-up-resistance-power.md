# Spinning: Next-Up Resistance & Power Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show `R{resistance} · {power}W` inline in the "Next up" row of WorkoutScreen when the next segment is a spinning interval.

**Architecture:** Single conditional `<Text>` node added to the existing `nextUpRow` JSX block in `WorkoutScreen.tsx`, mirroring how `nextSeg.speed` is shown for run sessions.

**Tech Stack:** React Native, TypeScript, Expo SDK 56.

## Global Constraints

- No new styles, components, or translation keys.
- Touch only `src/screens/WorkoutScreen.tsx`.
- No tests infrastructure exists — verify manually in the simulator.

---

### Task 1: Add resistance & power to the next-up row

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx:344-355` (the `nextSeg` conditional block inside `nextUpRow`)

**Interfaces:**
- Consumes: `nextSeg.resistance: number | undefined`, `nextSeg.power: number | undefined` (already on `Segment` from `src/lib/workout.ts`)
- Produces: visible `R5 · 120W` text in next-up row for spinning sessions

- [ ] **Step 1: Add the conditional text node**

In `src/screens/WorkoutScreen.tsx`, locate the `nextUpRow` block (around line 335). It currently ends with:

```tsx
{nextSeg.activityLabel !== undefined && (
  <Text style={[styles.nextPhase, { color: nextPhaseColor! }]}>
    {nextSeg.activityLabel}
  </Text>
)}
```

Add the following immediately after the `nextSeg.speed` block (and before the `nextSeg.activityLabel` block):

```tsx
{nextSeg.resistance !== undefined && (
  <Text style={[styles.nextPhase, { color: nextPhaseColor! }]}>
    {`R${nextSeg.resistance} · ${nextSeg.power}W`}
  </Text>
)}
```

The full `nextSeg` branch should look like:

```tsx
{nextSeg ? (
  <>
    <Text style={styles.nextLabel}>{t('workout.next')}</Text>
    <Text style={[styles.nextLabel, { marginHorizontal: 4 }]}>→</Text>
    <WorkoutIcon variant="phase" phase={nextSeg.phase} color={nextPhaseColor!} size={20} />
    <Text style={[styles.nextPhase, { color: nextPhaseColor!, marginLeft: 5 }]}>
      {t('workout.phase.' + nextSeg.phase)}
    </Text>
    {nextSeg.speed !== undefined && (
      <Text style={[styles.nextPhase, { color: nextPhaseColor! }]}>
        {formatSpeed(nextSeg.speed, settings.speedUnit)}
      </Text>
    )}
    {nextSeg.resistance !== undefined && (
      <Text style={[styles.nextPhase, { color: nextPhaseColor! }]}>
        {`R${nextSeg.resistance} · ${nextSeg.power}W`}
      </Text>
    )}
    {nextSeg.activityLabel !== undefined && (
      <Text style={[styles.nextPhase, { color: nextPhaseColor! }]}>
        {nextSeg.activityLabel}
      </Text>
    )}
  </>
) : (
  <Text style={[styles.nextPhase, { color: phaseColor }]}>{t('workout.finish')}</Text>
)}
```

- [ ] **Step 2: Verify in simulator**

Run:
```bash
npx expo start --ios
```

1. Open the default spinning session ("Spinning Intervals" or similar).
2. Start the workout — confirm the current phase shows its R/W pills.
3. Watch the "Next up" row — confirm it reads e.g. `NEXT → [icon] WORK  R5 · 120W`.
4. Advance through phases — confirm values update correctly for each upcoming phase (warmup, work, rest, cooldown).
5. Open a non-spinning session (run, general) — confirm the next-up row is unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/screens/WorkoutScreen.tsx
git commit -m "feat(spinning): show resistance and power in next-up row"
```
