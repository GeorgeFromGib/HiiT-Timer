# Spinning Session Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a spinning activity type with per-phase resistance (1–10) and power (40–300W in 10W steps), mirroring the run type pattern across data model, edit screen (easy + advanced), and workout display.

**Architecture:** `SpinValues` holds phase-level defaults (resistance + power) and lives on the `Session`. `getSessionSegments` resolves them into `Segment` fields. In easy mode, phase grids let the user set per-phase resistance/power. In advanced mode, each interval card shows tappable resistance and power chips. The workout screen reads `seg.resistance` / `seg.power` and renders a conditional pill row.

**Tech Stack:** React Native (Expo SDK 56), TypeScript, expo-file-system for persistence.

## Global Constraints

- No tests or linter — verify by running `npx expo start --ios` and exercising the feature
- Resistance: integers 1–10 (picker reuses the rounds wheel)
- Power: 40–300W in 10W steps, 27 values (picker reuses the rounds wheel)
- All locale strings must be added to `en.ts`, `es.ts`, and `fr.ts`
- Follow existing code patterns exactly — no new abstractions

## File Map

| File | Change |
|------|--------|
| `src/lib/workout.ts` | Add `resistance?`, `power?` to `Interval` and `Segment` |
| `src/lib/sessions.ts` | Add `SpinValues`, `DEFAULT_SPIN_VALUES`, `spinValueForPhase`, extend `Session` union and `getSessionSegments`, add default session |
| `src/lib/sessionDraft.ts` | Extend `buildSessionFromDraft` to accept and persist `spinValues` |
| `src/hooks/usePickerState.ts` | Add resistance/power `ActivePicker` + `CommitResult` variants, opener functions, `isResistance`/`isPower` on `EditSessionPicker` |
| `src/hooks/useEditSession.ts` | Add `spinValues` state, `isSpinning` to draft, commit handlers, opener/clear functions, update `buildSavePayload` and `hasChanges` |
| `src/components/PickerModal.tsx` | Add `RESISTANCE_LABELS`, `POWER_LABELS`, `isResistance`/`isPower` render branches |
| `src/components/IntervalRow.tsx` | Add 6 new optional spinning props + render chips |
| `src/components/EditSession/IntervalSwipeRow.tsx` | Thread 6 new spinning props through to `IntervalRow` |
| `src/components/SessionCard.tsx` | Add `'spinning'` branch to type label |
| `src/screens/EditSessionScreen.tsx` | Add `isSpinning`, spinning easy mode grids, wire advanced mode chips, update editor title |
| `src/screens/SessionsListScreen.tsx` | Add Spinning to type menu |
| `src/screens/WorkoutScreen.tsx` | Add conditional resistance/power pill row |
| `src/navigation.ts` | Add `'spinning'` to `activityType` union |
| `src/locales/en.ts` | New locale keys |
| `src/locales/es.ts` | New locale keys |
| `src/locales/fr.ts` | New locale keys |

---

### Task 1: Data model — Interval, Segment, SpinValues, Session, getSessionSegments

**Files:**
- Modify: `src/lib/workout.ts`
- Modify: `src/lib/sessions.ts`

**Interfaces:**
- Produces: `SpinValues`, `DEFAULT_SPIN_VALUES`, `spinValueForPhase(phase, values): { resistance, power }`, extended `Session` union with `activityType?: 'run' | 'spinning'` and `spinValues?`, `Interval.resistance?`, `Interval.power?`, `Segment.resistance?`, `Segment.power?`

- [ ] **Step 1: Add resistance and power to Interval and Segment in workout.ts**

Replace the `Segment` interface (lines 3–13) and `Interval` interface (lines 15–20) in `src/lib/workout.ts`:

```ts
export interface Segment {
  phase: Phase;
  label: string;
  duration: number;
  startAt: number;
  endAt: number;
  index: number;
  speed?: number;       // km/h — run sessions only
  resistance?: number;  // 1–10 — spinning sessions only
  power?: number;       // W — spinning sessions only
  activityLabel?: string;
  circuitNumber?: number;
}

export interface Interval {
  type: Phase;
  dur: number;
  speed?: number;       // km/h — run sessions only; overrides session-level RunSpeeds
  resistance?: number;  // 1–10 — spinning sessions; overrides session-level SpinValues
  power?: number;       // W — spinning sessions; overrides session-level SpinValues
  activityLabel?: string;
}
```

- [ ] **Step 2: Add SpinValues, DEFAULT_SPIN_VALUES, and spinValueForPhase to sessions.ts**

Add after the `DEFAULT_RUN_SPEEDS` constant (after line 18) in `src/lib/sessions.ts`:

```ts
export interface SpinValues {
  warmupResistance:   number;
  warmupPower:        number;
  workResistance:     number;
  workPower:          number;
  restResistance:     number;
  restPower:          number;
  cooldownResistance: number;
  cooldownPower:      number;
}

export const DEFAULT_SPIN_VALUES: SpinValues = {
  warmupResistance:   3,  warmupPower:   100,
  workResistance:     7,  workPower:     200,
  restResistance:     3,  restPower:     100,
  cooldownResistance: 2,  cooldownPower: 80,
};

export function spinValueForPhase(phase: Phase, values: SpinValues): { resistance: number; power: number } {
  const map: Record<Phase, { resistance: number; power: number }> = {
    warmup:      { resistance: values.warmupResistance,   power: values.warmupPower   },
    work:        { resistance: values.workResistance,     power: values.workPower     },
    rest:        { resistance: values.restResistance,     power: values.restPower     },
    cooldown:    { resistance: values.cooldownResistance, power: values.cooldownPower },
    circuitRest: { resistance: values.restResistance,     power: values.restPower     },
  };
  return map[phase];
}
```

- [ ] **Step 3: Extend the Session union**

Replace lines 20–23 in `src/lib/sessions.ts`:

```ts
export type Session =
  | { id: string; name: string; activityType?: 'run' | 'spinning'; runSpeeds?: RunSpeeds; spinValues?: SpinValues; mode: 'easy'; config: WorkoutConfig }
  | { id: string; name: string; activityType?: 'run' | 'spinning'; runSpeeds?: RunSpeeds; spinValues?: SpinValues; mode: 'advanced'; intervals: Interval[] }
  | { id: string; name: string; mode: 'circuit'; intervals: Interval[]; circuits: number; warmup: number; cooldown: number; circuitRest: number };
```

- [ ] **Step 4: Extend getSessionSegments to resolve spinning values**

In `src/lib/sessions.ts`, inside `getSessionSegments`, add after the `if (session.activityType === 'run' && session.runSpeeds)` block:

```ts
  if (session.activityType === 'spinning') {
    const sv = session.spinValues ?? DEFAULT_SPIN_VALUES;
    if (session.mode === 'advanced') {
      return base.map((seg, i) => {
        const defaults = spinValueForPhase(seg.phase, sv);
        return {
          ...seg,
          resistance: session.intervals[i].resistance ?? defaults.resistance,
          power:      session.intervals[i].power      ?? defaults.power,
        };
      });
    }
    return base.map(seg => {
      const { resistance, power } = spinValueForPhase(seg.phase, sv);
      return { ...seg, resistance, power };
    });
  }
```

- [ ] **Step 5: Add default spinning session to getDefaultSessions**

In `src/lib/sessions.ts`, inside `getDefaultSessions`, add after the circuit entry:

```ts
    {
      id: 'default-spinning-1',
      name: i18n.t('defaultSessions.spinning1', { locale }),
      mode: 'easy',
      activityType: 'spinning',
      config: { warmup: 60, high: 30, low: 20, rounds: 6, cooldown: 60 },
      spinValues: DEFAULT_SPIN_VALUES,
    },
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If errors appear they will be in files that reference `Session` or `Interval` — fix each one before continuing.

- [ ] **Step 7: Commit**

```bash
git add src/lib/workout.ts src/lib/sessions.ts
git commit -m "feat(spinning): extend data model — SpinValues, spinning Session variant, resistance/power on Segment and Interval"
```

---

### Task 2: Locale keys, navigation, and type menu

**Files:**
- Modify: `src/locales/en.ts`
- Modify: `src/locales/es.ts`
- Modify: `src/locales/fr.ts`
- Modify: `src/navigation.ts`
- Modify: `src/screens/SessionsListScreen.tsx`

**Interfaces:**
- Produces: `t('edit.spinning')`, `t('edit.newSpinningTitle')`, `t('edit.spinResistance')`, `t('edit.spinPower')`, `t('picker.resistanceTitle')`, `t('picker.powerTitle')`, `t('defaultSessions.spinning1')`; `'spinning'` added to Route `activityType`

- [ ] **Step 1: Add locale keys to en.ts**

In `src/locales/en.ts`, under the `edit` section after the existing `circuit: 'Circuit'` line, add:

```ts
    spinning:         'Spinning',
    newSpinningTitle: 'New Spinning',
    spinResistance:   'Resistance',
    spinPower:        'Power (W)',
```

Under the `picker` section after `circuitsTitle`, add:

```ts
    resistanceTitle: 'Resistance',
    powerTitle:      'Power',
```

Under `defaultSessions` after `circuit1`, add:

```ts
    spinning1: 'Spinning Session',
```

- [ ] **Step 2: Add locale keys to es.ts**

In `src/locales/es.ts`, under `edit` after `circuit: 'Circuito'`, add:

```ts
    spinning:         'Spinning',
    newSpinningTitle: 'Nueva Sesión Spinning',
    spinResistance:   'Resistencia',
    spinPower:        'Potencia (W)',
```

Under `picker` after `circuitsTitle`, add:

```ts
    resistanceTitle: 'Resistencia',
    powerTitle:      'Potencia',
```

Under `defaultSessions` after `circuit1`, add:

```ts
    spinning1: 'Sesión de Spinning',
```

- [ ] **Step 3: Add locale keys to fr.ts**

In `src/locales/fr.ts`, under `edit` after `circuit: 'Circuit'`, add:

```ts
    spinning:         'Spinning',
    newSpinningTitle: 'Nouveau Spinning',
    spinResistance:   'Résistance',
    spinPower:        'Puissance (W)',
