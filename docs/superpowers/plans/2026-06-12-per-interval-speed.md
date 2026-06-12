# Per-Interval Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow each interval in advanced-mode run sessions to have its own optional speed, falling back to the session-level `RunSpeeds` when not set.

**Architecture:** Add `speed?: number` to the `Interval` type, update `getSessionSegments` to use it with a per-phase fallback, extend the hook with a new picker variant and clear action, and add a tappable speed value to each interval row in the edit screen.

**Tech Stack:** TypeScript, React Native, Expo SDK 56. No test runner configured — verify by running the app.

---

## Files touched

| File | Change |
|------|--------|
| `src/lib/workout.ts` | Add `speed?: number` to `Interval` |
| `src/lib/sessions.ts` | Export `speedForPhase`; update `getSessionSegments` for advanced run path |
| `src/hooks/useEditSession.ts` | New `ActivePicker`/`CommitResult` variants, picker title, `openIntervalSpeedPicker`, `clearIntervalSpeed` |
| `src/screens/EditSessionScreen.tsx` | Speed value in interval row; new props threaded through `IntervalSwipeRow` → `IntervalRow` |

---

## Task 1: Add `speed` to `Interval` type

**Files:**
- Modify: `src/lib/workout.ts:13-16`

- [ ] **Step 1: Update `Interval` interface**

In `src/lib/workout.ts`, replace:
```ts
export interface Interval {
  type: Phase;
  dur: number; // seconds
}
```
with:
```ts
export interface Interval {
  type: Phase;
  dur: number;    // seconds
  speed?: number; // km/h — run sessions only; overrides session-level RunSpeeds when set
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/workout.ts
git commit -m "feat: add optional speed field to Interval type"
```

---

## Task 2: Update `getSessionSegments` for per-interval speeds

**Files:**
- Modify: `src/lib/sessions.ts:29-37` (export `speedForPhase`)
- Modify: `src/lib/sessions.ts:39-47` (update `getSessionSegments`)

- [ ] **Step 1: Export `speedForPhase`**

In `src/lib/sessions.ts`, change `function speedForPhase` to `export function speedForPhase`:

```ts
export function speedForPhase(phase: Phase, speeds: RunSpeeds): number {
  const map: Record<Phase, number> = {
    warmup:   speeds.warmupSpeed,
    work:     speeds.workSpeed,
    rest:     speeds.restSpeed,
    cooldown: speeds.cooldownSpeed,
  };
  return map[phase];
}
```

- [ ] **Step 2: Update `getSessionSegments`**

Replace the current `getSessionSegments` function:

```ts
export function getSessionSegments(session: Session): Segment[] {
  const base = session.mode === 'advanced'
    ? intervalsToSegments(session.intervals)
    : expandWorkout(session.config);
  if (session.activityType === 'run' && session.runSpeeds) {
    return base.map(seg => ({ ...seg, speed: speedForPhase(seg.phase, session.runSpeeds!) }));
  }
  return base;
}
```

with:

```ts
export function getSessionSegments(session: Session): Segment[] {
  const base = session.mode === 'advanced'
    ? intervalsToSegments(session.intervals)
    : expandWorkout(session.config);
  if (session.activityType === 'run' && session.runSpeeds) {
    if (session.mode === 'advanced') {
      return base.map((seg, i) => ({
        ...seg,
        speed: session.intervals[i].speed ?? speedForPhase(seg.phase, session.runSpeeds!),
      }));
    }
    return base.map(seg => ({ ...seg, speed: speedForPhase(seg.phase, session.runSpeeds!) }));
  }
  return base;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/sessions.ts
git commit -m "feat: use per-interval speed with phase fallback in getSessionSegments"
```

---

## Task 3: Extend hook with interval speed picker

**Files:**
- Modify: `src/hooks/useEditSession.ts`

- [ ] **Step 1: Extend `ActivePicker` union**

Add a new variant to the `ActivePicker` type (after the `speed` variant):

```ts
type ActivePicker =
  | { type: 'field'; field: TimeField }
  | { type: 'interval'; key: string }
  | { type: 'rounds' }
  | { type: 'speed'; field: keyof RunSpeeds; isMiles: boolean }
  | { type: 'intervalSpeed'; key: string; isMiles: boolean };
```

- [ ] **Step 2: Extend `CommitResult` union**

Add a new variant to the `CommitResult` type:

```ts
type CommitResult =
  | { type: 'field';         field: TimeField;       secs: number }
  | { type: 'interval';      key: string;            secs: number }
  | { type: 'rounds';        value: number }
  | { type: 'speed';         field: keyof RunSpeeds; kmh: number }
  | { type: 'intervalSpeed'; key: string;            kmh: number };
```

- [ ] **Step 3: Add methods to `EditSessionInterface`**

