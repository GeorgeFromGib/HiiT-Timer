# Run HIIT Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Run" activity type to sessions that stores per-phase treadmill speeds (km/h), displays a speed pill on the workout screen, and adds a km/mph unit toggle in Settings.

**Architecture:** `Session` gains optional `activityType?: 'run'` and `runSpeeds?: RunSpeeds` fields orthogonal to the existing Easy/Advanced mode. `Segment` gains an optional `speed?: number` field that `getSessionSegments` stamps when the session is a Run type. The workout screen reads `seg.speed` and renders a phase-coloured pill.

**Tech Stack:** Expo SDK 56, React Native 0.85, TypeScript 6, jest-expo for tests.

---

### Task 1: Configure Jest

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
npx expo install jest-expo --save-dev
npm install --save-dev @types/jest
```

- [ ] **Step 2: Add jest config and test script to package.json**

In `package.json`, add `"test": "jest"` to `scripts` and add the `jest` block:

```json
"scripts": {
  "start": "expo start",
  "android": "expo run:android",
  "ios": "expo run:ios",
  "web": "expo start --web",
  "test": "jest"
},
"jest": {
  "preset": "jest-expo",
  "testMatch": ["**/__tests__/**/*.test.ts"]
}
```

- [ ] **Step 3: Verify Jest runs**

```bash
npx jest --listTests
```

Expected: no error (empty list is fine — no tests yet).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jest-expo test setup"
```

---

### Task 2: Add RunSpeeds type and update Session + Segment

**Files:**
- Modify: `src/lib/sessions.ts`
- Modify: `src/lib/workout.ts`

- [ ] **Step 1: Add `RunSpeeds` and `DEFAULT_RUN_SPEEDS` to sessions.ts**

Add after the existing imports at the top of `src/lib/sessions.ts`, before the `Session` type:

```ts
export interface RunSpeeds {
  warmupSpeed: number;
  workSpeed: number;
  restSpeed: number;
  cooldownSpeed: number;
}

export const DEFAULT_RUN_SPEEDS: RunSpeeds = {
  warmupSpeed: 5,
  workSpeed: 8,
  restSpeed: 5,
  cooldownSpeed: 4.5,
};
```

- [ ] **Step 2: Update the `Session` type to include optional activity type fields**

Replace the existing `Session` type in `src/lib/sessions.ts`:

```ts
export type Session = {
  id: string;
  name: string;
  activityType?: 'run';
  runSpeeds?: RunSpeeds;
} & (
  | { mode: 'easy'; config: WorkoutConfig }
  | { mode: 'advanced'; intervals: Interval[] }
);
```

- [ ] **Step 3: Add optional `speed` field to `Segment` in workout.ts**

In `src/lib/workout.ts`, update the `Segment` interface:

```ts
export interface Segment {
  phase: Phase;
  label: string;
  duration: number;
  startAt: number;
  endAt: number;
  index: number;
  speed?: number; // km/h — only present for run sessions
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sessions.ts src/lib/workout.ts
git commit -m "feat: add RunSpeeds type and optional speed field to Segment"
```

---

### Task 3: Add fmtSpeed helper and tests

**Files:**
- Modify: `src/lib/workout.ts`
- Create: `src/__tests__/fmtSpeed.test.ts`

- [ ] **Step 1: Write the failing test first**

Create `src/__tests__/fmtSpeed.test.ts`:

```ts
import { fmtSpeed } from '../lib/workout';

describe('fmtSpeed', () => {
  it('formats km/h values as-is', () => {
    expect(fmtSpeed(8, 'km')).toBe('8 km/h');
    expect(fmtSpeed(4.5, 'km')).toBe('4.5 km/h');
    expect(fmtSpeed(5, 'km')).toBe('5 km/h');
  });

  it('converts to nearest 0.5 mph', () => {
    expect(fmtSpeed(8, 'miles')).toBe('5.0 mph');    // 8 × 0.621371 = 4.971 → 5.0
    expect(fmtSpeed(5, 'miles')).toBe('3.0 mph');    // 5 × 0.621371 = 3.107 → 3.0
    expect(fmtSpeed(4.5, 'miles')).toBe('3.0 mph');  // 4.5 × 0.621371 = 2.796 → 3.0
    expect(fmtSpeed(11, 'miles')).toBe('7.0 mph');   // 11 × 0.621371 = 6.835 → 7.0
    expect(fmtSpeed(14, 'miles')).toBe('8.5 mph');   // 14 × 0.621371 = 8.699 → 8.5
  });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
npx jest fmtSpeed --no-coverage
```