```

Under `picker` after `circuitsTitle`, add:

```ts
    resistanceTitle: 'Résistance',
    powerTitle:      'Puissance',
```

Under `defaultSessions` after `circuit1`, add:

```ts
    spinning1: 'Séance de Spinning',
```

- [ ] **Step 4: Extend navigation.ts**

In `src/navigation.ts` line 6, change:

```ts
  | { name: 'EditSession'; session?: Session; activityType?: 'general' | 'run' | 'circuit' }
```

to:

```ts
  | { name: 'EditSession'; session?: Session; activityType?: 'general' | 'run' | 'circuit' | 'spinning' }
```

- [ ] **Step 5: Add Spinning to the type menu in SessionsListScreen.tsx**

After the Circuit `Pressable` block (around line 143 in `src/screens/SessionsListScreen.tsx`), add:

```tsx
            <View style={styles.typeMenuSeparator} />
            <Pressable
              style={styles.typeMenuRow}
              onPress={() => { setShowTypeMenu(false); onNavigate({ name: 'EditSession', activityType: 'spinning' }); }}
            >
              <Text style={styles.typeMenuText}>{t('edit.spinning')}</Text>
            </Pressable>
```

- [ ] **Step 6: Commit**

```bash
git add src/locales/en.ts src/locales/es.ts src/locales/fr.ts src/navigation.ts src/screens/SessionsListScreen.tsx
git commit -m "feat(spinning): add locale keys, navigation type, and session type menu entry"
```

---

### Task 3: Picker state and PickerModal — resistance and power wheels

**Files:**
- Modify: `src/hooks/usePickerState.ts`
- Modify: `src/components/PickerModal.tsx`

**Interfaces:**
- Consumes: `SpinValues` from Task 1
- Produces: `openSpinResistancePicker(field: keyof SpinValues, currentValue: number)`, `openSpinPowerPicker(field: keyof SpinValues, currentValue: number)`, `openIntervalResistancePicker(key: string, currentValue: number)`, `openIntervalPowerPicker(key: string, currentValue: number)`; `EditSessionPicker.isResistance: boolean`, `EditSessionPicker.isPower: boolean`

- [ ] **Step 1: Add import and extend ActivePicker in usePickerState.ts**

Add `SpinValues` to the import at the top of `src/hooks/usePickerState.ts`:

```ts
import { type RunSpeeds, type SpinValues } from '../lib/sessions';
```

Add four new variants to `ActivePicker` (after `circuitCount`):

```ts
  | { type: 'spinResistance';    field: keyof SpinValues }
  | { type: 'spinPower';         field: keyof SpinValues }
  | { type: 'intervalResistance'; key: string }
  | { type: 'intervalPower';      key: string }
```

- [ ] **Step 2: Extend CommitResult**

Add four new variants to `CommitResult` (after `circuitCount`):

```ts
  | { type: 'spinResistance';    field: keyof SpinValues; value: number }
  | { type: 'spinPower';         field: keyof SpinValues; value: number }
  | { type: 'intervalResistance'; key: string;            value: number }
  | { type: 'intervalPower';      key: string;            value: number }
```

- [ ] **Step 3: Add isResistance and isPower to EditSessionPicker**

In the `EditSessionPicker` interface, add after `isSpeed`:

```ts
  isResistance: boolean;
  isPower:      boolean;
```

- [ ] **Step 4: Add opener functions**

Add these four functions inside `usePickerState`, after `openCircuitCountPicker`:

```ts
  function openSpinResistancePicker(field: keyof SpinValues, currentValue: number) {
    setPickerRounds(currentValue - 1); // index 0 = resistance 1
    setActivePicker({ type: 'spinResistance', field });
  }

  function openSpinPowerPicker(field: keyof SpinValues, currentValue: number) {
    setPickerRounds((currentValue - 40) / 10); // index 0 = 40W
    setActivePicker({ type: 'spinPower', field });
  }

  function openIntervalResistancePicker(key: string, currentValue: number) {
    setPickerRounds(currentValue - 1);
    setActivePicker({ type: 'intervalResistance', key });
  }

  function openIntervalPowerPicker(key: string, currentValue: number) {
    setPickerRounds((currentValue - 40) / 10);
    setActivePicker({ type: 'intervalPower', key });
  }
```

- [ ] **Step 5: Add title resolution for new types**

In the `pickerTitle` IIFE, add before the final fallback line (`const idx = intervals...`):

```ts
    if (activePicker.type === 'spinResistance' || activePicker.type === 'intervalResistance') return i18n.t('picker.resistanceTitle');
    if (activePicker.type === 'spinPower'      || activePicker.type === 'intervalPower')      return i18n.t('picker.powerTitle');
