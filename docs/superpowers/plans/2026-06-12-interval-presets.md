# Interval Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Easy / Medium / Hard preset pill buttons to the Edit Session screen that one-shot-fill duration and (for Run sessions) speed fields, with an overwrite alert when the user has manually edited values.

**Architecture:** A new pure-data file `src/lib/presets.ts` holds the preset values. `useEditSession.ts` gains two dirty flags and two `applyXxxPreset` actions. `EditSessionScreen.tsx` renders two new `PresetStrip` rows wired to those actions.

**Tech Stack:** React Native (Expo SDK 56), TypeScript. No test runner is configured in this project — verification steps use TypeScript compilation and manual app testing.

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Create | `src/lib/presets.ts` | Preset data: `PresetLevel`, `DURATION_PRESETS`, `SPEED_PRESETS` |
| Modify | `src/hooks/useEditSession.ts` | `timingDirty`, `speedsDirty` state; `applyDurationPreset`, `applySpeedPreset` actions; updated `EditSessionInterface` |
| Modify | `src/screens/EditSessionScreen.tsx` | `PresetStrip` component; two preset rows wired into the form |

---

## Task 1: Create `src/lib/presets.ts`

**Files:**
- Create: `src/lib/presets.ts`

- [ ] **Step 1: Write the file**

```typescript
export type PresetLevel = 'easy' | 'medium' | 'hard';

export interface DurationPreset {
  warmup:   number; // seconds
  work:     number;
  rest:     number;
  rounds:   number;
  cooldown: number;
}

export interface SpeedPreset {
  warmupSpeed:   number; // km/h
  workSpeed:     number;
  restSpeed:     number;
  cooldownSpeed: number;
}

export const DURATION_PRESETS: Record<PresetLevel, DurationPreset> = {
  easy:   { warmup: 180, work:  20, rest: 40, rounds: 14, cooldown: 180 },
  medium: { warmup: 240, work:  30, rest: 30, rounds: 18, cooldown: 240 },
  hard:   { warmup: 300, work:  45, rest: 15, rounds: 22, cooldown: 300 },
};

export const SPEED_PRESETS: Record<PresetLevel, SpeedPreset> = {
  easy:   { warmupSpeed:  5, workSpeed:  8, restSpeed:  5, cooldownSpeed: 4.5 },
  medium: { warmupSpeed:  6, workSpeed: 11, restSpeed:  6, cooldownSpeed: 5.5 },
  hard:   { warmupSpeed:  7, workSpeed: 14, restSpeed:  7, cooldownSpeed: 6   },
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/presets.ts
git commit -m "feat: add interval preset data (duration + speed)"
```

---

## Task 2: Add dirty tracking to `useEditSession.ts`

**Files:**
- Modify: `src/hooks/useEditSession.ts`

The two flags track whether the user has manually changed timing or speed values since the screen was opened (or since a preset was last applied). They gate the overwrite alert.

- [ ] **Step 1: Add dirty-flag state after the `runSpeeds` state line (line 229)**

Add these two lines immediately after `const [runSpeeds, setRunSpeeds] = useState<RunSpeeds>(...)`:

```typescript
  const [timingDirty, setTimingDirty] = useState(false);
  const [speedsDirty, setSpeedsDirty] = useState(false);
```

- [ ] **Step 2: Mark timing dirty when a picker commits a timing value**

The `onCommit` callback passed to `usePickerState` (lines 267–283) handles all picker commits. Update it so any timing-related commit sets `timingDirty`:

Replace the existing `onCommit` callback body:
```typescript
    (result) => {
      if (result.type === 'rounds') {
        setRounds(result.value);
        setTimingDirty(true);
      } else if (result.type === 'field') {
        fieldSetters[result.field](result.secs);
        setTimingDirty(true);
      } else if (result.type === 'speed') {
        setRunSpeed(result.field, result.kmh);
        setSpeedsDirty(true);
      } else if (result.type === 'intervalSpeed') {
        setIntervals(ivs =>
          ivs.map(iv => iv._key === result.key ? { ...iv, speed: result.kmh } : iv)
        );
      } else {
        setIntervals(ivs =>
          ivs.map(iv => iv._key === result.key ? { ...iv, dur: result.secs } : iv)
        );
        setTimingDirty(true);
      }
    }
```