Expected: FAIL — `fmtSpeed is not a function`

- [ ] **Step 3: Implement fmtSpeed in workout.ts**

Add at the end of `src/lib/workout.ts`:

```ts
export function fmtSpeed(kmh: number, unit: 'km' | 'miles'): string {
  if (unit === 'miles') {
    const mph = Math.round(kmh * 0.621371 * 2) / 2;
    return `${mph.toFixed(1)} mph`;
  }
  return `${kmh} km/h`;
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npx jest fmtSpeed --no-coverage
```

Expected: PASS (5 assertions)

- [ ] **Step 5: Commit**

```bash
git add src/lib/workout.ts src/__tests__/fmtSpeed.test.ts
git commit -m "feat: add fmtSpeed helper with km/miles conversion"
```

---

### Task 4: Update getSessionSegments to stamp speed, write tests

**Files:**
- Modify: `src/lib/sessions.ts`
- Create: `src/__tests__/runSegments.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/runSegments.test.ts`:

```ts
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ exists: false })),
  Paths: { document: '/tmp' },
}));

import { getSessionSegments } from '../lib/sessions';
import type { Session } from '../lib/sessions';

const easyRunSession: Session = {
  id: 'r1',
  name: 'Test Run',
  mode: 'easy',
  activityType: 'run',
  config: { warmup: 60, high: 20, low: 40, rounds: 2, cooldown: 60 },
  runSpeeds: { warmupSpeed: 5, workSpeed: 8, restSpeed: 5, cooldownSpeed: 4.5 },
};

const plainEasySession: Session = {
  id: 'e1',
  name: 'Plain Easy',
  mode: 'easy',
  config: { warmup: 60, high: 20, low: 40, rounds: 2, cooldown: 60 },
};

describe('getSessionSegments — run type', () => {
  it('stamps correct speed on each phase', () => {
    const segs = getSessionSegments(easyRunSession);
    expect(segs.find(s => s.phase === 'warmup')?.speed).toBe(5);
    expect(segs.find(s => s.phase === 'work')?.speed).toBe(8);
    expect(segs.find(s => s.phase === 'rest')?.speed).toBe(5);
    expect(segs.find(s => s.phase === 'cooldown')?.speed).toBe(4.5);
  });

  it('stamps all work and rest segments, not just the first', () => {
    const segs = getSessionSegments(easyRunSession);
    const workSegs = segs.filter(s => s.phase === 'work');
    const restSegs = segs.filter(s => s.phase === 'rest');
    expect(workSegs).toHaveLength(2);
    expect(restSegs).toHaveLength(2);
    workSegs.forEach(s => expect(s.speed).toBe(8));
    restSegs.forEach(s => expect(s.speed).toBe(5));
  });

  it('does not stamp speed on non-run sessions', () => {
    const segs = getSessionSegments(plainEasySession);
    segs.forEach(s => expect(s.speed).toBeUndefined());
  });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
npx jest runSegments --no-coverage
```

Expected: FAIL — speed fields are undefined

- [ ] **Step 3: Update getSessionSegments in sessions.ts**

Replace the existing `getSessionSegments` function in `src/lib/sessions.ts`:

```ts
function speedForPhase(phase: Phase, speeds: RunSpeeds): number {
  const map: Record<Phase, number> = {
    warmup:   speeds.warmupSpeed,
    work:     speeds.workSpeed,
    rest:     speeds.restSpeed,
    cooldown: speeds.cooldownSpeed,
  };
  return map[phase];
}

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

Also add `Phase` to the imports from `'./workout'` in sessions.ts (it's needed by `speedForPhase`):

```ts
import type { Interval, Segment, WorkoutConfig, Phase } from './workout';
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npx jest runSegments --no-coverage
```

Expected: PASS (4 assertions)

- [ ] **Step 5: Verify full test suite passes**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sessions.ts src/__tests__/runSegments.test.ts
git commit -m "feat: stamp speed on run session segments in getSessionSegments"
```