Add two new methods to `EditSessionInterface` (after `openSpeedPicker`):

```ts
openIntervalSpeedPicker: (key: string, isMiles: boolean) => void;
clearIntervalSpeed:      (key: string) => void;
```

- [ ] **Step 4: Update `pickerTitle` in `usePickerState`**

Replace the existing `pickerTitle` IIFE:

```ts
const pickerTitle = (() => {
  if (!activePicker) return '';
  if (activePicker.type === 'rounds') return 'Rounds';
  if (activePicker.type === 'field')
    return activePicker.field.charAt(0).toUpperCase() + activePicker.field.slice(1);
  if (activePicker.type === 'speed') {
    const phase = activePicker.field.replace('Speed', '');
    return phase.charAt(0).toUpperCase() + phase.slice(1) + ' Speed';
  }
  if (activePicker.type === 'intervalSpeed') {
    const idx = intervals.findIndex(iv => iv._key === activePicker.key);
    return `Interval ${idx + 1} Speed`;
  }
  const idx = intervals.findIndex(iv => iv._key === activePicker.key);
  return `Interval ${idx + 1}`;
})();
```

- [ ] **Step 5: Add `openIntervalSpeedPicker` function inside `usePickerState`**

Add this function alongside the existing `openSpeedPicker` function:

```ts
function openIntervalSpeedPicker(key: string, displayValue: number, isMiles: boolean) {
  const whole = Math.floor(displayValue);
  const decimal = Math.min(9, Math.round((displayValue - whole) * 10));
  setSpeedWhole(whole);
  setSpeedDecimal(decimal);
  setActivePicker({ type: 'intervalSpeed', key, isMiles });
}
```

- [ ] **Step 6: Update `commitPicker` to handle `intervalSpeed`**

Inside the `commitPicker` function in `usePickerState`, add the `intervalSpeed` branch before the `else` block:

```ts
function commitPicker() {
  if (!activePicker) return;
  if (activePicker.type === 'rounds') {
    onCommit({ type: 'rounds', value: pickerRounds + 1 });
  } else if (activePicker.type === 'speed') {
    const displayVal = speedWhole + speedDecimal / 10;
    const kmh = activePicker.isMiles ? displayVal / 0.621371 : displayVal;
    onCommit({ type: 'speed', field: activePicker.field, kmh });
  } else if (activePicker.type === 'intervalSpeed') {
    const displayVal = speedWhole + speedDecimal / 10;
    const kmh = activePicker.isMiles ? displayVal / 0.621371 : displayVal;
    onCommit({ type: 'intervalSpeed', key: activePicker.key, kmh });
  } else {
    const secs = pickerMinutes * 60 + pickerSeconds;
    if (activePicker.type === 'field') {
      onCommit({ type: 'field', field: activePicker.field, secs });
    } else {
      onCommit({ type: 'interval', key: activePicker.key, secs });
    }
  }
  setActivePicker(null);
}
```

- [ ] **Step 7: Update `picker` construction to include `intervalSpeed` in `isSpeed`**

Replace the `picker` object construction:

```ts
const picker: EditSessionPicker | null = activePicker ? {
  title:        pickerTitle,
  isRounds:     activePicker.type === 'rounds',
  isSpeed:      activePicker.type === 'speed' || activePicker.type === 'intervalSpeed',
  speedUnit:    (activePicker.type === 'speed' || activePicker.type === 'intervalSpeed') && activePicker.isMiles ? 'miles' : 'km',
  minutes:      pickerMinutes,
  seconds:      pickerSeconds,
  rounds:       pickerRounds,
  speedWhole,
  speedDecimal,
} : null;
```

- [ ] **Step 8: Return `openIntervalSpeedPicker` from `usePickerState`**

Add `openIntervalSpeedPicker` to the return object of `usePickerState`:

```ts
return {
  picker,
  openFieldPicker,
  openRoundsPicker,
  openIntervalPicker,
  openSpeedPicker,
  openIntervalSpeedPicker,
  updatePicker: (partial: { minutes?: number; seconds?: number; rounds?: number; speedWhole?: number; speedDecimal?: number }) => {
    if (partial.minutes      !== undefined) setPickerMinutes(partial.minutes);
    if (partial.seconds      !== undefined) setPickerSeconds(partial.seconds);
    if (partial.rounds       !== undefined) setPickerRounds(partial.rounds);
    if (partial.speedWhole   !== undefined) setSpeedWhole(partial.speedWhole);
    if (partial.speedDecimal !== undefined) setSpeedDecimal(partial.speedDecimal);
  },
  commitPicker,
  dismissPicker: () => setActivePicker(null),
};
```

- [ ] **Step 9: Add `speedForPhase` to imports in `useEditSession.ts`**

Update the import from `sessions.ts`:

```ts
import { loadSessions, saveSessions, deleteSessionById, newId, getSessionSegments, speedForPhase, type Session, type RunSpeeds, DEFAULT_RUN_SPEEDS } from '../lib/sessions';
```

- [ ] **Step 10: Destructure `openIntervalSpeedPicker` from `usePickerState` and add `intervalSpeed` commit handler**

Update the `usePickerState` call and its destructuring:

```ts
const {
  picker,
  openFieldPicker,
  openRoundsPicker: openRoundsPickerInner,
  openIntervalPicker,
  openSpeedPicker,
  openIntervalSpeedPicker: openIntervalSpeedPickerInner,
  updatePicker,
  commitPicker,
  dismissPicker,
} = usePickerState(intervals, fieldValues, (result) => {
  if (result.type === 'rounds') {
    setRounds(result.value);
  } else if (result.type === 'field') {
    fieldSetters[result.field](result.secs);
  } else if (result.type === 'speed') {
    setRunSpeed(result.field, result.kmh);
  } else if (result.type === 'intervalSpeed') {
    setIntervals(ivs =>
      ivs.map(iv => iv._key === result.key ? { ...iv, speed: result.kmh } : iv)
    );
  } else {
    setIntervals(ivs =>
      ivs.map(iv => iv._key === result.key ? { ...iv, dur: result.secs } : iv)
    );
  }
});
```

- [ ] **Step 11: Add exported `openIntervalSpeedPicker` and `clearIntervalSpeed` in `useEditSession`**

Add these two functions after the existing `cyclePhase`/`addInterval` functions (they need access to `intervals` and `runSpeeds`):

```ts
function openIntervalSpeedPicker(key: string, isMiles: boolean) {
  const iv = intervals.find(i => i._key === key);
  if (!iv) return;
  const kmh = iv.speed ?? speedForPhase(iv.type, runSpeeds);
  const displayVal = isMiles ? kmh * 0.621371 : kmh;
  openIntervalSpeedPickerInner(key, displayVal, isMiles);
}

function clearIntervalSpeed(key: string) {
  setIntervals(ivs =>
    ivs.map(iv => iv._key === key ? { ...iv, speed: undefined } : iv)
  );
}
```

- [ ] **Step 12: Add the new functions to the return value of `useEditSession`**

```ts
return {
  draft,
  picker,
  setName,
  setActivityType,
  setRunSpeed,
  toggleMode,
  cyclePhase, addInterval, duplicateInterval, removeInterval,
  clearIntervals: () => setIntervals([]),
  reorderIntervals: setIntervals,
  openFieldPicker,
  openRoundsPicker: () => openRoundsPickerInner(rounds),
  openIntervalPicker,
  openSpeedPicker,
  openIntervalSpeedPicker,
  clearIntervalSpeed,
  updatePicker,
  commitPicker,
  dismissPicker,
  save,
  deleteSession,
};
```

- [ ] **Step 13: Commit**

```bash
git add src/hooks/useEditSession.ts
git commit -m "feat: add interval speed picker and clear action to useEditSession"
```

---

## Task 4: Add speed display to interval rows

**Files:**
- Modify: `src/screens/EditSessionScreen.tsx`

- [ ] **Step 1: Update imports**

Add `speedForPhase` to the import from sessions:

```ts
import { type Session, type RunSpeeds, speedForPhase } from '../lib/sessions';
```

- [ ] **Step 2: Destructure new methods from hook**

Update the `useEditSession` destructuring (add `openIntervalSpeedPicker` and `clearIntervalSpeed`):

```ts
const {
  draft, picker,
  setName,
  setActivityType,
  toggleMode,
  openFieldPicker, openRoundsPicker, openIntervalPicker, openSpeedPicker,
  openIntervalSpeedPicker, clearIntervalSpeed,
  cyclePhase, addInterval, duplicateInterval, removeInterval, clearIntervals, reorderIntervals,
  updatePicker, commitPicker, dismissPicker,
  save, deleteSession,
} = useEditSession(existing, onBack);
```

- [ ] **Step 3: Add `getIntervalDisplaySpeed` helper above the component**

Add this module-level helper before the `EditSessionScreen` component function:

```ts
function getIntervalDisplaySpeed(iv: LocalInterval, runSpeeds: RunSpeeds, isMiles: boolean): string {
  const kmh = iv.speed ?? speedForPhase(iv.type, runSpeeds);
  return isMiles ? (kmh * 0.621371).toFixed(1) : kmh.toFixed(1);
}
```

- [ ] **Step 4: Update `renderItem` to pass speed props**

Replace the `renderItem` lambda inside `NestableDraggableFlatList`:

```tsx
renderItem={({ item: iv, drag, isActive }: RenderItemParams<LocalInterval>) => (
  <IntervalSwipeRow
    interval={iv}
    T={T}
    styles={styles}
    isActive={isActive}
    drag={drag}
    onDuplicate={() => duplicateInterval(iv._key)}
    onRemove={() => removeInterval(iv._key)}
    onCyclePhase={() => cyclePhase(iv._key)}
    onOpenPicker={() => openIntervalPicker(iv._key)}
    displaySpeed={isRun ? getIntervalDisplaySpeed(iv, runSpeeds, isMiles) : undefined}
    onOpenSpeedPicker={isRun ? () => openIntervalSpeedPicker(iv._key, isMiles) : undefined}
    onClearSpeed={isRun ? () => clearIntervalSpeed(iv._key) : undefined}
  />
)}
```

- [ ] **Step 5: Update `IntervalRowProps` interface**

Replace the existing `IntervalRowProps` interface:

```ts
interface IntervalRowProps {
  interval:           Interval;
  T:                  ThemeTokens;
  styles:             ReturnType<typeof makeStyles>;
  isActive:           boolean;
  onCyclePhase:       () => void;
  onOpenPicker:       () => void;
  onDrag:             () => void;
  displaySpeed?:      string;
  onOpenSpeedPicker?: () => void;
  onClearSpeed?:      () => void;
}
```

- [ ] **Step 6: Update `IntervalRow` component to render speed**

Replace the `IntervalRow` function:

```tsx
function IntervalRow({
  interval, T, styles, isActive,
  onCyclePhase, onOpenPicker, onDrag,
  displaySpeed, onOpenSpeedPicker, onClearSpeed,
}: IntervalRowProps) {
  const phaseColor = T.phases[interval.type];
  return (
    <View style={[styles.intervalRow, isActive && styles.intervalRowActive]}>
      <Pressable onLongPress={onDrag} delayLongPress={150} style={styles.dragHandle} hitSlop={8}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01" stroke={T.subText} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>

      <Pressable onPress={onCyclePhase} style={[styles.phasePill, { backgroundColor: withOpacity(phaseColor, 0x22), borderColor: phaseColor }]}>
        <Text style={[styles.phasePillText, { color: phaseColor }]}>{PHASE_LABELS[interval.type]}</Text>
      </Pressable>

      {displaySpeed !== undefined && onOpenSpeedPicker && (
        <Pressable onPress={onOpenSpeedPicker} onLongPress={onClearSpeed} delayLongPress={500} hitSlop={8}>
          <Text style={[styles.intervalDurationText, { color: interval.speed != null ? T.text : T.subText }]}>
            {displaySpeed}
          </Text>
        </Pressable>
      )}

      <Pressable onPress={onOpenPicker} style={styles.intervalDuration}>
        <Text style={styles.intervalDurationText}>{fmtDuration(interval.dur)}</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 7: Update `IntervalSwipeRow` props interface and pass-through**

Replace the `IntervalSwipeRow` function signature and its `IntervalRow` call:

```tsx
function IntervalSwipeRow({
  interval, T, styles, isActive, drag,
  onDuplicate, onRemove, onCyclePhase, onOpenPicker,
  displaySpeed, onOpenSpeedPicker, onClearSpeed,
}: {
  interval:           LocalInterval;
  T:                  ThemeTokens;
  styles:             ReturnType<typeof makeStyles>;
  isActive:           boolean;
  drag:               () => void;
  onDuplicate:        () => void;
  onRemove:           () => void;
  onCyclePhase:       () => void;
  onOpenPicker:       () => void;
  displaySpeed?:      string;
  onOpenSpeedPicker?: () => void;
  onClearSpeed?:      () => void;
}) {
```

And update the `IntervalRow` usage inside `IntervalSwipeRow` to pass the new props:

```tsx
<IntervalRow
  interval={interval}
  T={T}
  styles={styles}
  isActive={isActive}
  onCyclePhase={onCyclePhase}
  onOpenPicker={onOpenPicker}
  onDrag={drag}
  displaySpeed={displaySpeed}
  onOpenSpeedPicker={onOpenSpeedPicker}
  onClearSpeed={onClearSpeed}
/>
```

- [ ] **Step 8: Start the app and verify**

Run `npx expo start --ios` (or `--android`).

Create or edit a Run session in Advanced mode:
1. Add a few intervals — each should show a speed value in `T.subText` color (fallback from SPEEDS grid)
2. Tap a speed value — the speed picker sheet should open titled `"Interval N Speed"`
3. Pick a custom speed and press Done — the speed value should update to `T.text` color
4. Long-press the custom speed — it should reset to `T.subText` (fallback)
5. Check a non-run session in advanced mode — no speed values should appear
6. Check easy mode run session — no speed values in interval list (SPEEDS grid still shown)

- [ ] **Step 9: Commit**

```bash
git add src/screens/EditSessionScreen.tsx
git commit -m "feat: show per-interval speed in advanced run interval rows"
```