- [ ] **Step 3: Mark timing dirty on interval list mutations**

In the `setRunSpeed` function, `speedsDirty` is already set by the picker commit (step 2). But the direct `setRunSpeed` call from the hook's public API also needs to set it. Update `setRunSpeed`:

```typescript
  function setRunSpeed(field: keyof RunSpeeds, value: number) {
    setRunSpeeds(prev => ({ ...prev, [field]: value }));
    setSpeedsDirty(true);
  }
```

Mark `timingDirty` in interval mutation functions. Update each of the following four functions by adding `setTimingDirty(true)` as the first line inside the function body:

```typescript
  function cyclePhase(key: string) {
    setTimingDirty(true);
    setIntervals(ivs => ivs.map(iv =>
      iv._key === key
        ? { ...iv, type: PHASES[(PHASES.indexOf(iv.type) + 1) % PHASES.length] }
        : iv
    ));
  }

  function addInterval() {
    setTimingDirty(true);
    setIntervals(ivs => [...ivs, toLocal({ type: 'work', dur: 30 })]);
  }

  function duplicateInterval(key: string) {
    setTimingDirty(true);
    setIntervals(ivs => {
      const idx = ivs.findIndex(iv => iv._key === key);
      if (idx === -1) return ivs;
      const copy = toLocal(ivs[idx]);
      return [...ivs.slice(0, idx + 1), copy, ...ivs.slice(idx + 1)];
    });
  }

  function removeInterval(key: string) {
    setTimingDirty(true);
    setIntervals(ivs => ivs.filter(iv => iv._key !== key));
  }
```

Also update the `clearIntervals` inline function in the return object and `reorderIntervals`:

In the `return` block, change:
```typescript
    clearIntervals: () => setIntervals([]),
    reorderIntervals: setIntervals,
```
to:
```typescript
    clearIntervals: () => { setTimingDirty(true); setIntervals([]); },
    reorderIntervals: (data: LocalInterval[]) => { setTimingDirty(true); setIntervals(data); },
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useEditSession.ts
git commit -m "feat: add timingDirty/speedsDirty tracking to useEditSession"
```

---

## Task 3: Add `applyDurationPreset` and `applySpeedPreset` to `useEditSession.ts`

**Files:**
- Modify: `src/hooks/useEditSession.ts`

- [ ] **Step 1: Add the import for presets at the top of the file**

Add to the existing imports block (after the last import line):

```typescript
import { type PresetLevel, DURATION_PRESETS, SPEED_PRESETS } from '../lib/presets';
```

- [ ] **Step 2: Add the two action functions inside `useEditSession`**

Place these two functions after the `removeInterval` function (before `openIntervalSpeedPicker`):

```typescript
  function applyDurationPreset(level: PresetLevel): void {
    const doApply = () => {
      const p = DURATION_PRESETS[level];
      setWarmup(p.warmup);
      setWork(p.work);
      setRest(p.rest);
      setRounds(p.rounds);
      setCooldown(p.cooldown);
      if (mode === 'advanced') {
        setIntervals(
          buildIntervalsFromEasy({
            warmup: p.warmup, high: p.work, low: p.rest,
            rounds: p.rounds, cooldown: p.cooldown,
          }).map(toLocal)
        );
      }
      setTimingDirty(false);
    };
    if (timingDirty) {
      Alert.alert(
        'Overwrite settings?',
        'Applying this preset will replace your current timing settings.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Apply', onPress: doApply }],
      );
    } else {
      doApply();
    }
  }

  function applySpeedPreset(level: PresetLevel): void {
    const doApply = () => {
      setRunSpeeds(SPEED_PRESETS[level]);
      setSpeedsDirty(false);
    };
    if (speedsDirty) {
      Alert.alert(
        'Overwrite settings?',
        'Applying this preset will replace your current speed settings.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Apply', onPress: doApply }],
      );
    } else {
      doApply();
    }
  }
```

- [ ] **Step 3: Add the two methods to `EditSessionInterface`**

In the `EditSessionInterface` type (starting at line 58), add before the closing `}`:

```typescript
  applyDurationPreset: (level: PresetLevel) => void;
  applySpeedPreset:    (level: PresetLevel) => void;
```