---

### Task 5: Add speedUnit to Settings

**Files:**
- Modify: `src/lib/settings.ts`

- [ ] **Step 1: Add `speedUnit` to the Settings interface and defaults**

In `src/lib/settings.ts`, update `Settings` and `DEFAULT_SETTINGS`:

```ts
export interface Settings {
  theme: ThemeKey;
  congratsMessage: boolean;
  finalCountdownBeep: boolean;
  keepScreenAwake: boolean;
  soundCues: boolean;
  soundOff: boolean;
  countdownFlash: boolean;
  soundVolume: number;
  speedUnit: 'km' | 'miles';
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'tidal',
  congratsMessage: true,
  finalCountdownBeep: true,
  keepScreenAwake: true,
  soundCues: true,
  soundOff: false,
  countdownFlash: true,
  soundVolume: 100,
  speedUnit: 'km',
};
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/settings.ts
git commit -m "feat: add speedUnit setting (km/miles, default km)"
```

---

### Task 6: Update useEditSession with activityType and runSpeeds

**Files:**
- Modify: `src/hooks/useEditSession.ts`

- [ ] **Step 1: Add imports and new state**

At the top of `src/hooks/useEditSession.ts`, add to the existing sessions import:

```ts
import { loadSessions, saveSessions, deleteSessionById, newId, type Session, type RunSpeeds, DEFAULT_RUN_SPEEDS } from '../lib/sessions';
```

Inside `useEditSession`, add two new state variables after the `intervals` state:

```ts
const [activityType, setActivityType] = useState<'run' | undefined>(
  existing?.activityType
);
const [runSpeeds, setRunSpeeds] = useState<RunSpeeds>(
  existing?.runSpeeds ?? DEFAULT_RUN_SPEEDS
);
```

- [ ] **Step 2: Add setRunSpeed helper inside the hook**

Add inside `useEditSession`, after the `setRunSpeeds` state declaration:

```ts
function setRunSpeed(field: keyof RunSpeeds, value: number) {
  setRunSpeeds(prev => ({ ...prev, [field]: value }));
}
```

- [ ] **Step 3: Update EditSessionDraft to include the new fields**

Update the `EditSessionDraft` interface:

```ts
export interface EditSessionDraft {
  name:            string;
  isAdvanced:      boolean;
  fieldValues:     Record<TimeField, number>;
  rounds:          number;
  intervals:       LocalInterval[];
  previewSegments: Segment[];
  previewTotal:    number;
  activityType:    'run' | undefined;
  runSpeeds:       RunSpeeds;
}
```

- [ ] **Step 4: Update EditSessionInterface to expose the new setters**

Update the `EditSessionInterface` interface — add after `setName`:

```ts
setActivityType: (type: 'run' | undefined) => void;
setRunSpeed:     (field: keyof RunSpeeds, value: number) => void;
```

- [ ] **Step 5: Update the save() function to persist activityType and runSpeeds**

Replace the `save` function inside `useEditSession`:

```ts
const save = async () => {
  if (!name.trim()) {
    Alert.alert('Name required', 'Please enter a session name.');
    return;
  }
  if (mode === 'advanced' && intervals.length === 0) {
    Alert.alert('No intervals', 'Add at least one interval.');
    return;
  }
  const base = { id: existing?.id ?? newId(), name: name.trim() };
  const speedProps = activityType === 'run'
    ? { activityType: 'run' as const, runSpeeds }
    : {};
  const cleanIntervals: Interval[] = intervals.map(({ _key, ...iv }) => iv);
  const updated: Session = mode === 'easy'
    ? { ...base, ...speedProps, mode: 'easy', config: easyConfig }
    : { ...base, ...speedProps, mode: 'advanced', intervals: cleanIntervals };
  const sessions = await loadSessions();
  const next = existing
    ? sessions.map(s => (s.id === updated.id ? updated : s))
    : [...sessions, updated];
  await saveSessions(next);
  onBack();
};
```