```

- [ ] **Step 6: Handle new types in commitPicker**

In `commitPicker`, add four new branches before the final `else` block:

```ts
    } else if (activePicker.type === 'spinResistance') {
      onCommit({ type: 'spinResistance', field: activePicker.field, value: values.rounds + 1 });
    } else if (activePicker.type === 'spinPower') {
      onCommit({ type: 'spinPower', field: activePicker.field, value: 40 + values.rounds * 10 });
    } else if (activePicker.type === 'intervalResistance') {
      onCommit({ type: 'intervalResistance', key: activePicker.key, value: values.rounds + 1 });
    } else if (activePicker.type === 'intervalPower') {
      onCommit({ type: 'intervalPower', key: activePicker.key, value: 40 + values.rounds * 10 });
```

- [ ] **Step 7: Add isResistance and isPower to the picker object**

In the `picker` constant near the bottom of `usePickerState`, add after `isSpeed`:

```ts
    isResistance: activePicker.type === 'spinResistance' || activePicker.type === 'intervalResistance',
    isPower:      activePicker.type === 'spinPower'      || activePicker.type === 'intervalPower',
```

- [ ] **Step 8: Return the four new openers**

Add to the `return` object at the bottom of `usePickerState`:

```ts
    openSpinResistancePicker,
    openSpinPowerPicker,
    openIntervalResistancePicker,
    openIntervalPowerPicker,
```

- [ ] **Step 9: Add label arrays and render branches to PickerModal.tsx**

Add after the existing label arrays near the top of `src/components/PickerModal.tsx`:

```ts
const RESISTANCE_LABELS = Array.from({ length: 10 }, (_, i) => String(i + 1));
const POWER_LABELS      = Array.from({ length: 27 }, (_, i) => String(40 + i * 10));
```

In the JSX, add two branches after the `picker?.isSpeed` branch and before the default time branch:

```tsx
          ) : picker?.isResistance ? (
            <>
              <View style={styles.pickerUnits}>
                <Text style={styles.pickerUnitLabel}>{t('picker.resistanceTitle')}</Text>
              </View>
              <View style={styles.pickerRow}>
                <WheelColumn
                  values={RESISTANCE_LABELS}
                  selected={local.rounds}
                  onChange={v => setLocal(prev => ({ ...prev, rounds: v }))}
                />
              </View>
            </>
          ) : picker?.isPower ? (
            <>
              <View style={styles.pickerUnits}>
                <Text style={styles.pickerUnitLabel}>W</Text>
              </View>
              <View style={styles.pickerRow}>
                <WheelColumn
                  values={POWER_LABELS}
                  selected={local.rounds}
                  onChange={v => setLocal(prev => ({ ...prev, rounds: v }))}
                />
              </View>
            </>
```

- [ ] **Step 10: Commit**

```bash
git add src/hooks/usePickerState.ts src/components/PickerModal.tsx
git commit -m "feat(spinning): add resistance and power picker types to usePickerState and PickerModal"
```

---

### Task 4: IntervalRow and IntervalSwipeRow — resistance and power chips

**Files:**
- Modify: `src/components/IntervalRow.tsx`
- Modify: `src/components/EditSession/IntervalSwipeRow.tsx`

**Interfaces:**
- Produces: `IntervalRowProps.displayResistance?: number`, `IntervalRowProps.onOpenResistancePicker?: () => void`, `IntervalRowProps.onClearResistance?: () => void`, `IntervalRowProps.displayPower?: number`, `IntervalRowProps.onOpenPowerPicker?: () => void`, `IntervalRowProps.onClearPower?: () => void`; same props forwarded by `IntervalSwipeRow`

- [ ] **Step 1: Add 6 new optional props to IntervalRowProps in IntervalRow.tsx**

```ts
export interface IntervalRowProps {
  interval:                Interval;
  isActive:                boolean;
  onCyclePhase:            () => void;
  onOpenPicker:            () => void;
  onDrag:                  () => void;
  displaySpeed?:           { value: string; unit: string };
  onOpenSpeedPicker?:      () => void;
  onClearSpeed?:           () => void;
  activityLabel?:          string;
  onLabelChange?:          (text: string) => void;
  displayResistance?:      number;
  onOpenResistancePicker?: () => void;
  onClearResistance?:      () => void;
  displayPower?:           number;
  onOpenPowerPicker?:      () => void;
  onClearPower?:           () => void;
}
```

- [ ] **Step 2: Destructure new props in the component function**

```ts
export default function IntervalRow({
  interval, isActive,
  onCyclePhase, onOpenPicker, onDrag,
  displaySpeed, onOpenSpeedPicker, onClearSpeed,
  activityLabel, onLabelChange,
  displayResistance, onOpenResistancePicker, onClearResistance,
  displayPower, onOpenPowerPicker, onClearPower,
}: IntervalRowProps) {
```

- [ ] **Step 3: Render resistance and power chips**

After the `displaySpeed` block and before the duration `Pressable`, add:

```tsx
      {displayResistance !== undefined && onOpenResistancePicker && (
        <Pressable
          onPress={onOpenResistancePicker}
          onLongPress={onClearResistance}
          delayLongPress={500}
          hitSlop={8}
          style={styles.spinChip}
        >
          <Text style={styles.intervalDurationText}>{displayResistance}</Text>
        </Pressable>
      )}

      {displayPower !== undefined && onOpenPowerPicker && (
        <Pressable
          onPress={onOpenPowerPicker}
          onLongPress={onClearPower}
          delayLongPress={500}
          hitSlop={8}
          style={styles.spinChip}
        >
          <Text style={styles.intervalDurationText}>
            {displayPower}<Text style={styles.spinChipUnit}>W</Text>
          </Text>
        </Pressable>
      )}
```

- [ ] **Step 4: Update the duration pressable flex condition**

The existing condition for `flex: 0` on the duration pressable:

```tsx
        style={[
          styles.intervalDuration,
          (displaySpeed !== undefined
            || (onLabelChange !== undefined && interval.type === 'work')
            || displayResistance !== undefined
          ) && { flex: 0 },
        ]}
```

- [ ] **Step 5: Add spinChip styles**

In `makeStyles`, add:

```ts
    spinChip: {
      alignItems: 'center',
    },
    spinChipUnit: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: T.subText,
    },
```

- [ ] **Step 6: Add 6 new optional props to IntervalSwipeRow.tsx**

Update the `Props` interface in `src/components/EditSession/IntervalSwipeRow.tsx`:

```ts
interface Props {
  interval:                LocalInterval;
  isActive:                boolean;
  drag:                    () => void;
  onDuplicate:             () => void;
  onRemove:                () => void;
  onCyclePhase:            () => void;
  onOpenPicker:            () => void;
  displaySpeed?:           { value: string; unit: string };
  onOpenSpeedPicker?:      () => void;
  onClearSpeed?:           () => void;
  activityLabel?:          string;
  onLabelChange?:          (text: string) => void;
  displayResistance?:      number;
  onOpenResistancePicker?: () => void;
  onClearResistance?:      () => void;
  displayPower?:           number;
  onOpenPowerPicker?:      () => void;
  onClearPower?:           () => void;
}
```

- [ ] **Step 7: Destructure and forward new props in IntervalSwipeRow**

Update the function signature and `IntervalRow` usage:

```ts
export default function IntervalSwipeRow({
  interval, isActive, drag,
  onDuplicate, onRemove, onCyclePhase, onOpenPicker,
  displaySpeed, onOpenSpeedPicker, onClearSpeed,
  activityLabel, onLabelChange,
  displayResistance, onOpenResistancePicker, onClearResistance,
  displayPower, onOpenPowerPicker, onClearPower,
}: Props) {
```

Pass them to `IntervalRow`:

```tsx
        <IntervalRow
          interval={interval}
          isActive={isActive}
          onCyclePhase={onCyclePhase}
          onOpenPicker={onOpenPicker}
          onDrag={drag}
          displaySpeed={displaySpeed}
          onOpenSpeedPicker={onOpenSpeedPicker}
          onClearSpeed={onClearSpeed}
          activityLabel={activityLabel}
          onLabelChange={onLabelChange}
          displayResistance={displayResistance}
          onOpenResistancePicker={onOpenResistancePicker}
          onClearResistance={onClearResistance}
          displayPower={displayPower}
          onOpenPowerPicker={onOpenPowerPicker}
          onClearPower={onClearPower}
        />
```

- [ ] **Step 8: Commit**

```bash
git add src/components/IntervalRow.tsx src/components/EditSession/IntervalSwipeRow.tsx
git commit -m "feat(spinning): add resistance and power chips to IntervalRow and IntervalSwipeRow"
```

---

### Task 5: useEditSession and sessionDraft — spinning state, pickers, save

**Files:**
- Modify: `src/hooks/useEditSession.ts`
- Modify: `src/lib/sessionDraft.ts`

**Interfaces:**
- Consumes: `SpinValues`, `DEFAULT_SPIN_VALUES`, `spinValueForPhase` from Task 1; `openSpinResistancePicker`, `openSpinPowerPicker`, `openIntervalResistancePicker`, `openIntervalPowerPicker` from Task 3
- Produces: `draft.spinValues: SpinValues`, `draft.isSpinning: boolean`; `openSpinResistancePicker(field: keyof SpinValues)`, `openSpinPowerPicker(field: keyof SpinValues)`, `openIntervalResistancePicker(key: string)`, `openIntervalPowerPicker(key: string)`, `clearIntervalResistance(key: string)`, `clearIntervalPower(key: string)`

- [ ] **Step 1: Update imports in useEditSession.ts**

```ts
import {
  getSessionSegments, speedForPhase, spinValueForPhase,
  type Session, type RunSpeeds, type SpinValues,
  DEFAULT_RUN_SPEEDS, DEFAULT_SPIN_VALUES, newId,
} from '../lib/sessions';
```

- [ ] **Step 2: Extend EditSessionDraft**

```ts
export interface EditSessionDraft {
  name:                string;
  isAdvanced:          boolean;
  isCircuit:           boolean;
  isSpinning:          boolean;
  fieldValues:         Record<TimeField, number>;
  rounds:              number;
  intervals:           LocalInterval[];
  previewSegments:     Segment[];
  previewTotal:        number;
  activityType:        'run' | 'spinning' | undefined;
  runSpeeds:           RunSpeeds;
  spinValues:          SpinValues;
  activeTimingPreset:  PresetLevel | null;
  activeSpeedPreset:   PresetLevel | null;
  hasChanges:          boolean;
  circuitWarmup:       number;
  circuitCooldown:     number;
  circuitRest:         number;
  circuitCount:        number;
}
```

- [ ] **Step 3: Extend EditSessionInterface**

Add to `EditSessionInterface`:

```ts
  openSpinResistancePicker:    (field: keyof SpinValues) => void;
  openSpinPowerPicker:         (field: keyof SpinValues) => void;
  openIntervalResistancePicker: (key: string) => void;
  openIntervalPowerPicker:     (key: string) => void;
  clearIntervalResistance:     (key: string) => void;
  clearIntervalPower:          (key: string) => void;
```

- [ ] **Step 4: Update useEditSession function signature**

```ts
export function useEditSession(
  existing: Session | undefined,
  onBack: () => void,
  initialActivityType?: 'general' | 'run' | 'circuit' | 'spinning',
): EditSessionInterface {
```

- [ ] **Step 5: Add spinValues state**

Replace the existing `activityType` state (around line 99):

```ts
  const [activityType] = useState<'run' | 'spinning' | undefined>(() => {
    if (existing && existing.mode !== 'circuit') return existing.activityType;
    if (!existing && initialActivityType === 'run') return 'run';
    if (!existing && initialActivityType === 'spinning') return 'spinning';
    return undefined;
  });
  const [spinValues, setSpinValues] = useState<SpinValues>(
    existing && existing.mode !== 'circuit' && existing.activityType === 'spinning'
      ? (existing.spinValues ?? DEFAULT_SPIN_VALUES)
      : DEFAULT_SPIN_VALUES
  );
```

After `runSpeedsDraft`, add:

```ts
  const spinValuesDraft = useDraft(
    existing && existing.mode !== 'circuit' && existing.activityType === 'spinning'
      ? (existing.spinValues ?? DEFAULT_SPIN_VALUES)
      : DEFAULT_SPIN_VALUES
  );
```

- [ ] **Step 6: Update previewSegments memo**

Update the draft session to include `spinValues`:

```ts
    const draft: Session = mode === 'easy'
      ? { id: '', name: '', mode: 'easy', config: easyEdit.easyConfig, activityType, runSpeeds, spinValues }
      : { id: '', name: '', mode: 'advanced', intervals: cleanIntervals, activityType, runSpeeds, spinValues };
```

Update the dependency array:

```ts
  }, [mode, easyEdit.fieldValues, easyEdit.rounds, intervals, activityType, runSpeeds, spinValues,
      circuitEdit.circuitWarmup, circuitEdit.circuitCooldown, circuitEdit.circuitCount, circuitEdit.circuitRest]);
```

- [ ] **Step 7: Add spinning commit handlers in the usePickerState onCommit callback**

After the `intervalSpeed` case and before the `circuitWarmup` case, add:

```ts
      } else if (result.type === 'spinResistance') {
        setSpinValues(prev => ({ ...prev, [result.field]: result.value }));
      } else if (result.type === 'spinPower') {
        setSpinValues(prev => ({ ...prev, [result.field]: result.value }));
      } else if (result.type === 'intervalResistance') {
        setIntervals(ivs =>
          ivs.map(iv => iv._key === result.key ? { ...iv, resistance: result.value } : iv)
        );
      } else if (result.type === 'intervalPower') {
        setIntervals(ivs =>
          ivs.map(iv => iv._key === result.key ? { ...iv, power: result.value } : iv)
        );
```

- [ ] **Step 8: Add opener and clear functions**

Add after `clearIntervalSpeed`:

```ts
  function openIntervalResistancePicker(key: string) {
    const iv = intervals.find(i => i._key === key);
    if (!iv) return;
    const current = iv.resistance ?? spinValueForPhase(iv.type, spinValues).resistance;
    pickerState.openIntervalResistancePicker(key, current);
  }

  function openIntervalPowerPicker(key: string) {
    const iv = intervals.find(i => i._key === key);
    if (!iv) return;
    const current = iv.power ?? spinValueForPhase(iv.type, spinValues).power;
    pickerState.openIntervalPowerPicker(key, current);
  }

  function clearIntervalResistance(key: string) {
    setIntervals(ivs =>
      ivs.map(iv => iv._key === key ? { ...iv, resistance: undefined } : iv)
    );
  }

  function clearIntervalPower(key: string) {
    setIntervals(ivs =>
      ivs.map(iv => iv._key === key ? { ...iv, power: undefined } : iv)
    );
  }
```

- [ ] **Step 9: Update hasChanges**

```ts
    return easyEdit.hasChanges
      || name !== initialName
      || intervalsDraft.isDirty(cleanIntervals)
      || activityType !== initialActivityTypeRef
      || runSpeedsDraft.isDirty(runSpeeds)
      || spinValuesDraft.isDirty(spinValues);
```

Update the dependency array:

```ts
  }, [
    mode, name, intervals, activityType, runSpeeds, spinValues,
    easyEdit.hasChanges, circuitEdit.hasChanges,
    initialName, initialActivityTypeRef,
  ]);