- [ ] **Step 4: Export the two methods in the `return` block**

Add at the end of the returned object (before the closing `}`):

```typescript
    applyDurationPreset,
    applySpeedPreset,
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useEditSession.ts
git commit -m "feat: add applyDurationPreset and applySpeedPreset actions"
```

---

## Task 4: Add preset strips to `EditSessionScreen.tsx`

**Files:**
- Modify: `src/screens/EditSessionScreen.tsx`

- [ ] **Step 1: Add the import for `PresetLevel` and the preset action types**

Add to the existing import from `'../hooks/useEditSession'`:

```typescript
import { useEditSession, type LocalInterval, type TimeField } from '../hooks/useEditSession';
import { type PresetLevel } from '../lib/presets';
```

(Just add `, type PresetLevel` to the presets import — or add a new import line for `presets`.)

Full updated import line:
```typescript
import { useEditSession, type LocalInterval, type TimeField } from '../hooks/useEditSession';
import { type PresetLevel } from '../lib/presets';
```

- [ ] **Step 2: Destructure the two new actions from `useEditSession`**

In the destructuring block (around line 53), add `applyDurationPreset, applySpeedPreset`:

```typescript
  const {
    draft, picker,
    setName,
    setActivityType,
    toggleMode,
    openFieldPicker, openRoundsPicker, openIntervalPicker, openSpeedPicker,
    openIntervalSpeedPicker, clearIntervalSpeed,
    cyclePhase, addInterval, duplicateInterval, removeInterval, clearIntervals, reorderIntervals,
    updatePicker, commitPicker, dismissPicker,
    applyDurationPreset, applySpeedPreset,
    save, deleteSession,
  } = useEditSession(existing, onBack);
```

- [ ] **Step 3: Add the `PresetStrip` component**

Add this component above the `IntervalRow` component (just before `// ── Interval row component`):

```typescript
// ── Preset strip ─────────────────────────────────────────────────────────────

const PRESET_LEVELS: { label: string; level: PresetLevel }[] = [
  { label: 'Easy',   level: 'easy'   },
  { label: 'Medium', level: 'medium' },
  { label: 'Hard',   level: 'hard'   },
];

function PresetStrip({
  onApply,
  T,
  styles,
}: {
  onApply: (level: PresetLevel) => void;
  T: ThemeTokens;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.presetStrip}>
      {PRESET_LEVELS.map(({ label, level }) => (
        <Pressable
          key={level}
          style={({ pressed }) => [
            styles.presetPill,
            pressed && { borderColor: T.accent, backgroundColor: withOpacity(T.accent, 0x14) },
          ]}
          onPress={() => onApply(level)}
        >
          <Text style={[styles.presetPillText, { color: T.subText }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Add `presetStrip` and `presetPill` styles to `makeStyles`**

Add inside `makeStyles`, after the `configGrid` styles block:

```typescript
  presetStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  presetPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: T.hairline,
    backgroundColor: T.ghostBg,
  },
  presetPillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 12 * 0.04,
  },