- [ ] **Step 6: Update the draft object and return value at the end of useEditSession**

Update the `draft` object:

```ts
const draft: EditSessionDraft = {
  name,
  isAdvanced: mode === 'advanced',
  fieldValues,
  rounds,
  intervals,
  previewSegments,
  previewTotal: totalDuration(previewSegments),
  activityType,
  runSpeeds,
};
```

Update the return value — add `setActivityType` and `setRunSpeed`:

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
  updatePicker,
  commitPicker,
  dismissPicker,
  save,
  deleteSession,
};
```

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useEditSession.ts
git commit -m "feat: add activityType and runSpeeds state to useEditSession"
```

---

### Task 7: Edit Session Screen — Activity Type selector

**Files:**
- Modify: `src/screens/EditSessionScreen.tsx`

- [ ] **Step 1: Destructure new hook values**

In `EditSessionScreen`, update the destructure from `useEditSession`:

```ts
const {
  draft, picker,
  setName,
  setActivityType,
  setRunSpeed,
  toggleMode,
  openFieldPicker, openRoundsPicker, openIntervalPicker,
  cyclePhase, addInterval, duplicateInterval, removeInterval, clearIntervals, reorderIntervals,
  updatePicker, commitPicker, dismissPicker,
  save, deleteSession,
} = useEditSession(existing, onBack);

const { name, isAdvanced, fieldValues, rounds, intervals, previewSegments, previewTotal, activityType, runSpeeds } = draft;
const isRun = activityType === 'run';
```

- [ ] **Step 2: Add the ACTIVITY TYPE section to the JSX**

Insert the following block between the Session Name `fieldGroup` and the SETUP MODE `fieldGroup` inside the `NestableScrollContainer`:

```tsx
{/* Activity Type */}
<View style={styles.fieldGroup}>
  <Text style={styles.fieldLabel}>ACTIVITY TYPE</Text>
  <View style={styles.activityTypeRow}>
    <Pressable
      style={[styles.activityTypeBtn, !isRun && { borderColor: T.accent, backgroundColor: withOpacity(T.accent, 0x14) }]}
      onPress={() => setActivityType(undefined)}
    >
      <Text style={[styles.activityTypeBtnText, { color: !isRun ? T.accent : T.subText }]}>General</Text>
    </Pressable>
    <Pressable
      style={[styles.activityTypeBtn, isRun && { borderColor: T.accent, backgroundColor: withOpacity(T.accent, 0x14) }]}
      onPress={() => setActivityType('run')}
    >
      <Text style={[styles.activityTypeBtnText, { color: isRun ? T.accent : T.subText }]}>Run</Text>
    </Pressable>
  </View>
</View>
```

- [ ] **Step 3: Add activityTypeRow and activityTypeBtn styles to makeStyles**

Inside `makeStyles`, add after the `modeToggleLabel` style:

```ts
activityTypeRow: {
  flexDirection: 'row',
  gap: 10,
},
activityTypeBtn: {
  flex: 1,
  paddingVertical: 11,
  alignItems: 'center',
  borderRadius: 12,
  borderWidth: 1.5,
  borderColor: T.hairline,
  backgroundColor: T.ghostBg,
},
activityTypeBtnText: {
  fontFamily: 'Inter_700Bold',
  fontSize: 13,
  letterSpacing: 13 * 0.04,
},
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/EditSessionScreen.tsx
git commit -m "feat: add Activity Type selector (General/Run) to Edit Session screen"
```

---

### Task 8: Edit Session Screen — Speeds section

**Files:**
- Modify: `src/screens/EditSessionScreen.tsx`

- [ ] **Step 1: Add speedFields constant near the top of the component**

Add after the `timeFields` constant inside `EditSessionScreen`:

```ts
const speedFields: { label: string; field: keyof RunSpeeds }[] = [
  { label: 'Warmup',   field: 'warmupSpeed'   },
  { label: 'Work',     field: 'workSpeed'     },
  { label: 'Rest',     field: 'restSpeed'     },
  { label: 'Cooldown', field: 'cooldownSpeed' },
];
```