```

- [ ] **Step 10: Update the draft object**

```ts
  const draft: EditSessionDraft = {
    name,
    isAdvanced:  mode === 'advanced',
    isCircuit:   mode === 'circuit',
    isSpinning:  activityType === 'spinning',
    fieldValues: easyEdit.fieldValues,
    rounds:      easyEdit.rounds,
    intervals,
    previewSegments,
    previewTotal: totalDuration(previewSegments),
    activityType,
    runSpeeds,
    spinValues,
    activeTimingPreset,
    activeSpeedPreset,
    hasChanges,
    circuitWarmup:   circuitEdit.circuitWarmup,
    circuitCooldown: circuitEdit.circuitCooldown,
    circuitRest:     circuitEdit.circuitRest,
    circuitCount:    circuitEdit.circuitCount,
  };
```

- [ ] **Step 11: Add new openers to the return object**

```ts
    openSpinResistancePicker:    (field) => pickerState.openSpinResistancePicker(field, spinValues[field]),
    openSpinPowerPicker:         (field) => pickerState.openSpinPowerPicker(field, spinValues[field]),
    openIntervalResistancePicker,
    openIntervalPowerPicker,
    clearIntervalResistance,
    clearIntervalPower,
```

- [ ] **Step 12: Update buildSessionFromDraft in sessionDraft.ts**

Add `SpinValues` to the import at the top:

```ts
import { newId, type Session, type RunSpeeds, type SpinValues } from './sessions';
```

Update the function signature to accept `spinValues`:

```ts
export function buildSessionFromDraft(
  mode: 'easy' | 'advanced' | 'circuit',
  name: string,
  easyConfig: { warmup: number; high: number; low: number; rounds: number; cooldown: number },
  intervals: Interval[],
  activityType: 'run' | 'spinning' | undefined,
  runSpeeds: RunSpeeds,
  existingId: string | undefined,
  circuitData?: { warmup: number; cooldown: number; circuits: number; circuitRest: number },
  spinValues?: SpinValues,
): Session {
```

Replace the `speedProps` block:

```ts
  const activityProps =
    activityType === 'run'      ? { activityType: 'run'      as const, runSpeeds } :
    activityType === 'spinning' ? { activityType: 'spinning' as const, spinValues } :
    {};
```

Replace all uses of `speedProps` in the return statements with `activityProps`:

```ts
  if (mode === 'easy') {
    return { ...base, ...activityProps, mode: 'easy', config: easyConfig };
  }
  return { ...base, ...activityProps, mode: 'advanced', intervals };
```

- [ ] **Step 13: Update buildSavePayload call in useEditSession.ts**

```ts
    const session = buildSessionFromDraft(
      mode, name.trim(), easyEdit.easyConfig, cleanIntervals, activityType, runSpeeds, existing?.id,
      undefined, spinValues,
    );
```

- [ ] **Step 14: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 15: Commit**

```bash
git add src/hooks/useEditSession.ts src/lib/sessionDraft.ts
git commit -m "feat(spinning): add spinning state, picker openers, and save logic to useEditSession"
```

---

### Task 6: EditSessionScreen and SessionCard — spinning UI

**Files:**
- Modify: `src/screens/EditSessionScreen.tsx`
- Modify: `src/components/SessionCard.tsx`

**Interfaces:**
- Consumes: `draft.isSpinning`, `draft.spinValues`, `openSpinResistancePicker`, `openSpinPowerPicker`, `openIntervalResistancePicker`, `openIntervalPowerPicker`, `clearIntervalResistance`, `clearIntervalPower` from Task 5; locale keys from Task 2; `IntervalSwipeRow` spinning props from Task 4

- [ ] **Step 1: Add SpinValues and spinValueForPhase to the import in EditSessionScreen.tsx**

```ts
import {
  loadSessions, saveSessions,
  type Session, type RunSpeeds, type SpinValues,
  speedForPhase, spinValueForPhase,
} from '../lib/sessions';
```

- [ ] **Step 2: Destructure spinning props from the hook**

```ts
  const {
    draft, picker,
    setName,
    toggleMode,
    openFieldPicker, openRoundsPicker, openIntervalPicker, openSpeedPicker,
    openIntervalSpeedPicker, clearIntervalSpeed,
    openCircuitWarmupPicker, openCircuitCooldownPicker, openCircuitRestPicker, openCircuitsPicker,
    openSpinResistancePicker, openSpinPowerPicker,
    openIntervalResistancePicker, openIntervalPowerPicker,
    clearIntervalResistance, clearIntervalPower,
    cyclePhase, addInterval, duplicateInterval, removeInterval, clearIntervals, reorderIntervals,
    commitPicker, dismissPicker,
    applyDurationPreset, applySpeedPreset,
    setActivityLabel,
    buildSavePayload,
  } = useEditSession(existing, onBack, activityType);

  const {
    name, isAdvanced, isCircuit, isSpinning, fieldValues, rounds, intervals,
    previewSegments, previewTotal,
    activityType: draftActivityType, runSpeeds, spinValues,
    activeTimingPreset, activeSpeedPreset, hasChanges,
    circuitWarmup, circuitCooldown, circuitRest, circuitCount,
  } = draft;
  const isRun = draftActivityType === 'run';
```

- [ ] **Step 3: Update the editor title**

```ts
  const editorTitle = isEditing
    ? t('edit.editTitle')
    : isCircuit
      ? t('edit.newCircuitTitle')
      : isSpinning
        ? t('edit.newSpinningTitle')
        : t('edit.newTitle');
```

- [ ] **Step 4: Add spinning easy mode grids**

Inside the easy mode `else` branch, after the closing `</View>` of the timing config grid `fieldGroup`, add:

```tsx
              {isSpinning && (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('edit.spinResistance')}</Text>
                    <View style={styles.configGrid}>
                      {(['warmup', 'work', 'rest', 'cooldown'] as const).map(phase => {
                        const field = `${phase}Resistance` as keyof SpinValues;
                        return (
                          <View key={field} style={styles.configCell}>
                            <Text style={styles.configCellLabel}>{t('phases.' + phase)}</Text>
                            <Pressable style={styles.configInput} onPress={() => openSpinResistancePicker(field)}>
                              <Text style={styles.configInputText}>{spinValues[field]}</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('edit.spinPower')}</Text>
                    <View style={styles.configGrid}>
                      {(['warmup', 'work', 'rest', 'cooldown'] as const).map(phase => {
                        const field = `${phase}Power` as keyof SpinValues;
                        return (
                          <View key={field} style={styles.configCell}>
                            <Text style={styles.configCellLabel}>{t('phases.' + phase)}</Text>
                            <Pressable style={styles.configInput} onPress={() => openSpinPowerPicker(field)}>
                              <Text style={styles.configInputText}>
                                {spinValues[field]}<Text style={styles.speedUnitText}>W</Text>
                              </Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}
```

- [ ] **Step 5: Wire spinning chips in the advanced mode IntervalSwipeRow**

In the advanced mode `NestableDraggableFlatList` `renderItem`, add the spinning props to `IntervalSwipeRow`:

```tsx
                  <IntervalSwipeRow
                    interval={iv}
                    isActive={isActive}
                    drag={drag}
                    onDuplicate={() => duplicateInterval(iv._key)}
                    onRemove={() => removeInterval(iv._key)}
                    onCyclePhase={() => cyclePhase(iv._key)}
                    onOpenPicker={() => openIntervalPicker(iv._key)}
                    displaySpeed={isRun ? getIntervalDisplaySpeed(iv, runSpeeds, isMiles) : undefined}
                    onOpenSpeedPicker={isRun ? () => openIntervalSpeedPicker(iv._key, isMiles) : undefined}
                    onClearSpeed={isRun ? () => clearIntervalSpeed(iv._key) : undefined}
                    displayResistance={isSpinning ? (iv.resistance ?? spinValueForPhase(iv.type, spinValues).resistance) : undefined}
                    onOpenResistancePicker={isSpinning ? () => openIntervalResistancePicker(iv._key) : undefined}
                    onClearResistance={isSpinning ? () => clearIntervalResistance(iv._key) : undefined}
                    displayPower={isSpinning ? (iv.power ?? spinValueForPhase(iv.type, spinValues).power) : undefined}
                    onOpenPowerPicker={isSpinning ? () => openIntervalPowerPicker(iv._key) : undefined}
                    onClearPower={isSpinning ? () => clearIntervalPower(iv._key) : undefined}
                  />
```

- [ ] **Step 6: Update SessionCard to show Spinning label**

In `src/components/SessionCard.tsx`, update the type label line:

```tsx
          <Text style={styles.modeLabel}>
            {session.mode === 'circuit'
              ? t('edit.circuit')
              : session.activityType === 'run'
                ? t('edit.run')
                : session.activityType === 'spinning'
                  ? t('edit.spinning')
                  : t('edit.general')}
          </Text>
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/screens/EditSessionScreen.tsx src/components/SessionCard.tsx
git commit -m "feat(spinning): add spinning easy/advanced mode UI to EditSessionScreen and SessionCard"
```

---

### Task 7: WorkoutScreen — resistance and power display

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx`

**Interfaces:**
- Consumes: `seg.resistance?: number`, `seg.power?: number` from Task 1 (resolved by `getSessionSegments`)

- [ ] **Step 1: Add the resistance/power pill row**

In `src/screens/WorkoutScreen.tsx`, after the existing `{seg.speed !== undefined && !isDone && !isPreStart && (...)}` block (around line 210), add:

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

- [ ] **Step 2: Add styles**

In `makeStyles`, alongside the existing `speedPill` styles, add:

```ts
    spinRow: {
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'center',
    },
    spinPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
    },
    spinPillLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    spinPillValue: {
      fontFamily: 'ChakraPetch_700Bold',
      fontSize: 22,
    },
```

- [ ] **Step 3: Verify TypeScript compiles and run the app**

```bash
npx tsc --noEmit
npx expo start --ios
```

Manually verify all success criteria from the spec:
- Spinning session appears in session list with type label "Spinning"
- Tapping "+" → "Spinning" opens the editor titled "New Spinning"
- Easy mode shows timing grid + resistance grid + power grid; each cell opens the correct picker wheel
- Advanced mode interval cards show resistance and power chips; long-press clears to phase default
- Workout screen shows R / W pills during spinning segments; pills are absent for non-spinning sessions
- Session saves and reloads with correct `activityType: 'spinning'` and `spinValues`

- [ ] **Step 4: Commit**

```bash
git add src/screens/WorkoutScreen.tsx
git commit -m "feat(spinning): display resistance and power on workout screen"
```
