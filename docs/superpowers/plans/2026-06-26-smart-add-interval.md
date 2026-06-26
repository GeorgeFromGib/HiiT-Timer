# Smart Add Interval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When adding a new interval in advanced or circuit mode, let the user select the phase type first and automatically copy settings from the last interval of that type.

**Architecture:** Two focused changes — `addInterval` in the hook gains a typed `Phase` parameter and copy-from-previous logic; the screen gains a `showAddPhasePicker` boolean to toggle between the collapsed "Add Interval" button and an expanded inline pill row.

**Tech Stack:** React Native (Expo SDK 56), TypeScript (strict). No test framework — use `npx tsc --noEmit` for type correctness and manual runtime verification via `npx expo start --ios`.

## Global Constraints

- Only applies to circuit and advanced modes; easy mode is unchanged
- Circuit pill options: `work`, `rest` only
- Advanced pill options: `work`, `rest`, `warmup`, `cooldown`
- Copy logic applies to `dur` and `activityLabel` (activityLabel only for work intervals)
- If no prior interval of that type exists, default to `dur: 30`, no activityLabel
- Phase pill appearance uses existing `T.phases[phase]` colors — no new styles
- All TypeScript must compile with `npx tsc --noEmit` before commit

---

## File Map

| File | Change |
|---|---|
| `src/hooks/useEditSession.ts` | `addInterval(type: Phase)` — typed param + copy logic |
| `src/screens/EditSessionScreen.tsx` | `showAddPhasePicker` state + expanded pill row |

---

## Task 1: Update `addInterval` in `useEditSession`

**Files:**
- Modify: `src/hooks/useEditSession.ts`

**Interfaces:**
- Produces: `addInterval: (type: Phase) => void` — replaces the old zero-argument signature; `EditSessionInterface.addInterval` updated accordingly

- [ ] **Step 1: Update the `addInterval` function**

In `src/hooks/useEditSession.ts`, replace the existing `addInterval` function (around line 514):

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

- [ ] **Step 2: Update `EditSessionInterface` signature**

In the `EditSessionInterface` definition (around line 95), change:

```ts
addInterval:        () => void;
```

to:

```ts
addInterval:        (type: Phase) => void;
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: TypeScript will flag the two call-sites in `EditSessionScreen.tsx` that still call `addInterval()` with no argument. That's expected — they will be fixed in Task 2. All other errors must be zero. If there are non-callsite errors, fix them before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useEditSession.ts
git commit -m "feat(add-interval): typed phase param + copy-from-previous logic"
```

---

## Task 2: Inline phase picker in `EditSessionScreen`

**Files:**
- Modify: `src/screens/EditSessionScreen.tsx`

**Interfaces:**
- Consumes: `addInterval(type: Phase)` from `useEditSession`
- Produces: inline pill row expansion/collapse in both the circuit interval action bar and the advanced interval action bar

- [ ] **Step 1: Import `Phase` type**

At the top of `src/screens/EditSessionScreen.tsx`, add `Phase` to the import from `../lib/workout`:

```ts
import { fmtDuration, convertKmhToMph, type Phase } from '../lib/workout';
```

- [ ] **Step 2: Add `showAddPhasePicker` state**

Inside `EditSessionScreen`, after the existing destructuring of `draft`, add:

```ts
const [showAddPhasePicker, setShowAddPhasePicker] = React.useState(false);
```

- [ ] **Step 3: Define the phase options per mode**

After the `showAddPhasePicker` state declaration add:

```ts
const addPhaseOptions: Phase[] = isCircuit
  ? ['work', 'rest']
  : ['work', 'rest', 'warmup', 'cooldown'];
```

- [ ] **Step 4: Create a `renderAddIntervalBar` helper inside the component**

Add this just before the `return` statement of `EditSessionScreen`. It's a plain function (not a React component) called via `{renderAddIntervalBar()}` to avoid identity issues from defining components inside render:

```tsx
function renderAddIntervalBar() {
  if (showAddPhasePicker) {
    return (
      <View style={styles.intervalActions}>
        {addPhaseOptions.map(phase => {
          const phaseColor = T.phases[phase];
          return (
            <Pressable
              key={phase}
              style={[styles.phasePill, { backgroundColor: withOpacity(phaseColor, 0x22), borderColor: phaseColor, flex: 1 }]}
              onPress={() => {
                addInterval(phase);
                setShowAddPhasePicker(false);
              }}
            >
              <Text style={[styles.phasePillText, { color: phaseColor }]}>{t('phases.' + phase)}</Text>
            </Pressable>
          );
        })}
        <Pressable
          style={[styles.phasePill, { borderColor: T.hairline, flex: 0, paddingHorizontal: 14 }]}
          onPress={() => setShowAddPhasePicker(false)}
        >
          <Text style={[styles.phasePillText, { color: T.subText }]}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.intervalActions}>
      <Pressable onPress={() => setShowAddPhasePicker(true)} style={styles.addIntervalBtn}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke={T.accent} strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
        <Text style={[styles.addIntervalBtnText, { color: T.accent }]}>{t('edit.addInterval')}</Text>
      </Pressable>
      {intervals.length > 0 && (
        <Pressable onPress={clearIntervals} style={styles.clearIntervalsBtn}>
          <Text style={[styles.addIntervalBtnText, { color: T.subText }]}>{t('edit.clearAll')}</Text>
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 5: Replace the circuit interval action bar**

In the circuit branch (around line 302), replace:

```tsx
<View style={styles.intervalActions}>
  <Pressable onPress={addInterval} style={styles.addIntervalBtn}>
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={T.accent} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
    <Text style={[styles.addIntervalBtnText, { color: T.accent }]}>{t('edit.addInterval')}</Text>
  </Pressable>
  {intervals.length > 0 && (
    <Pressable onPress={clearIntervals} style={styles.clearIntervalsBtn}>
      <Text style={[styles.addIntervalBtnText, { color: T.subText }]}>{t('edit.clearAll')}</Text>
    </Pressable>
  )}
</View>
```

with:

```tsx
{renderAddIntervalBar()}
```

- [ ] **Step 6: Replace the advanced interval action bar**

In the advanced branch (around line 357), replace:

```tsx
<View style={styles.intervalActions}>
  <Pressable onPress={addInterval} style={styles.addIntervalBtn}>
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={T.accent} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
    <Text style={[styles.addIntervalBtnText, { color: T.accent }]}>{t('edit.addInterval')}</Text>
  </Pressable>
  {intervals.length > 0 && (
    <Pressable onPress={clearIntervals} style={styles.clearIntervalsBtn}>
      <Text style={[styles.addIntervalBtnText, { color: T.subText }]}>{t('edit.clearAll')}</Text>
    </Pressable>
  )}
</View>
```

with:

```tsx
{renderAddIntervalBar()}
```

- [ ] **Step 7: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Manual verification**

```bash
npx expo start --ios
```

Circuit mode checks:
1. Open any circuit session for editing (or create a new one via the Circuit button)
2. Tap "Add Interval" → pill row appears: `[WORK] [REST] [Cancel]`
3. Tap WORK → work interval added; pill row collapses back to "Add Interval" button
4. Add a second WORK interval → it copies `dur` and `activityLabel` from the first work interval
5. Tap "Add Interval" → tap REST → rest interval added with default 30 s (no prior rest)
6. Add another REST → it copies `dur` from the first rest interval
7. Tap "Add Interval" → tap Cancel → nothing added, row collapses

Advanced mode checks:
8. Open any advanced session for editing
9. Tap "Add Interval" → 4 pills: `[WORK] [REST] [WARMUP] [COOLDOWN] [Cancel]`
10. Tap WARMUP → warmup interval added; copies `dur` from last warmup (or 30 s if none)
11. Verify easy mode is completely unaffected (no pill row, no change to behavior)

- [ ] **Step 9: Commit**

```bash
git add src/screens/EditSessionScreen.tsx
git commit -m "feat(add-interval): inline phase picker with copy-from-previous"
```
