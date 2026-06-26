# Circuit Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `circuit` session mode — a named-exercise interval sequence that repeats N times, with picker-based warmup/cooldown, no speeds, no easy-mode toggle.

**Architecture:** Extend the `Session` discriminated union with a `circuit` member. Add `expandCircuit()` to workout.ts. Branch on `session.mode === 'circuit'` in the hook, editor screen, and workout screen — no new screens required.

**Tech Stack:** React Native (Expo SDK 56), TypeScript (strict), expo-file-system for persistence. No test framework — use `npx tsc --noEmit` for type correctness and manual runtime verification.

## Global Constraints

- No speeds or run activity type on circuit sessions
- No easy/advanced mode toggle on circuit sessions
- Warmup and cooldown are duration-in-seconds fields on the session (not intervals); 0 = disabled
- `intervals[]` on a circuit session contains only `work` and `rest` typed intervals
- Phase cycling in circuit editor: only `work` ↔ `rest`
- Extend row (`+5s`, `+10s`, `+1 round`) never shown for circuit sessions
- No new screens — all changes are branches within existing screens
- All three locale files (en, es, fr) must stay in sync — TypeScript enforces this via `typeof en`

---

## Task 1: Extend types and add `expandCircuit` in `workout.ts`

**Files:**
- Modify: `src/lib/workout.ts`

**Interfaces:**
- Produces: `Interval.activityLabel?: string`, `Segment.activityLabel?: string`, `Segment.circuitNumber?: number`, `expandCircuit(intervals, circuits, warmup, cooldown): Segment[]`

- [ ] **Step 1: Add `activityLabel` to `Interval`**

In `src/lib/workout.ts`, update the `Interval` interface:

```ts
export interface Interval {
  type: Phase;
  dur: number;
  speed?: number;
  activityLabel?: string; // circuit work phases only
}
```

- [ ] **Step 2: Add `activityLabel` and `circuitNumber` to `Segment`**

```ts
export interface Segment {
  phase: Phase;
  label: string;
  duration: number;
  startAt: number;
  endAt: number;
  index: number;
  speed?: number;
  activityLabel?: string;
  circuitNumber?: number; // 1-indexed; undefined for warmup/cooldown segments
}
```

- [ ] **Step 3: Add `expandCircuit` function**

Add after `expandWorkout`:

```ts
export function expandCircuit(
  intervals: Interval[],
  circuits: number,
  warmup: number,
  cooldown: number,
): Segment[] {
  const raw: Array<Pick<Segment, 'phase' | 'label' | 'duration' | 'activityLabel' | 'circuitNumber'>> = [];

  if (warmup > 0) {
    raw.push({ phase: 'warmup', label: 'Warm Up', duration: warmup });
  }

  for (let c = 0; c < circuits; c++) {
    for (const iv of intervals) {
      raw.push({
        phase: iv.type,
        label: `Circuit ${c + 1}/${circuits}`,
        duration: iv.dur,
        activityLabel: iv.activityLabel,
        circuitNumber: c + 1,
      });
    }
  }

  if (cooldown > 0) {
    raw.push({ phase: 'cooldown', label: 'Cool Down', duration: cooldown });
  }

  let cursor = 0;
  return raw.map((s, i) => {
    const seg: Segment = { ...s, index: i, startAt: cursor, endAt: cursor + s.duration };
    cursor += s.duration;
    return seg;
  });
}
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workout.ts
git commit -m "feat(circuit): add activityLabel/circuitNumber types and expandCircuit()"
```

---

## Task 2: Extend `Session` union and `getSessionSegments` in `sessions.ts`

**Files:**
- Modify: `src/lib/sessions.ts`

**Interfaces:**
- Consumes: `expandCircuit` from `src/lib/workout.ts`
- Produces: `Session` union with `{ mode: 'circuit'; intervals: Interval[]; circuits: number; warmup: number; cooldown: number }` member; updated `getSessionSegments`; default circuit session in `getDefaultSessions`

- [ ] **Step 1: Add `expandCircuit` to the import from `workout.ts`**

Change the existing import line in `sessions.ts`:

```ts
import { expandWorkout, intervalsToSegments, expandCircuit } from './workout';
```

- [ ] **Step 2: Rewrite the `Session` type as a flat union**

Replace the existing `Session` type with:

```ts
export type Session =
  | { id: string; name: string; activityType?: 'run'; runSpeeds?: RunSpeeds; mode: 'easy'; config: WorkoutConfig }
  | { id: string; name: string; activityType?: 'run'; runSpeeds?: RunSpeeds; mode: 'advanced'; intervals: Interval[] }
  | { id: string; name: string; mode: 'circuit'; intervals: Interval[]; circuits: number; warmup: number; cooldown: number };
```

- [ ] **Step 3: Update `getSessionSegments` to handle circuit mode**

Replace the existing function body:

```ts
export function getSessionSegments(session: Session): Segment[] {
  if (session.mode === 'circuit') {
    return expandCircuit(session.intervals, session.circuits, session.warmup, session.cooldown);
  }
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

- [ ] **Step 4: Add default circuit session to `getDefaultSessions`**

Append to the returned array inside `getDefaultSessions`:

```ts
{
  id: 'default-circuit-1',
  name: i18n.t('defaultSessions.circuit1', { locale }),
  mode: 'circuit',
  circuits: 3,
  warmup: 60,
  cooldown: 60,
  intervals: [
    { type: 'work', dur: 40, activityLabel: 'Push-ups' },
    { type: 'rest', dur: 20 },
    { type: 'work', dur: 40, activityLabel: 'Squats' },
    { type: 'rest', dur: 20 },
    { type: 'work', dur: 40, activityLabel: 'Plank' },
    { type: 'rest', dur: 20 },
  ],
},
```

- [ ] **Step 5: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors. If TypeScript flags callers of `getSessionSegments` or `Session` — fix type exhaustiveness in those callers now (most are simple `session.mode === 'easy'` guards that just need a `circuit` branch added or treated as a fallthrough).

- [ ] **Step 6: Commit**

```bash
git add src/lib/sessions.ts
git commit -m "feat(circuit): extend Session union and getSessionSegments for circuit mode"
```

---

## Task 3: Update `sessionDraft.ts` for circuit mode

**Files:**
- Modify: `src/lib/sessionDraft.ts`

**Interfaces:**
- Consumes: `newId`, `Session`, `RunSpeeds`, `Interval` (already imported)
- Produces: `serializeDraft` and `buildSessionFromDraft` accepting `'circuit'` mode; `validateDraft` accepting circuit validation

- [ ] **Step 1: Update `serializeDraft` signature and body**

```ts
export function serializeDraft(
  name: string,
  mode: 'easy' | 'advanced' | 'circuit',
  warmup: number, work: number, rest: number, cooldown: number, rounds: number,
  intervals: Array<Omit<Interval, never>>,
  activityType: 'run' | undefined,
  runSpeeds: RunSpeeds,
  circuitData?: { warmup: number; cooldown: number; circuits: number },
): string {
  return JSON.stringify({ name, mode, warmup, work, rest, cooldown, rounds, intervals, activityType, runSpeeds, circuitData });
}
```

- [ ] **Step 2: Update `buildSessionFromDraft` to handle circuit mode**

```ts
export function buildSessionFromDraft(
  mode: 'easy' | 'advanced' | 'circuit',
  name: string,
  easyConfig: { warmup: number; high: number; low: number; rounds: number; cooldown: number },
  intervals: Interval[],
  activityType: 'run' | undefined,
  runSpeeds: RunSpeeds,
  existingId: string | undefined,
  circuitData?: { warmup: number; cooldown: number; circuits: number },
): Session {
  const base = { id: existingId ?? newId(), name };
  if (mode === 'circuit') {
    return {
      ...base,
      mode: 'circuit',
      intervals,
      circuits: circuitData!.circuits,
      warmup: circuitData!.warmup,
      cooldown: circuitData!.cooldown,
    };
  }
  const speedProps = activityType === 'run'
    ? { activityType: 'run' as const, runSpeeds }
    : {};
  if (mode === 'easy') {
    return { ...base, ...speedProps, mode: 'easy', config: easyConfig };
  }
  return { ...base, ...speedProps, mode: 'advanced', intervals };
}
```

- [ ] **Step 3: Update `validateDraft` to handle circuit validation**

```ts
export function validateDraft(
  name: string,
  mode: 'easy' | 'advanced' | 'circuit',
  intervals: { length: number },
  hasWorkInterval = true,
): { ok: true } | { ok: false; titleKey: string; messageKey: string } {
  if (!name.trim()) {
    return { ok: false, titleKey: 'alerts.nameRequiredTitle', messageKey: 'alerts.nameRequiredMessage' };
  }
  if (mode === 'advanced' && intervals.length === 0) {
    return { ok: false, titleKey: 'alerts.noIntervalsTitle', messageKey: 'alerts.noIntervalsMessage' };
  }
  if (mode === 'circuit' && !hasWorkInterval) {
    return { ok: false, titleKey: 'alerts.noWorkIntervalsTitle', messageKey: 'alerts.noWorkIntervalsMessage' };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sessionDraft.ts
git commit -m "feat(circuit): update sessionDraft helpers for circuit mode"
```

---

## Task 4: Add i18n strings for circuit UI

**Files:**
- Modify: `src/locales/en.ts`
- Modify: `src/locales/es.ts`
- Modify: `src/locales/fr.ts`

**Interfaces:**
- Produces: new keys under `workout`, `edit`, `picker`, `alerts`, `defaultSessions` in all three locales

- [ ] **Step 1: Add new keys to `en.ts`**

In `workout`, add:
```ts
circuit: 'CIRCUIT',
```

In `edit`, add:
```ts
circuits: 'Circuits',
circuitWarmup: 'Warmup',
circuitCooldown: 'Cooldown',
exercisePlaceholder: 'Exercise name',
newCircuitTitle: 'New Circuit',
```

In `picker`, add:
```ts
circuitsTitle: 'Circuits',
```

In `alerts`, add:
```ts
noWorkIntervalsTitle: 'No work intervals',
noWorkIntervalsMessage: 'Add at least one work interval.',
```

In `defaultSessions`, add:
```ts
circuit1: 'Body Weight Circuit',
```

- [ ] **Step 2: Add matching keys to `es.ts`**

In `workout`, add:
```ts
circuit: 'CIRCUITO',
```

In `edit`, add:
```ts
circuits: 'Circuitos',
circuitWarmup: 'Calentamiento',
circuitCooldown: 'Enfriamiento',
exercisePlaceholder: 'Nombre del ejercicio',
newCircuitTitle: 'Nuevo Circuito',
```

In `picker`, add:
```ts
circuitsTitle: 'Circuitos',
```

In `alerts`, add:
```ts
noWorkIntervalsTitle: 'Sin intervalos de trabajo',
noWorkIntervalsMessage: 'Añade al menos un intervalo de trabajo.',
```

In `defaultSessions`, add:
```ts
circuit1: 'Circuito de Peso Corporal',
```

- [ ] **Step 3: Add matching keys to `fr.ts`**

In `workout`, add:
```ts
circuit: 'CIRCUIT',
```

In `edit`, add:
```ts
circuits: 'Circuits',
circuitWarmup: 'Échauffement',
circuitCooldown: 'Récupération',
exercisePlaceholder: 'Nom de l\'exercice',
newCircuitTitle: 'Nouveau Circuit',
```

In `picker`, add:
```ts
circuitsTitle: 'Circuits',
```

In `alerts`, add:
```ts
noWorkIntervalsTitle: 'Aucun intervalle de travail',
noWorkIntervalsMessage: 'Ajoutez au moins un intervalle de travail.',
```

In `defaultSessions`, add:
```ts
circuit1: 'Circuit Poids du Corps',
```

- [ ] **Step 4: Verify compilation** (TypeScript will catch missing keys since es/fr are typed as `typeof en`)

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/locales/en.ts src/locales/es.ts src/locales/fr.ts
git commit -m "feat(circuit): add i18n strings for circuit session UI"
```

---

## Task 5: Add label input support to `IntervalRow`

**Files:**
- Modify: `src/components/IntervalRow.tsx`

**Interfaces:**
- Produces: `IntervalRowProps.activityLabel?: string`, `IntervalRowProps.onLabelChange?: (text: string) => void`; renders `TextInput` inline when both are provided and `interval.type === 'work'`

- [ ] **Step 1: Add `TextInput` import and new props**

At the top of `IntervalRow.tsx`, add `TextInput` to the React Native import:

```ts
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
```

Extend `IntervalRowProps`:

```ts
export interface IntervalRowProps {
  interval:           Interval;
  isActive:           boolean;
  onCyclePhase:       () => void;
  onOpenPicker:       () => void;
  onDrag:             () => void;
  displaySpeed?:      { value: string; unit: string };
  onOpenSpeedPicker?: () => void;
  onClearSpeed?:      () => void;
  activityLabel?:     string;
  onLabelChange?:     (text: string) => void;
}
```

- [ ] **Step 2: Render the label `TextInput` in the row**

In the component body, add `activityLabel` and `onLabelChange` to the destructured props, then add the TextInput between the phase pill and the duration pressable:

```ts
export default function IntervalRow({
  interval, isActive,
  onCyclePhase, onOpenPicker, onDrag,
  displaySpeed, onOpenSpeedPicker, onClearSpeed,
  activityLabel, onLabelChange,
}: IntervalRowProps) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(T);
  const phaseColor = T.phases[interval.type];

  return (
    <View style={[styles.intervalRow, isActive && styles.intervalRowActive]}>
      <Pressable onLongPress={onDrag} delayLongPress={150} style={styles.dragHandle} hitSlop={8}>
        <DragHandle color={T.subText} />
      </Pressable>

      <Pressable onPress={onCyclePhase} style={[styles.phasePill, { backgroundColor: withOpacity(phaseColor, 0x22), borderColor: phaseColor }]}>
        <Text style={[styles.phasePillText, { color: phaseColor }]}>{t('phases.' + interval.type)}</Text>
      </Pressable>

      {onLabelChange !== undefined && interval.type === 'work' && (
        <TextInput
          style={[styles.labelInput, { color: T.text, borderColor: T.hairline }]}
          value={activityLabel ?? ''}
          onChangeText={onLabelChange}
          placeholder={t('edit.exercisePlaceholder')}
          placeholderTextColor={T.faintText}
          returnKeyType="done"
        />
      )}

      {displaySpeed !== undefined && onOpenSpeedPicker && (
        <Pressable onPress={onOpenSpeedPicker} onLongPress={onClearSpeed} delayLongPress={500} hitSlop={8} style={styles.intervalSpeed}>
          <Text style={styles.intervalDurationText}>
            {displaySpeed.value}
            <Text style={styles.intervalSpeedUnit}>{' '}{displaySpeed.unit}</Text>
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={onOpenPicker}
        style={[
          styles.intervalDuration,
          (displaySpeed !== undefined || (onLabelChange !== undefined && interval.type === 'work')) && { flex: 0 },
        ]}
      >
        <Text style={styles.intervalDurationText}>{fmtDuration(interval.dur)}</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: Add `labelInput` style**

Inside `makeStyles`, add:

```ts
labelInput: {
  flex: 1,
  fontFamily: 'Inter_600SemiBold',
  fontSize: 13,
  borderWidth: 1,
  borderRadius: 8,
  paddingHorizontal: 8,
  paddingVertical: 4,
  backgroundColor: 'transparent',
},
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/IntervalRow.tsx
git commit -m "feat(circuit): add activityLabel TextInput support to IntervalRow"
```

---

## Task 6: Update `useEditSession` hook for circuit mode

**Files:**
- Modify: `src/hooks/useEditSession.ts`

**Interfaces:**
- Consumes: `expandCircuit` from `src/lib/workout.ts`; `newId` from `src/lib/sessions.ts`
- Produces: `EditSessionDraft.isCircuit`, `EditSessionDraft.circuitWarmup`, `EditSessionDraft.circuitCooldown`, `EditSessionDraft.circuitCount`; `EditSessionInterface.setActivityLabel`, `openCircuitWarmupPicker`, `openCircuitCooldownPicker`, `openCircuitsPicker`; `useEditSession(existing, onBack, newMode?)`

- [ ] **Step 1: Extend imports**

Add `expandCircuit` to the workout import, and `newId` to the sessions import:

```ts
import {
  totalDuration, tryConvertToEasy, buildIntervalsFromEasy, convertKmhToMph, convertMphToKmh,
  expandCircuit,
  type Interval, type Phase, type Segment,
} from '../lib/workout';

import { getSessionSegments, speedForPhase, type Session, type RunSpeeds, DEFAULT_RUN_SPEEDS, newId } from '../lib/sessions';
```

- [ ] **Step 2: Add `CIRCUIT_PHASES` constant**

Below the existing `const PHASES: Phase[] = ['warmup', 'work', 'rest', 'cooldown'];` line:

```ts
const CIRCUIT_PHASES: Phase[] = ['work', 'rest'];
```

- [ ] **Step 3: Extend `ActivePicker` and `CommitResult` types**

```ts
type ActivePicker =
  | { type: 'field'; field: TimeField }
  | { type: 'interval'; key: string }
  | { type: 'rounds' }
  | { type: 'speed'; field: keyof RunSpeeds; isMiles: boolean }
  | { type: 'intervalSpeed'; key: string; isMiles: boolean }
  | { type: 'circuitWarmup' }
  | { type: 'circuitCooldown' }
  | { type: 'circuitCount' };

type CommitResult =
  | { type: 'field';          field: TimeField;       secs: number }
  | { type: 'interval';       key: string;            secs: number }
  | { type: 'rounds';         value: number }
  | { type: 'speed';          field: keyof RunSpeeds; kmh: number }
  | { type: 'intervalSpeed';  key: string;            kmh: number }
  | { type: 'circuitWarmup';  secs: number }
  | { type: 'circuitCooldown'; secs: number }
  | { type: 'circuitCount';   value: number };
```

- [ ] **Step 4: Extend `EditSessionDraft` interface**

```ts
export interface EditSessionDraft {
  name:                string;
  isAdvanced:          boolean;
  isCircuit:           boolean;
  fieldValues:         Record<TimeField, number>;
  rounds:              number;
  intervals:           LocalInterval[];
  previewSegments:     Segment[];
  previewTotal:        number;
  activityType:        'run' | undefined;
  runSpeeds:           RunSpeeds;
  activeTimingPreset:  PresetLevel | null;
  activeSpeedPreset:   PresetLevel | null;
  hasChanges:          boolean;
  circuitWarmup:       number;
  circuitCooldown:     number;
  circuitCount:        number;
}
```

- [ ] **Step 5: Extend `EditSessionInterface`**

Add to `EditSessionInterface`:

```ts
setActivityLabel:         (key: string, label: string) => void;
openCircuitWarmupPicker:  () => void;
openCircuitCooldownPicker: () => void;
openCircuitsPicker:       () => void;
```

- [ ] **Step 6: Update `usePickerState` signature and add circuit openers**

Change the function signature:

```ts
function usePickerState(
  intervals:     LocalInterval[],
  fieldValues:   Record<TimeField, number>,
  circuitValues: { warmup: number; cooldown: number; count: number },
  onCommit:      (result: CommitResult) => void,
) {
```

Add circuit opener functions (inside `usePickerState`, after the existing openers):

```ts
function openCircuitWarmupPicker() {
  setPickerMinutes(Math.floor(circuitValues.warmup / 60));
  setPickerSeconds(circuitValues.warmup % 60);
  setActivePicker({ type: 'circuitWarmup' });
}

function openCircuitCooldownPicker() {
  setPickerMinutes(Math.floor(circuitValues.cooldown / 60));
  setPickerSeconds(circuitValues.cooldown % 60);
  setActivePicker({ type: 'circuitCooldown' });
}

function openCircuitCountPicker() {
  setPickerRounds(circuitValues.count - 1);
  setActivePicker({ type: 'circuitCount' });
}
```

Update `pickerTitle` to handle circuit types (add before the existing `field` branch):

```ts
if (activePicker.type === 'circuitCount') return i18n.t('picker.circuitsTitle');
if (activePicker.type === 'circuitWarmup') return i18n.t('phases.warmup');
if (activePicker.type === 'circuitCooldown') return i18n.t('phases.cooldown');
```

Update `commitPicker` to handle circuit types (add before the final `else`):

```ts
} else if (activePicker.type === 'circuitCount') {
  onCommit({ type: 'circuitCount', value: pickerRounds + 1 });
} else if (activePicker.type === 'circuitWarmup') {
  onCommit({ type: 'circuitWarmup', secs: pickerMinutes * 60 + pickerSeconds });
} else if (activePicker.type === 'circuitCooldown') {
  onCommit({ type: 'circuitCooldown', secs: pickerMinutes * 60 + pickerSeconds });
```

Update `picker` object — extend `isRounds` to include `circuitCount`:

```ts
isRounds: activePicker.type === 'rounds' || activePicker.type === 'circuitCount',
```

Add the new openers to the return value of `usePickerState`:

```ts
return {
  picker,
  openFieldPicker,
  openRoundsPicker,
  openIntervalPicker,
  openSpeedPicker,
  openIntervalSpeedPicker,
  openCircuitWarmupPicker,
  openCircuitCooldownPicker,
  openCircuitCountPicker,
  updatePicker: /* unchanged */,
  commitPicker,
  dismissPicker: () => setActivePicker(null),
};
```

- [ ] **Step 7: Update `useEditSession` function signature and state initialization**

Change function signature:

```ts
export function useEditSession(
  existing: Session | undefined,
  onBack: () => void,
  newMode?: 'circuit',
): EditSessionInterface {
```

Change mode state:

```ts
const [mode, setMode] = useState<'easy' | 'advanced' | 'circuit'>(existing?.mode ?? newMode ?? 'easy');
```

Add circuit-specific state (after existing warmup/work/rest/rounds/cooldown state):

```ts
const [circuitWarmup,   setCircuitWarmup]   = useState(existing?.mode === 'circuit' ? existing.warmup    : 60);
const [circuitCooldown, setCircuitCooldown] = useState(existing?.mode === 'circuit' ? existing.cooldown  : 60);
const [circuitCount,    setCircuitCount]    = useState(existing?.mode === 'circuit' ? existing.circuits  : 3);
```

Update `intervals` initialization to include circuit:

```ts
const [intervals, setIntervals] = useState<LocalInterval[]>(
  existing?.mode === 'advanced' || existing?.mode === 'circuit'
    ? existing.intervals.map(toLocal) : []
);
```

- [ ] **Step 8: Add circuit snapshot for `hasChanges` tracking**

After `initialSnapshot`, add:

```ts
const initialCircuitSnapshot = useRef(
  existing?.mode === 'circuit'
    ? JSON.stringify({ name: existing.name, warmup: existing.warmup, cooldown: existing.cooldown, circuits: existing.circuits, intervals: existing.intervals })
    : JSON.stringify({ name: '', warmup: 60, cooldown: 60, circuits: 3, intervals: [] })
).current;
```

- [ ] **Step 9: Update `previewSegments` memo**

Replace the `previewSegments` useMemo:

```ts
const previewSegments = useMemo(() => {
  const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
  if (mode === 'circuit') {
    return expandCircuit(cleanIntervals, circuitCount, circuitWarmup, circuitCooldown);
  }
  const draft: Session = mode === 'easy'
    ? { id: '', name: '', mode: 'easy', config: easyConfig, activityType, runSpeeds }
    : { id: '', name: '', mode: 'advanced', intervals: cleanIntervals, activityType, runSpeeds };
  return getSessionSegments(draft);
}, [mode, warmup, work, rest, rounds, cooldown, intervals, activityType, runSpeeds, circuitWarmup, circuitCooldown, circuitCount]);
```

- [ ] **Step 10: Update `cyclePhase` for circuit mode**

```ts
function cyclePhase(key: string) {
  setTimingDirty(true);
  setActiveTimingPreset(null);
  const phases = mode === 'circuit' ? CIRCUIT_PHASES : PHASES;
  setIntervals(ivs => ivs.map(iv => {
    if (iv._key !== key) return iv;
    const currentIdx = phases.indexOf(iv.type);
    const nextType = currentIdx >= 0
      ? phases[(currentIdx + 1) % phases.length]
      : phases[0];
    return { ...iv, type: nextType };
  }));
}
```

- [ ] **Step 11: Update the `onCommit` handler in the `usePickerState` call**

Inside the `onCommit` callback (the function passed to `usePickerState`), add circuit cases:

```ts
} else if (result.type === 'circuitWarmup') {
  setCircuitWarmup(result.secs);
  setTimingDirty(true);
} else if (result.type === 'circuitCooldown') {
  setCircuitCooldown(result.secs);
  setTimingDirty(true);
} else if (result.type === 'circuitCount') {
  setCircuitCount(result.value);
  setTimingDirty(true);
```

Also update the `usePickerState` call to pass `circuitValues`:

```ts
} = usePickerState(
  intervals,
  fieldValues,
  { warmup: circuitWarmup, cooldown: circuitCooldown, count: circuitCount },
  (result) => { /* onCommit handler */ },
);
```

And destructure the new openers:

```ts
const {
  picker,
  openFieldPicker,
  openRoundsPicker: openRoundsPickerInner,
  openIntervalPicker,
  openSpeedPicker,
  openIntervalSpeedPicker: openIntervalSpeedPickerInner,
  openCircuitWarmupPicker,
  openCircuitCooldownPicker,
  openCircuitCountPicker,
  updatePicker,
  commitPicker,
  dismissPicker,
} = usePickerState(/* ... */);
```

- [ ] **Step 12: Add `setActivityLabel` function**

```ts
function setActivityLabel(key: string, label: string) {
  setIntervals(ivs => ivs.map(iv =>
    iv._key === key ? { ...iv, activityLabel: label } : iv
  ));
}
```

- [ ] **Step 13: Update `buildSavePayload` for circuit mode**

Replace `buildSavePayload`:

```ts
function buildSavePayload(): SavePayload {
  if (mode === 'circuit') {
    if (!name.trim()) {
      return { ok: false, titleKey: 'alerts.nameRequiredTitle', messageKey: 'alerts.nameRequiredMessage' };
    }
    const hasWork = intervals.some(iv => iv.type === 'work');
    if (!hasWork) {
      return { ok: false, titleKey: 'alerts.noWorkIntervalsTitle', messageKey: 'alerts.noWorkIntervalsMessage' };
    }
    const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
    const session: Session = {
      id: existing?.id ?? newId(),
      name: name.trim(),
      mode: 'circuit',
      intervals: cleanIntervals,
      circuits: circuitCount,
      warmup: circuitWarmup,
      cooldown: circuitCooldown,
    };
    return { ok: true, session, isNew: !existing };
  }
  const validation = validateDraft(name, mode, intervals);
  if (!validation.ok) {
    return { ok: false, titleKey: validation.titleKey, messageKey: validation.messageKey };
  }
  const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
  const session = buildSessionFromDraft(mode, name.trim(), easyConfig, cleanIntervals, activityType, runSpeeds, existing?.id);
  return { ok: true, session, isNew: !existing };
}
```

- [ ] **Step 14: Update `hasChanges` memo**

```ts
const hasChanges = useMemo(() => {
  const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
  if (mode === 'circuit') {
    const current = JSON.stringify({ name, warmup: circuitWarmup, cooldown: circuitCooldown, circuits: circuitCount, intervals: cleanIntervals });
    return current !== initialCircuitSnapshot;
  }
  const current = serializeDraft(name, mode, warmup, work, rest, cooldown, rounds, cleanIntervals, activityType, runSpeeds);
  return current !== initialSnapshot;
}, [name, mode, warmup, work, rest, cooldown, rounds, intervals, activityType, runSpeeds, circuitWarmup, circuitCooldown, circuitCount]);
```

- [ ] **Step 15: Update `draft` object**

```ts
const draft: EditSessionDraft = {
  name,
  isAdvanced: mode === 'advanced',
  isCircuit:  mode === 'circuit',
  fieldValues,
  rounds,
  intervals,
  previewSegments,
  previewTotal: totalDuration(previewSegments),
  activityType,
  runSpeeds,
  activeTimingPreset,
  activeSpeedPreset,
  hasChanges,
  circuitWarmup,
  circuitCooldown,
  circuitCount,
};
```

- [ ] **Step 16: Update the returned interface**

Add to the return object:

```ts
setActivityLabel,
openCircuitWarmupPicker:  openCircuitWarmupPicker,
openCircuitCooldownPicker: openCircuitCooldownPicker,
openCircuitsPicker:       openCircuitCountPicker,
```

- [ ] **Step 17: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 18: Commit**

```bash
git add src/hooks/useEditSession.ts
git commit -m "feat(circuit): full circuit mode support in useEditSession hook"
```

---

## Task 7: Add circuit creation entry point — `navigation.ts` + `SessionsListScreen.tsx`

**Files:**
- Modify: `src/navigation.ts`
- Modify: `src/screens/SessionsListScreen.tsx`

**Interfaces:**
- Produces: `Route.EditSession` gains optional `newMode?: 'circuit'`; a "Circuit" button in the sessions list header

- [ ] **Step 1: Extend the `EditSession` route**

In `src/navigation.ts`:

```ts
export type Route =
  | { name: 'Sessions' }
  | { name: 'Workout'; session: Session }
  | { name: 'EditSession'; session?: Session; newMode?: 'circuit' }
  | { name: 'Settings' }
  | { name: 'PrivacyPolicy' };
```

- [ ] **Step 2: Add a "Circuit" header button in `SessionsListScreen`**

Replace the `right` prop on `ScreenHeader`:

```tsx
right={
  <View style={styles.headerBtns}>
    <Pressable
      style={styles.circuitBtn}
      onPress={gate(() => onNavigate({ name: 'EditSession', newMode: 'circuit' }))}
    >
      <Text style={styles.circuitBtnText}>{t('edit.newCircuitTitle')}</Text>
    </Pressable>
    <Pressable style={styles.addBtn} onPress={gate(() => onNavigate({ name: 'EditSession' }))}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 5v14M5 12h14" stroke={T.btnGlyph} strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
    </Pressable>
  </View>
}
```

Add styles to `makeStyles`:

```ts
headerBtns: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
circuitBtn: {
  paddingHorizontal: 12,
  paddingVertical: 7,
  borderRadius: 14,
  borderWidth: 1.5,
  borderColor: T.accent,
  backgroundColor: withOpacity(T.accent, 0x18),
},
circuitBtnText: {
  fontFamily: 'Inter_700Bold',
  fontSize: 12,
  letterSpacing: 12 * 0.04,
  color: T.accent,
},
```

Also add `withOpacity` to the import from theme (if not already present):

```ts
import { useTheme, ghostBtnStyle, buttonShadow, withOpacity, type ThemeTokens } from '../theme';
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/navigation.ts src/screens/SessionsListScreen.tsx
git commit -m "feat(circuit): add circuit session creation entry point in sessions list"
```

---

## Task 8: Circuit form branch in `EditSessionScreen`

**Files:**
- Modify: `src/screens/EditSessionScreen.tsx`
- Modify: `App.tsx` (pass `newMode` through to `EditSessionScreen`)

**Interfaces:**
- Consumes: `draft.isCircuit`, `draft.circuitWarmup`, `draft.circuitCooldown`, `draft.circuitCount`, `setActivityLabel`, `openCircuitWarmupPicker`, `openCircuitCooldownPicker`, `openCircuitsPicker` from `useEditSession`
- Produces: full circuit editor form (config grid + interval list with label inputs)

- [ ] **Step 1: Pass `newMode` through `App.tsx`**

In `App.tsx`, find where `EditSessionScreen` is rendered. It currently receives `session={route.session}`. Add `newMode`:

```tsx
<EditSessionScreen
  session={route.session}
  newMode={route.name === 'EditSession' ? route.newMode : undefined}
  onBack={() => setRoute({ name: 'Sessions' })}
/>
```

- [ ] **Step 2: Update `EditSessionScreen` props**

```tsx
interface Props {
  session?: Session;
  newMode?: 'circuit';
  onBack: () => void;
}

export default function EditSessionScreen({ session: existing, newMode, onBack }: Props) {
```

- [ ] **Step 3: Pass `newMode` to `useEditSession`**

```ts
const {
  draft, picker,
  setName,
  setActivityType,
  toggleMode,
  openFieldPicker, openRoundsPicker, openIntervalPicker, openSpeedPicker,
  openIntervalSpeedPicker, clearIntervalSpeed,
  openCircuitWarmupPicker, openCircuitCooldownPicker, openCircuitsPicker,
  cyclePhase, addInterval, duplicateInterval, removeInterval, clearIntervals, reorderIntervals,
  updatePicker, commitPicker, dismissPicker,
  applyDurationPreset, applySpeedPreset,
  setActivityLabel,
  buildSavePayload,
} = useEditSession(existing, onBack, newMode);

const { name, isAdvanced, isCircuit, fieldValues, rounds, intervals, previewSegments, previewTotal,
        activityType, runSpeeds, activeTimingPreset, activeSpeedPreset, hasChanges,
        circuitWarmup, circuitCooldown, circuitCount } = draft;
```

- [ ] **Step 4: Update the editor title to show "New Circuit" when creating a circuit**

```ts
const editorTitle = isEditing
  ? t('edit.editTitle')
  : isCircuit
    ? t('edit.newCircuitTitle')
    : t('edit.newTitle');
```

Pass `editorTitle` to `<ScreenHeader title={editorTitle} ... />`.

- [ ] **Step 5: Hide mode toggle and activity type selector for circuit sessions**

Wrap the mode toggle section:

```tsx
{!isCircuit && (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{t('edit.setupMode')}</Text>
    {/* ...existing toggle... */}
  </View>
)}
```

Wrap the activity type section:

```tsx
{!isCircuit && (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{t('edit.activityType')}</Text>
    {/* ...existing activity type buttons... */}
  </View>
)}
```

- [ ] **Step 6: Render circuit config grid when `isCircuit`**

Add after the preview field group (before the mode-conditional content):

```tsx
{isCircuit && (
  <View style={styles.fieldGroup}>
    <View style={styles.configGrid}>
      <View style={styles.configCell}>
        <Text style={styles.configCellLabel}>{t('edit.circuitWarmup')}</Text>
        <Pressable style={styles.configInput} onPress={openCircuitWarmupPicker}>
          <Text style={styles.configInputText}>{fmtDuration(circuitWarmup)}</Text>
        </Pressable>
      </View>
      <View style={styles.configCell}>
        <Text style={styles.configCellLabel}>{t('edit.circuitCooldown')}</Text>
        <Pressable style={styles.configInput} onPress={openCircuitCooldownPicker}>
          <Text style={styles.configInputText}>{fmtDuration(circuitCooldown)}</Text>
        </Pressable>
      </View>
      <View style={styles.configCell}>
        <Text style={styles.configCellLabel}>{t('edit.circuits')}</Text>
        <Pressable style={styles.configInput} onPress={openCircuitsPicker}>
          <Text style={styles.configInputText}>{circuitCount}</Text>
        </Pressable>
      </View>
    </View>
  </View>
)}
```

- [ ] **Step 7: Render circuit interval list when `isCircuit`**

Add circuit interval list as a third branch alongside the existing `isAdvanced ? ... : ...`:

```tsx
{isCircuit ? (
  <>
    <View style={styles.fieldGroup}>
      {intervals.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t('edit.noIntervals')}</Text>
        </View>
      )}
    </View>

    <NestableDraggableFlatList
      data={intervals}
      keyExtractor={iv => iv._key}
      onDragEnd={({ data }) => reorderIntervals(data)}
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
          activityLabel={iv.activityLabel}
          onLabelChange={iv.type === 'work' ? (label) => setActivityLabel(iv._key, label) : undefined}
        />
      )}
    />

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
  </>
) : isAdvanced ? (
  /* ...existing advanced JSX... */
) : (
  /* ...existing easy JSX... */
)}
```

- [ ] **Step 8: Update `IntervalSwipeRow` to accept and forward label props**

`IntervalSwipeRow` is a local function inside `EditSessionScreen`. Add `activityLabel` and `onLabelChange` to its props type and forward them to `IntervalRow`:

```ts
function IntervalSwipeRow({
  interval, T, styles, isActive, drag,
  onDuplicate, onRemove, onCyclePhase, onOpenPicker,
  displaySpeed, onOpenSpeedPicker, onClearSpeed,
  activityLabel, onLabelChange,
}: {
  /* ...existing fields... */
  activityLabel?:  string;
  onLabelChange?:  (text: string) => void;
}) {
```

Inside the `IntervalRow` in `IntervalSwipeRow`, add:

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
/>
```

- [ ] **Step 9: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Manual verification — open the app**

```bash
npx expo start --ios
```

Check:
1. Sessions list shows a "Circuit" button alongside the "+" in the header
2. Tapping "Circuit" opens the editor with the circuit form (config grid shows Warmup / Cooldown / Circuits; no mode toggle; no activity type)
3. Tapping warmup/cooldown opens a time picker; tapping Circuits opens a rounds-style picker
4. Adding an interval defaults to `work` type; the exercise label TextInput appears; cycling phase toggles between work and rest only
5. Saving a circuit session persists it and returns to the sessions list
6. Editing an existing circuit session loads its data correctly

- [ ] **Step 11: Commit**

```bash
git add App.tsx src/screens/EditSessionScreen.tsx
git commit -m "feat(circuit): circuit editor form — config grid, interval list, label inputs"
```

---

## Task 9: Circuit-specific UI in `WorkoutScreen`

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx`

**Interfaces:**
- Consumes: `seg.activityLabel?: string`, `seg.circuitNumber?: number`, `session.mode === 'circuit'`, `session.circuits`

- [ ] **Step 1: Render the activity label pill**

In the `phaseTop` View, find the speed pill block:

```tsx
{seg.speed !== undefined && !isDone && !isPreStart && (
  <View style={[styles.speedPill, ...]}>
    <Text style={[styles.speedPillText, { color: phaseColor }]}>
      {fmtSpeed(seg.speed, settings.speedUnit)}
    </Text>
  </View>
)}
```

Add the activity label pill immediately after it:

```tsx
{seg.activityLabel !== undefined && !isDone && !isPreStart && (
  <View style={[styles.speedPill, {
    backgroundColor: withOpacity(phaseColor, 0x21),
    borderColor:     withOpacity(phaseColor, 0x59),
  }]}>
    <Text style={[styles.speedPillText, { color: phaseColor }]}>
      {seg.activityLabel}
    </Text>
  </View>
)}
```

- [ ] **Step 2: Replace extend row with circuit indicator**

Find the extend row block:

```tsx
{!isDone && !isPreStart && (
  <View style={styles.extendRow}>
    {/* +5s, +10s, +1 round buttons */}
  </View>
)}
```

Replace with:

```tsx
{!isDone && !isPreStart && (
  session.mode === 'circuit' ? (
    seg.circuitNumber !== undefined && (
      <Text style={[styles.intervalCounter, { color: T.onBg }]}>
        {t('workout.circuit')} {seg.circuitNumber} / {session.circuits}
      </Text>
    )
  ) : (
    <View style={styles.extendRow}>
      <View style={styles.extendLeft}>
        {EXTEND_OPTIONS.map((secs) => (
          <GhostBtn key={secs} onPress={() => setSegments(extend(secs))} disabled={isIdle} color={phaseColor} size={68}>
            <Text style={[styles.intervalCounter, { color: phaseColor }]}>{`+${secs}s`}</Text>
          </GhostBtn>
        ))}
      </View>
      <GhostBtn onPress={appendLastTwo} disabled={isIdle} color={phaseColor} size={68}>
        <Text style={[styles.intervalCounter, { color: phaseColor }]}>
          {'+1 '}
          <Text style={styles.roundAbbr}>{t('workout.roundAbbr')}</Text>
        </Text>
      </GhostBtn>
    </View>
  )
)}
```

- [ ] **Step 3: Show activity label in the next-up row**

Find the `nextUpRow` block where `nextSeg.speed` is shown:

```tsx
{nextSeg.speed !== undefined && (
  <Text style={[styles.nextPhase, { color: nextPhaseColor! }]}>
    {fmtSpeed(nextSeg.speed, settings.speedUnit)}
  </Text>
)}
```

Add the activity label display after it:

```tsx
{nextSeg.activityLabel !== undefined && (
  <Text style={[styles.nextPhase, { color: nextPhaseColor! }]}>
    {nextSeg.activityLabel}
  </Text>
)}
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual verification — run a circuit session**

```bash
npx expo start --ios
```

Check:
1. Tap the default "Body Weight Circuit" session → start workout
2. During warmup: no activity label pill visible; circuit indicator area is empty
3. During first work phase ("Push-ups"): label pill shows "Push-ups"; circuit indicator shows "CIRCUIT 1 / 3"; no extend row buttons
4. During rest phase: no label pill; circuit indicator shows "CIRCUIT 1 / 3"
5. After 3 full circuits: cooldown plays correctly; no circuit indicator shown
6. In next-up row: label appears alongside the next phase name during work phases
7. Session completes normally; SessionCompleteScreen shows correctly

- [ ] **Step 6: Commit**

```bash
git add src/screens/WorkoutScreen.tsx
git commit -m "feat(circuit): activity label pill and circuit indicator in WorkoutScreen"
```