```

- [ ] **Step 5: Insert the duration preset strip in Easy mode**

In the Easy mode section (around line 203), the TIMING section currently renders only the `configGrid`. Add the `PresetStrip` immediately after the closing `</View>` of `configGrid`, still inside the `fieldGroup` `<View>`:

```tsx
          {/* Easy mode timing */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>TIMING</Text>
            <PresetStrip onApply={applyDurationPreset} T={T} styles={styles} />
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
```

- [ ] **Step 6: Insert the duration preset strip in Advanced mode**

In the Advanced mode section, the INTERVALS `fieldGroup` currently renders just the label and optional empty state. Add `PresetStrip` after the label:

```tsx
              {/* Intervals */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>INTERVALS</Text>
                <PresetStrip onApply={applyDurationPreset} T={T} styles={styles} />
                {intervals.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No intervals yet. Add one below.</Text>
                  </View>
                )}
              </View>
```

- [ ] **Step 7: Insert the speed preset strip**

The SPEEDS section (around line 231) is already guarded by `{isRun && !isAdvanced && ...}`. Add `PresetStrip` immediately after the `<Text style={styles.fieldLabel}>SPEEDS</Text>` line:

```tsx
          {isRun && !isAdvanced && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SPEEDS</Text>
              <PresetStrip onApply={applySpeedPreset} T={T} styles={styles} />
              <View style={styles.configGrid}>
                {speedFields.map(({ label, field }) => (
                  <View key={field} style={styles.configCell}>
                    <Text style={styles.configCellLabel}>{label}</Text>
                    <Pressable
                      style={styles.configInput}
                      onPress={() => {
                        const displayVal = isMiles
                          ? runSpeeds[field] * 0.621371
                          : runSpeeds[field];
                        openSpeedPicker(field, displayVal, isMiles);
                      }}
                    >
                      <Text style={styles.configInputText}>
                        {isMiles
                          ? (runSpeeds[field] * 0.621371).toFixed(1)
                          : runSpeeds[field].toFixed(1)}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/screens/EditSessionScreen.tsx
git commit -m "feat: add duration and speed preset strips to EditSessionScreen"
```

---

## Task 5: Manual verification

**Files:** (none — app testing)

- [ ] **Step 1: Start the app**

```bash
npx expo start --ios
```

- [ ] **Step 2: Test duration presets — Easy mode, fresh session**

1. Tap "New Session", leave it in Easy mode.
2. Tap "Easy" preset pill under TIMING → values should update to warmup 3:00, work 0:20, rest 0:40, rounds 14, cooldown 3:00. No alert should appear (not dirty).
3. Tap "Hard" preset → values update immediately (still not dirty after preset apply). No alert.

- [ ] **Step 3: Test overwrite alert — Easy mode**

1. Open a new session. Tap the Warmup field and change the value.
2. Tap "Medium" preset pill → alert "Overwrite settings?" should appear.
3. Tap Cancel → values unchanged.
4. Tap "Medium" again → alert appears, tap Apply → values update to medium preset.

- [ ] **Step 4: Test duration presets — Advanced mode**

1. Open a new session, toggle to Advanced mode.
2. Tap "Medium" preset under INTERVALS → interval list should populate with warmup/work×18/rest×18/cooldown pattern matching medium preset.
3. Make a change (add an interval), then tap "Easy" → overwrite alert should appear.

- [ ] **Step 5: Test speed presets — Run session**

1. Open a new session, set Activity Type to "Run".
2. Verify SPEEDS section shows the strip with Easy / Medium / Hard pills.
3. Tap "Hard" → speed fields update to warmup 7.0, work 14.0, rest 7.0, cooldown 6.0.
4. Open a speed picker and change a value, then tap "Easy" preset → overwrite alert appears.

- [ ] **Step 6: Test speed strip not shown for General sessions**

Open a new session with Activity Type "General" — SPEEDS section (and its preset strip) should not be visible.

- [ ] **Step 7: Test speed strip not shown in Advanced mode**

Open a Run session in Advanced mode — SPEEDS section should not be visible (advanced uses per-interval speeds), so speed preset strip is also hidden.

---

## Spec Coverage Check

| Spec requirement | Covered by |
|---|---|
| Duration presets Easy/Medium/Hard with warmup/work/rest/rounds/cooldown | Task 1, Task 3 |
| Speed presets Easy/Medium/Hard with warmup/work/rest/cooldown speeds | Task 1, Task 3 |
| One-shot pills (no persistent active state) | Task 4 — no state stored, `Pressable` pressed style only |
| Overwrite alert when timingDirty | Task 2, Task 3 |
| Overwrite alert when speedsDirty | Task 2, Task 3 |
| Alert copy: "Overwrite settings?" / "...timing settings." | Task 3 |
| Alert copy: "Overwrite settings?" / "...speed settings." | Task 3 |
| Cancel = no-op, Apply = proceeds | Task 3 |
| Duration strip below TIMING label (Easy mode) | Task 4, Step 5 |
| Duration strip below INTERVALS label (Advanced mode) | Task 4, Step 6 |
| Speed strip below SPEEDS label, Run sessions only | Task 4, Step 7 |
| Advanced mode: preset replaces interval list via buildIntervalsFromEasy | Task 3, Step 2 |
| No changes to Session type, WorkoutConfig, persistence, other screens | Confirmed — only 3 files touched |