- [ ] **Step 2: Import RunSpeeds**

Add `RunSpeeds` to the sessions import at the top of the file:

```ts
import { type Session, type RunSpeeds } from '../lib/sessions';
```

- [ ] **Step 3: Add the SPEEDS section to the JSX**

The current else branch of `isAdvanced ? ... :` returns a single `<View>`. Wrap it in a fragment and add the SPEEDS block as a sibling. Replace the entire `isAdvanced ? (...) : (...)` expression with:

```tsx
{isAdvanced ? (
  <>
    {/* Intervals — existing JSX unchanged */}
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>INTERVALS</Text>
      {intervals.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No intervals yet. Add one below.</Text>
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
        />
      )}
    />

    <View style={styles.intervalActions}>
      <Pressable onPress={addInterval} style={styles.addIntervalBtn}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke={T.accent} strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
        <Text style={[styles.addIntervalBtnText, { color: T.accent }]}>Add Interval</Text>
      </Pressable>
      {intervals.length > 0 && (
        <Pressable onPress={clearIntervals} style={styles.clearIntervalsBtn}>
          <Text style={[styles.addIntervalBtnText, { color: T.subText }]}>Clear All</Text>
        </Pressable>
      )}
    </View>
  </>
) : (
  <>
    {/* Easy mode timing */}
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>TIMING</Text>
      <View style={styles.configGrid}>
        {timeFields.map(({ label, field }) => (
          <View key={field} style={styles.configCell}>
            <Text style={styles.configCellLabel}>{label}</Text>
            <Pressable
              style={styles.configInput}
              onPress={() => openFieldPicker(field)}
            >
              <Text style={styles.configInputText}>
                {fmtDuration(fieldValues[field])}
              </Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.configCell}>
          <Text style={styles.configCellLabel}>Rounds</Text>
          <Pressable style={styles.configInput} onPress={openRoundsPicker}>
            <Text style={styles.configInputText}>{rounds}</Text>
          </Pressable>
        </View>
      </View>
    </View>

    {/* Speeds — only visible when activity type is Run */}
    {isRun && (
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>SPEEDS</Text>
        <View style={styles.configGrid}>
          {speedFields.map(({ label, field }) => (
            <View key={field} style={styles.configCell}>
              <Text style={styles.configCellLabel}>{label}</Text>
              <View style={[styles.configInput, styles.speedInputWrapper]}>
                <TextInput
                  style={styles.speedInputText}
                  value={String(runSpeeds[field])}
                  onChangeText={v => {
                    const n = parseFloat(v);
                    if (!isNaN(n) && n > 0) setRunSpeed(field, n);
                  }}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  selectTextOnFocus
                />
                <Text style={styles.speedUnitLabel}>km/h</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    )}
  </>
)}
```

- [ ] **Step 4: Add speed input styles to makeStyles**

Inside `makeStyles`, add after the `configInputText` style:

```ts
speedInputWrapper: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 8,
},
speedInputText: {
  flex: 1,
  fontFamily: 'ChakraPetch_700Bold',
  fontSize: 18,
  color: T.text,
  textAlign: 'center',
  paddingVertical: 0,
},
speedUnitLabel: {
  fontFamily: 'Inter_600SemiBold',
  fontSize: 11,
  color: T.faintText,
},
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/screens/EditSessionScreen.tsx
git commit -m "feat: add Speeds section to Edit Session screen for Run sessions"
```

---

### Task 9: Workout Screen — Speed pill

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx`

- [ ] **Step 1: Import fmtSpeed**

Update the workout import line in `src/screens/WorkoutScreen.tsx`:

```ts
import {
  PHASE_META,
  totalDuration,
  fmtTimer,
  fmtSpeed,
} from '../lib/workout';
```

- [ ] **Step 2: Add the speed pill JSX between the phase label and the countdown row**

Find the `<Text style={[styles.phaseLabel, ...]}` element inside `phaseTop`. After the closing `</Text>` of `phaseLabel`, add the speed pill:

```tsx
{seg.speed !== undefined && !isDone && !isPreStart && (
  <View style={[styles.speedPill, {
    backgroundColor: withOpacity(phaseColor, 0x21),
    borderColor:     withOpacity(phaseColor, 0x59),
  }]}>
    <Text style={[styles.speedPillText, { color: phaseColor }]}>
      {fmtSpeed(seg.speed, settings.speedUnit)}
    </Text>
  </View>
)}
```

- [ ] **Step 3: Add speed pill styles to makeStyles**

Inside `makeStyles`, add after the `phaseLabel` style:

```ts
speedPill: {
  borderRadius: 20,
  borderWidth: 1.5,
  paddingHorizontal: 16,
  paddingVertical: 5,
},
speedPillText: {
  fontFamily: 'Inter_700Bold',
  fontSize: 15,
  letterSpacing: 15 * 0.02,
},
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/WorkoutScreen.tsx
git commit -m "feat: show speed pill on workout screen for Run sessions"
```

---

### Task 10: Settings Screen — Speed unit toggle

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Add a new Units section with a speed unit selector**

Inside `SettingsScreen`, after the `{/* ── Workout ── */}` `SSection` block and before the `{/* ── Audio ── */}` block, add:

```tsx
{/* ── Units ── */}
<SSection title="Units">
  <SRow
    label="Speed unit"
    sub="Display unit for Run session speeds"
    last
    right={
      <View style={styles.segControl}>
        {(['km', 'miles'] as const).map(unit => (
          <Pressable
            key={unit}
            onPress={() => updateSettings('speedUnit', unit)}
            style={[
              styles.segBtn,
              settings.speedUnit === unit && { backgroundColor: T.accent },
            ]}
          >
            <Text style={[
              styles.segBtnText,
              { color: settings.speedUnit === unit ? T.btnGlyph : T.subText },
            ]}>
              {unit === 'km' ? 'km/h' : 'mph'}
            </Text>
          </Pressable>
        ))}
      </View>
    }
  />
</SSection>
```

- [ ] **Step 2: Add segControl styles to makeStyles**

Inside the `makeStyles` function in `SettingsScreen.tsx`, add at the end before the closing `})`:

```ts
segControl: {
  flexDirection: 'row',
  borderRadius: 8,
  overflow: 'hidden',
  borderWidth: 1.5,
  borderColor: T.hairline,
},
segBtn: {
  paddingHorizontal: 12,
  paddingVertical: 6,
},
segBtnText: {
  fontFamily: 'Inter_700Bold',
  fontSize: 12,
  letterSpacing: 12 * 0.04,
},
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: add speed unit toggle (km/h / mph) to Settings screen"
```

---

### Task 11: Add default Run session

**Files:**
- Modify: `src/lib/sessions.ts`

- [ ] **Step 1: Add a default Run session to DEFAULT_SESSIONS**

In `src/lib/sessions.ts`, update `DEFAULT_SESSIONS` to add the run session as the third entry:

```ts
export const DEFAULT_SESSIONS: Session[] = [
  {
    id: 'default-1',
    name: 'Tabata Burnout',
    mode: 'easy',
    config: { warmup: 45, high: 20, low: 10, rounds: 8, cooldown: 60 },
  },
  {
    id: 'default-2',
    name: 'Quick HiiT',
    mode: 'advanced',
    intervals: [
      { type: 'warmup',   dur: 20 },
      { type: 'work',     dur: 20 },
      { type: 'rest',     dur: 10 },
      { type: 'work',     dur: 30 },
      { type: 'rest',     dur: 15 },
      { type: 'work',     dur: 20 },
      { type: 'rest',     dur: 10 },
      { type: 'cooldown', dur: 30 },
    ],
  },
  {
    id: 'default-run-1',
    name: 'Easy Run',
    mode: 'easy',
    activityType: 'run',
    config: { warmup: 180, high: 20, low: 40, rounds: 14, cooldown: 180 },
    runSpeeds: { warmupSpeed: 5, workSpeed: 8, restSpeed: 5, cooldownSpeed: 4.5 },
  },
];
```

- [ ] **Step 2: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sessions.ts
git commit -m "feat: add Easy Run default session"
```
