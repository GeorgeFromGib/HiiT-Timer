# Session Progression Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a user completes the same session 3 times, show a post-workout modal letting them choose which parameters to increase and whether to save it as a new session or overwrite the current one.

**Architecture:** A new `history_v1.json` file (same expo-file-system pattern as `sessions_v2.json`) records every full completion and every progression action. Pure helper functions expose the computation logic for testing. A two-step modal in WorkoutScreen handles the mastery notice and parameter editor flow.

**Tech Stack:** Expo SDK 56, expo-file-system (already installed), React Native Modal, jest-expo for tests.

## Global Constraints

- Only write to `history_v1.json` on full completion (`onFinish` fires) — bailing mid-session records nothing.
- Mastery threshold constant `MASTERY_THRESHOLD = 3`, defined once in `src/lib/history.ts`.
- Rest time floor = 5s, defined as `REST_FLOOR = 5` in `src/lib/sessions.ts`.
- New session name = `"${original.name} +"`. Update in-place keeps original name.
- After either progression action, record a progression event so the mastery clock resets.
- Navigates to Sessions list on confirm — does not auto-start the new/updated session.
- Fonts available: `Inter_600SemiBold`, `Inter_700Bold`, `Inter_700Bold_Italic`, `Inter_800ExtraBold`, `Inter_900Black`, `ChakraPetch_700Bold`.
- Theme tokens available on `T`: `text`, `subText`, `faintText`, `hairline`, `ghostBg`, `card`, `sheetBg`, `accent`, `btnGlyph`, `onBg`, `phases`.
- Use `newId()` from `src/lib/sessions.ts` for generating new session IDs.
- Follow the load/save pattern from `src/lib/sessions.ts`: `new File(Paths.document, filename)`, `f.exists`, `f.text()`, `f.write(JSON.stringify(...))`.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/lib/history.ts` | Types, load/save, pure helpers, async query/write API |
| Create | `src/__tests__/history.test.ts` | Tests for pure helpers in history.ts |
| Modify | `src/lib/sessions.ts` | Add `ProgressionAdjustments` type + `applyProgressionAdjustments()` |
| Create | `src/__tests__/sessions-progression.test.ts` | Tests for `applyProgressionAdjustments` |
| Create | `src/components/ProgressionModal.tsx` | Two-step post-workout modal UI |
| Modify | `src/screens/WorkoutScreen.tsx` | Record completions on finish, show modal, handle confirm |

---

### Task 1: Setup Jest + History Data Layer

**Files:**
- Create: `src/lib/history.ts`
- Create: `src/__tests__/history.test.ts`
- Modify: `package.json` (add jest config + test script)

**Interfaces:**
- Produces:
  - `export const MASTERY_THRESHOLD: number`
  - `export function _completionsSince(completions: CompletionRecord[], progressions: ProgressionEvent[], sessionId: string): number`
  - `export function _checkMastered(count: number): boolean`
  - `export async function recordCompletion(sessionId: string): Promise<void>`
  - `export async function recordProgression(sessionId: string): Promise<void>`
  - `export async function completionsSinceLastProgression(sessionId: string): Promise<number>`
  - `export async function isMastered(sessionId: string): Promise<boolean>`

- [ ] **Step 1: Install jest-expo and @types/jest**

```bash
npm install --save-dev jest-expo @types/jest
```

Expected output: packages added to devDependencies.

- [ ] **Step 2: Add jest config to package.json**

In `package.json`, add a `"jest"` key and a `"test"` script. The existing scripts block looks like:
```json
"scripts": {
  "start": "expo start",
  "android": "expo run:android",
  "ios": "expo run:ios",
  "web": "expo start --web"
}
```

Update it to:
```json
"scripts": {
  "start": "expo start",
  "android": "expo run:android",
  "ios": "expo run:ios",
  "web": "expo start --web",
  "test": "jest --watchAll=false"
},
"jest": {
  "preset": "jest-expo"
}
```

- [ ] **Step 3: Create `src/__tests__/` directory and write the failing tests**

Create `src/__tests__/history.test.ts`:

```typescript
import {
  MASTERY_THRESHOLD,
  _completionsSince,
  _checkMastered,
} from '../lib/history';

type CompletionRecord = { sessionId: string; completedAt: number };
type ProgressionEvent = { sessionId: string; actedAt: number };

describe('_completionsSince', () => {
  it('counts all completions when no progression events exist', () => {
    const completions: CompletionRecord[] = [
      { sessionId: 'a', completedAt: 1000 },
      { sessionId: 'a', completedAt: 2000 },
    ];
    expect(_completionsSince(completions, [], 'a')).toBe(2);
  });

  it('counts only completions after the most recent progression event', () => {
    const completions: CompletionRecord[] = [
      { sessionId: 'a', completedAt: 1000 },
      { sessionId: 'a', completedAt: 3000 },
    ];
    const progressions: ProgressionEvent[] = [
      { sessionId: 'a', actedAt: 2000 },
    ];
    expect(_completionsSince(completions, progressions, 'a')).toBe(1);
  });

  it('ignores completions for other sessions', () => {
    const completions: CompletionRecord[] = [
      { sessionId: 'b', completedAt: 1000 },
      { sessionId: 'b', completedAt: 2000 },
    ];
    expect(_completionsSince(completions, [], 'a')).toBe(0);
  });

  it('uses the most recent of multiple progression events', () => {
    const completions: CompletionRecord[] = [
      { sessionId: 'a', completedAt: 1000 },
      { sessionId: 'a', completedAt: 3000 },
      { sessionId: 'a', completedAt: 5000 },
    ];
    const progressions: ProgressionEvent[] = [
      { sessionId: 'a', actedAt: 2000 },
      { sessionId: 'a', actedAt: 4000 },
    ];
    expect(_completionsSince(completions, progressions, 'a')).toBe(1);
  });

  it('ignores progression events for other sessions', () => {
    const completions: CompletionRecord[] = [
      { sessionId: 'a', completedAt: 1000 },
      { sessionId: 'a', completedAt: 2000 },
    ];
    const progressions: ProgressionEvent[] = [
      { sessionId: 'b', actedAt: 500 },
    ];
    expect(_completionsSince(completions, progressions, 'a')).toBe(2);
  });
});

describe('_checkMastered', () => {
  it('returns false below threshold', () => {
    expect(_checkMastered(MASTERY_THRESHOLD - 1)).toBe(false);
  });

  it('returns true at exactly the threshold', () => {
    expect(_checkMastered(MASTERY_THRESHOLD)).toBe(true);
  });

  it('returns true above the threshold', () => {
    expect(_checkMastered(MASTERY_THRESHOLD + 5)).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests to confirm they fail**

```bash
npm test -- src/__tests__/history.test.ts
```

Expected: FAIL with "Cannot find module '../lib/history'"

- [ ] **Step 5: Create `src/lib/history.ts`**

```typescript
import { File, Paths } from 'expo-file-system';

export const MASTERY_THRESHOLD = 3;

type CompletionRecord = {
  sessionId: string;
  completedAt: number;
};

type ProgressionEvent = {
  sessionId: string;
  actedAt: number;
};

type HistoryFile = {
  completions: CompletionRecord[];
  progressions: ProgressionEvent[];
};

const HISTORY_FILENAME = 'history_v1.json';
const EMPTY_HISTORY: HistoryFile = { completions: [], progressions: [] };

function historyFile(): File {
  return new File(Paths.document, HISTORY_FILENAME);
}

async function loadHistory(): Promise<HistoryFile> {
  try {
    const f = historyFile();
    if (!f.exists) return { ...EMPTY_HISTORY };
    const raw = await f.text();
    return JSON.parse(raw) as HistoryFile;
  } catch {
    return { ...EMPTY_HISTORY };
  }
}

async function saveHistory(h: HistoryFile): Promise<void> {
  try {
    historyFile().write(JSON.stringify(h));
  } catch {}
}

export function _completionsSince(
  completions: CompletionRecord[],
  progressions: ProgressionEvent[],
  sessionId: string
): number {
  const lastProgression = progressions
    .filter(p => p.sessionId === sessionId)
    .sort((a, b) => b.actedAt - a.actedAt)[0];
  const since = lastProgression?.actedAt ?? 0;
  return completions.filter(c => c.sessionId === sessionId && c.completedAt > since).length;
}

export function _checkMastered(count: number): boolean {
  return count >= MASTERY_THRESHOLD;
}

export async function recordCompletion(sessionId: string): Promise<void> {
  const h = await loadHistory();
  h.completions.push({ sessionId, completedAt: Date.now() });
  await saveHistory(h);
}

export async function recordProgression(sessionId: string): Promise<void> {
  const h = await loadHistory();
  h.progressions.push({ sessionId, actedAt: Date.now() });
  await saveHistory(h);
}

export async function completionsSinceLastProgression(sessionId: string): Promise<number> {
  const h = await loadHistory();
  return _completionsSince(h.completions, h.progressions, sessionId);
}

export async function isMastered(sessionId: string): Promise<boolean> {
  const count = await completionsSinceLastProgression(sessionId);
  return _checkMastered(count);
}
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npm test -- src/__tests__/history.test.ts
```

Expected: PASS, 8 tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/lib/history.ts src/__tests__/history.test.ts package.json
git commit -m "feat: add history data layer with mastery threshold tracking"
```

---

### Task 2: Progression Adjustment Logic

**Files:**
- Modify: `src/lib/sessions.ts` (append after line 120 — after `deleteSessionById`)
- Create: `src/__tests__/sessions-progression.test.ts`

**Interfaces:**
- Consumes: `Session`, `Interval`, `WorkoutConfig` from `src/lib/sessions.ts`; `newId()` from `src/lib/sessions.ts`
- Produces:
  - `export type ProgressionAdjustments`
  - `export function applyProgressionAdjustments(session: Session, adj: ProgressionAdjustments, saveMode: 'new' | 'update'): Session`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/sessions-progression.test.ts`:

```typescript
import { applyProgressionAdjustments } from '../lib/sessions';
import type { Session } from '../lib/sessions';

const easySession: Session = {
  id: 'easy-id',
  name: 'Tabata',
  mode: 'easy',
  config: { warmup: 10, high: 20, low: 10, rounds: 8, cooldown: 10 },
};

const advancedSession: Session = {
  id: 'adv-id',
  name: 'Custom',
  mode: 'advanced',
  intervals: [
    { type: 'warmup',   dur: 10 },
    { type: 'work',     dur: 20 },
    { type: 'rest',     dur: 10 },
    { type: 'work',     dur: 20 },
    { type: 'rest',     dur: 10 },
    { type: 'cooldown', dur: 10 },
  ],
};

describe('applyProgressionAdjustments — easy mode', () => {
  it('adds rounds', () => {
    const result = applyProgressionAdjustments(easySession, { extraRounds: 2 }, 'update');
    expect(result.mode === 'easy' && result.config.rounds).toBe(10);
  });

  it('increases work time', () => {
    const result = applyProgressionAdjustments(easySession, { workTimeDelta: 10 }, 'update');
    expect(result.mode === 'easy' && result.config.high).toBe(30);
  });

  it('decreases rest time', () => {
    const result = applyProgressionAdjustments(easySession, { restTimeDelta: -5 }, 'update');
    expect(result.mode === 'easy' && result.config.low).toBe(5);
  });

  it('floors rest at 5s', () => {
    const result = applyProgressionAdjustments(easySession, { restTimeDelta: -15 }, 'update');
    expect(result.mode === 'easy' && result.config.low).toBe(5);
  });

  it('preserves id and name when saveMode is update', () => {
    const result = applyProgressionAdjustments(easySession, { extraRounds: 1 }, 'update');
    expect(result.id).toBe('easy-id');
    expect(result.name).toBe('Tabata');
  });

  it('generates new id and appends + to name when saveMode is new', () => {
    const result = applyProgressionAdjustments(easySession, { extraRounds: 1 }, 'new');
    expect(result.id).not.toBe('easy-id');
    expect(result.name).toBe('Tabata +');
  });

  it('applies multiple adjustments at once', () => {
    const result = applyProgressionAdjustments(
      easySession,
      { extraRounds: 1, workTimeDelta: 5, restTimeDelta: -5 },
      'update'
    );
    if (result.mode !== 'easy') throw new Error('expected easy mode');
    expect(result.config.rounds).toBe(9);
    expect(result.config.high).toBe(25);
    expect(result.config.low).toBe(5);
  });
});

describe('applyProgressionAdjustments — advanced mode', () => {
  it('increases all work interval durations', () => {
    const result = applyProgressionAdjustments(advancedSession, { workTimeDelta: 10 }, 'update');
    if (result.mode !== 'advanced') throw new Error('expected advanced mode');
    const workDurs = result.intervals.filter(iv => iv.type === 'work').map(iv => iv.dur);
    expect(workDurs).toEqual([30, 30]);
  });

  it('decreases all rest interval durations', () => {
    const result = applyProgressionAdjustments(advancedSession, { restTimeDelta: -5 }, 'update');
    if (result.mode !== 'advanced') throw new Error('expected advanced mode');
    const restDurs = result.intervals.filter(iv => iv.type === 'rest').map(iv => iv.dur);
    expect(restDurs).toEqual([5, 5]);
  });

  it('floors rest at 5s in advanced mode', () => {
    const result = applyProgressionAdjustments(advancedSession, { restTimeDelta: -20 }, 'update');
    if (result.mode !== 'advanced') throw new Error('expected advanced mode');
    const restDurs = result.intervals.filter(iv => iv.type === 'rest').map(iv => iv.dur);
    expect(restDurs).toEqual([5, 5]);
  });

  it('does not touch warmup or cooldown durations', () => {
    const result = applyProgressionAdjustments(
      advancedSession,
      { workTimeDelta: 10, restTimeDelta: -5 },
      'update'
    );
    if (result.mode !== 'advanced') throw new Error('expected advanced mode');
    expect(result.intervals.find(iv => iv.type === 'warmup')?.dur).toBe(10);
    expect(result.intervals.find(iv => iv.type === 'cooldown')?.dur).toBe(10);
  });

  it('adds +1 extra round by repeating last work+rest pair before cooldown', () => {
    const result = applyProgressionAdjustments(advancedSession, { extraRounds: 1 }, 'update');
    if (result.mode !== 'advanced') throw new Error('expected advanced mode');
    // Original: warmup(10), work(20), rest(10), work(20), rest(10), cooldown(10)  — 6 items
    // After +1: warmup(10), work(20), rest(10), work(20), rest(10), work(20), rest(10), cooldown(10) — 8 items
    expect(result.intervals).toHaveLength(8);
    expect(result.intervals[4]).toMatchObject({ type: 'rest',     dur: 10 });
    expect(result.intervals[5]).toMatchObject({ type: 'work',     dur: 20 });
    expect(result.intervals[6]).toMatchObject({ type: 'rest',     dur: 10 });
    expect(result.intervals[7]).toMatchObject({ type: 'cooldown', dur: 10 });
  });

  it('adds +2 extra rounds correctly', () => {
    const result = applyProgressionAdjustments(advancedSession, { extraRounds: 2 }, 'update');
    if (result.mode !== 'advanced') throw new Error('expected advanced mode');
    // 6 + (2 × 2) = 10 items
    expect(result.intervals).toHaveLength(10);
    expect(result.intervals[result.intervals.length - 1]).toMatchObject({ type: 'cooldown' });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- src/__tests__/sessions-progression.test.ts
```

Expected: FAIL with "applyProgressionAdjustments is not a function"

- [ ] **Step 3: Add `ProgressionAdjustments` type and `applyProgressionAdjustments` to `src/lib/sessions.ts`**

Append after the `deleteSessionById` function (after line 120):

```typescript
export type ProgressionAdjustments = {
  extraRounds?: number;
  workTimeDelta?: number;
  restTimeDelta?: number;
};

const REST_FLOOR = 5;

export function applyProgressionAdjustments(
  session: Session,
  adj: ProgressionAdjustments,
  saveMode: 'new' | 'update'
): Session {
  const id   = saveMode === 'new' ? newId() : session.id;
  const name = saveMode === 'new' ? `${session.name} +` : session.name;

  if (session.mode === 'easy') {
    const config = { ...session.config };
    if (adj.extraRounds   !== undefined) config.rounds += adj.extraRounds;
    if (adj.workTimeDelta !== undefined) config.high   += adj.workTimeDelta;
    if (adj.restTimeDelta !== undefined) config.low     = Math.max(REST_FLOOR, config.low + adj.restTimeDelta);
    return { ...session, id, name, config };
  }

  // advanced mode — map intervals then insert extra rounds
  let intervals: Interval[] = session.intervals.map(iv => {
    if (iv.type === 'work' && adj.workTimeDelta !== undefined) {
      return { ...iv, dur: iv.dur + adj.workTimeDelta };
    }
    if (iv.type === 'rest' && adj.restTimeDelta !== undefined) {
      return { ...iv, dur: Math.max(REST_FLOOR, iv.dur + adj.restTimeDelta) };
    }
    return { ...iv };
  });

  if (adj.extraRounds !== undefined && adj.extraRounds > 0) {
    const trailingCooldown = intervals[intervals.length - 1]?.type === 'cooldown';
    const insertAt = trailingCooldown ? intervals.length - 1 : intervals.length;

    // Find last work interval and the rest interval immediately after it
    let lastWorkIdx = -1;
    for (let i = intervals.length - 1; i >= 0; i--) {
      if (intervals[i].type === 'work') { lastWorkIdx = i; break; }
    }

    if (lastWorkIdx !== -1) {
      const pair: Interval[] = [{ ...intervals[lastWorkIdx] }];
      const afterWork = intervals[lastWorkIdx + 1];
      if (afterWork?.type === 'rest') pair.push({ ...afterWork });

      for (let r = 0; r < adj.extraRounds; r++) {
        intervals.splice(insertAt + r * pair.length, 0, ...pair.map(iv => ({ ...iv })));
      }
    }
  }

  return { ...session, id, name, intervals };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- src/__tests__/sessions-progression.test.ts
```

Expected: PASS, 11 tests passing.

- [ ] **Step 5: Run all tests to confirm nothing regressed**

```bash
npm test
```

Expected: PASS, all tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sessions.ts src/__tests__/sessions-progression.test.ts
git commit -m "feat: add applyProgressionAdjustments for easy and advanced session modes"
```

---

### Task 3: ProgressionModal Component

**Files:**
- Create: `src/components/ProgressionModal.tsx`

**Interfaces:**
- Consumes:
  - `applyProgressionAdjustments(session, adj, saveMode)` from `src/lib/sessions.ts`
  - `ProgressionAdjustments` type from `src/lib/sessions.ts`
  - `Session` type from `src/lib/sessions.ts`
  - `useTheme`, `ThemeTokens` from `src/theme.ts`
- Produces:
  - Default export `ProgressionModal` with props `{ visible, session, completionCount, onDismiss, onConfirm }`
  - `onConfirm` signature: `(result: Session, saveMode: 'new' | 'update') => void`

- [ ] **Step 1: Create `src/components/ProgressionModal.tsx`**

```typescript
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import {
  applyProgressionAdjustments,
  type ProgressionAdjustments,
} from '../lib/sessions';
import type { Session } from '../lib/sessions';

type SaveMode = 'new' | 'update';
type Step     = 'mastery' | 'editor';

type Props = {
  visible:         boolean;
  session:         Session;
  completionCount: number;
  onDismiss:       () => void;
  onConfirm:       (result: Session, saveMode: SaveMode) => void;
};

const ROUND_OPTIONS = [1, 2, 3] as const;
const WORK_OPTIONS  = [5, 10, 15] as const;
const REST_OPTIONS  = [-5, -10, -15] as const;
const REST_FLOOR    = 5;

export default function ProgressionModal({
  visible,
  session,
  completionCount,
  onDismiss,
  onConfirm,
}: Props) {
  const { T } = useTheme();

  const [step,        setStep]        = useState<Step>('mastery');
  const [saveMode,    setSaveMode]    = useState<SaveMode>('new');
  const [extraRounds, setExtraRounds] = useState<number | undefined>(undefined);
  const [workDelta,   setWorkDelta]   = useState<number | undefined>(undefined);
  const [restDelta,   setRestDelta]   = useState<number | undefined>(undefined);

  const adj: ProgressionAdjustments = {
    extraRounds,
    workTimeDelta: workDelta,
    restTimeDelta: restDelta,
  };
  const hasSelection =
    extraRounds !== undefined || workDelta !== undefined || restDelta !== undefined;

  function reset() {
    setStep('mastery');
    setSaveMode('new');
    setExtraRounds(undefined);
    setWorkDelta(undefined);
    setRestDelta(undefined);
  }

  function handleDismiss() {
    reset();
    onDismiss();
  }

  function handleConfirm() {
    const result = applyProgressionAdjustments(session, adj, saveMode);
    reset();
    onConfirm(result, saveMode);
  }

  function buildPreview(): string {
    const parts: string[] = [];
    if (session.mode === 'easy') {
      const { high, low, rounds } = session.config;
      if (extraRounds !== undefined) parts.push(`${rounds} → ${rounds + extraRounds} rounds`);
      if (workDelta   !== undefined) parts.push(`${high}s → ${high + workDelta}s work`);
      if (restDelta   !== undefined) parts.push(`${low}s → ${Math.max(REST_FLOOR, low + restDelta)}s rest`);
    } else {
      if (extraRounds !== undefined) parts.push(`+${extraRounds} round`);
      if (workDelta   !== undefined) parts.push(`+${workDelta}s work`);
      if (restDelta   !== undefined) parts.push(`${restDelta}s rest`);
    }
    return parts.join(', ');
  }

  const styles      = makeStyles(T);
  const previewText = buildPreview();
  const newName     = `${session.name} +`;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {step === 'mastery' ? (
            <>
              <Text style={styles.title}>Session mastered</Text>
              <Text style={styles.body}>
                You have completed &quot;{session.name}&quot; {completionCount} times. Ready to level up?
              </Text>
              <View style={styles.btnRow}>
                <Pressable style={styles.btnSecondary} onPress={handleDismiss}>
                  <Text style={styles.btnSecondaryText}>Not today</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={() => setStep('editor')}>
                  <Text style={styles.btnPrimaryText}>Let&apos;s go</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Make it harder</Text>

              <Text style={styles.paramLabel}>Rounds</Text>
              <View style={styles.chips}>
                {ROUND_OPTIONS.map(v => (
                  <Pressable
                    key={v}
                    style={[styles.chip, extraRounds === v && styles.chipActive]}
                    onPress={() => setExtraRounds(extraRounds === v ? undefined : v)}
                  >
                    <Text style={[styles.chipText, extraRounds === v && styles.chipTextActive]}>
                      +{v}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.paramLabel}>Work time</Text>
              <View style={styles.chips}>
                {WORK_OPTIONS.map(v => (
                  <Pressable
                    key={v}
                    style={[styles.chip, workDelta === v && styles.chipActive]}
                    onPress={() => setWorkDelta(workDelta === v ? undefined : v)}
                  >
                    <Text style={[styles.chipText, workDelta === v && styles.chipTextActive]}>
                      +{v}s
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.paramLabel}>Rest time</Text>
              <View style={styles.chips}>
                {REST_OPTIONS.map(v => (
                  <Pressable
                    key={v}
                    style={[styles.chip, restDelta === v && styles.chipActive]}
                    onPress={() => setRestDelta(restDelta === v ? undefined : v)}
                  >
                    <Text style={[styles.chipText, restDelta === v && styles.chipTextActive]}>
                      {v}s
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.paramLabel}>Save as</Text>
              {(['new', 'update'] as SaveMode[]).map(mode => (
                <Pressable
                  key={mode}
                  style={styles.radioRow}
                  onPress={() => setSaveMode(mode)}
                >
                  <View style={[styles.radioDot, saveMode === mode && styles.radioDotActive]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.radioLabel}>
                      {mode === 'new'
                        ? `New session — “${newName}”`
                        : `Update “${session.name}”`}
                    </Text>
                    {mode === 'update' && (
                      <Text style={styles.radioWarning}>
                        This will permanently change the session
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}

              {previewText ? (
                <Text style={styles.preview}>{previewText}</Text>
              ) : null}

              <View style={styles.btnRow}>
                <Pressable style={styles.btnSecondary} onPress={handleDismiss}>
                  <Text style={styles.btnSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.btnPrimary, !hasSelection && styles.btnDisabled]}
                  onPress={hasSelection ? handleConfirm : undefined}
                >
                  <Text style={styles.btnPrimaryText}>Confirm</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    overlay: {
      flex:            1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent:  'center',
      alignItems:      'center',
      paddingHorizontal: 24,
    },
    card: {
      width:           '100%',
      maxHeight:       '82%',
      backgroundColor: T.sheetBg,
      borderRadius:    20,
      padding:         24,
    },
    title: {
      fontFamily:   'Inter_800ExtraBold',
      fontSize:     22,
      color:        T.text,
      marginBottom: 12,
    },
    body: {
      fontFamily:   'Inter_600SemiBold',
      fontSize:     16,
      color:        T.subText,
      lineHeight:   24,
      marginBottom: 28,
    },
    paramLabel: {
      fontFamily:    'Inter_700Bold',
      fontSize:      13,
      letterSpacing: 13 * 0.08,
      color:         T.subText,
      marginBottom:  8,
      marginTop:     20,
    },
    chips: {
      flexDirection: 'row',
      gap:           8,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical:   9,
      borderRadius:      8,
      borderWidth:       1.5,
      borderColor:       T.hairline,
      backgroundColor:   T.ghostBg,
    },
    chipActive: {
      borderColor:     T.accent,
      backgroundColor: T.accent + '22',
    },
    chipText: {
      fontFamily: 'Inter_700Bold',
      fontSize:   15,
      color:      T.subText,
    },
    chipTextActive: {
      color: T.accent,
    },
    radioRow: {
      flexDirection: 'row',
      alignItems:    'flex-start',
      gap:           12,
      marginTop:     14,
    },
    radioDot: {
      width:       18,
      height:      18,
      borderRadius: 9,
      borderWidth:  2,
      borderColor:  T.hairline,
      marginTop:    2,
    },
    radioDotActive: {
      borderColor:     T.accent,
      backgroundColor: T.accent,
    },
    radioLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize:   15,
      color:      T.text,
    },
    radioWarning: {
      fontFamily: 'Inter_600SemiBold',
      fontSize:   13,
      color:      T.faintText,
      marginTop:  3,
    },
    preview: {
      fontFamily: 'Inter_600SemiBold',
      fontSize:   14,
      color:      T.accent,
      marginTop:  22,
    },
    btnRow: {
      flexDirection: 'row',
      gap:           12,
      marginTop:     28,
    },
    btnPrimary: {
      flex:            1,
      height:          48,
      borderRadius:    12,
      backgroundColor: T.accent,
      alignItems:      'center',
      justifyContent:  'center',
    },
    btnPrimaryText: {
      fontFamily: 'Inter_700Bold',
      fontSize:   16,
      color:      T.btnGlyph,
    },
    btnSecondary: {
      flex:         1,
      height:       48,
      borderRadius: 12,
      borderWidth:  1.5,
      borderColor:  T.hairline,
      alignItems:   'center',
      justifyContent: 'center',
    },
    btnSecondaryText: {
      fontFamily: 'Inter_700Bold',
      fontSize:   16,
      color:      T.subText,
    },
    btnDisabled: {
      opacity: 0.35,
    },
  });
}
```

- [ ] **Step 2: Manually verify the modal renders in the simulator**

This is deferred to Task 4 where it is wired into WorkoutScreen. No automated test needed — the component is purely presentational and driven by props.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProgressionModal.tsx
git commit -m "feat: add ProgressionModal two-step post-workout UI"
```

---

### Task 4: Wire WorkoutScreen

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx`

**Interfaces:**
- Consumes:
  - `recordCompletion`, `recordProgression`, `isMastered`, `completionsSinceLastProgression` from `src/lib/history.ts`
  - `loadSessions`, `saveSessions` from `src/lib/sessions.ts`
  - `ProgressionModal` from `src/components/ProgressionModal.tsx`
  - `Session` type from `src/lib/sessions.ts`

- [ ] **Step 1: Add imports to `src/screens/WorkoutScreen.tsx`**

After the existing import block (after line 26), add:

```typescript
import {
  recordCompletion,
  recordProgression,
  isMastered,
  completionsSinceLastProgression,
} from '../lib/history';
import { loadSessions, saveSessions } from '../lib/sessions';
import ProgressionModal from '../components/ProgressionModal';
```

- [ ] **Step 2: Add state and ref inside the `WorkoutScreen` component**

After the existing `const reviewTimerRef = useRef(...)` line (line 75), add:

```typescript
const hasRecordedCompletion = useRef(false);
const [progressionVisible, setProgressionVisible] = useState(false);
const [progressionCount,   setProgressionCount]   = useState(0);
```

- [ ] **Step 3: Add the mastery-check effect inside `WorkoutScreen`**

After the existing `useEffect` for `checkAndRequestReview` (lines 76–80), add:

```typescript
useEffect(() => {
  if (status !== 'finished' || hasRecordedCompletion.current) return;
  hasRecordedCompletion.current = true;
  (async () => {
    await recordCompletion(session.id);
    const mastered = await isMastered(session.id);
    if (mastered) {
      const count = await completionsSinceLastProgression(session.id);
      setProgressionCount(count);
      setProgressionVisible(true);
    }
  })();
}, [status]);
```

- [ ] **Step 4: Add the confirm handler inside `WorkoutScreen`**

After the `reset` function definition (line 68), add:

```typescript
async function handleProgressionConfirm(
  newSession: Session,
  saveMode: 'new' | 'update'
) {
  const sessions = await loadSessions();
  if (saveMode === 'new') {
    await saveSessions([...sessions, newSession]);
  } else {
    await saveSessions(sessions.map(s => s.id === session.id ? newSession : s));
  }
  await recordProgression(session.id);
  setProgressionVisible(false);
  onBack();
}
```

- [ ] **Step 5: Add `ProgressionModal` to the JSX**

The current `return` statement is a single `<LinearGradient>` element (line 121). Wrap it in a Fragment and add `ProgressionModal` after it:

```typescript
return (
  <>
    <LinearGradient colors={T.bgGradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.root}>
      {/* ... all existing content unchanged ... */}
    </LinearGradient>
    <ProgressionModal
      visible={progressionVisible}
      session={session}
      completionCount={progressionCount}
      onDismiss={() => setProgressionVisible(false)}
      onConfirm={handleProgressionConfirm}
    />
  </>
);
```

- [ ] **Step 6: Run the app and manually verify all success criteria**

Start the dev server:
```bash
npx expo start --ios
```

Work through each check:

| # | Check | Pass? |
|---|---|---|
| 1 | Finish a session → `history_v1.json` has a new completion record | |
| 2 | Press back mid-session → file unchanged | |
| 3 | Complete same session 3× → mastery modal appears | |
| 4 | "Not today" → modal closes, no progression event written | |
| 5 | In editor step, Confirm button is disabled until a chip is selected | |
| 6 | Select "New session" + one chip → Confirm → Sessions list shows `"[Name] +"` | |
| 7 | Select "Update this session" + one chip → Confirm → Sessions list has same count, session config changed | |
| 8 | Preview line updates live as chips are toggled | |
| 9 | Complete the session 2× after levelling up → no modal | |
| 10 | Complete the session a 3rd time after levelling up → modal appears again | |
| 11 | Rest −10s on a session with 10s rest → preview shows 5s | |
| 12 | Complete session A 2×, session B 1× → neither triggers modal | |

- [ ] **Step 7: Commit**

```bash
git add src/screens/WorkoutScreen.tsx
git commit -m "feat: wire progression modal into WorkoutScreen on session mastery"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| Record completion on `onFinish` only | Task 4 Step 3 |
| Mastery threshold of 3, named constant | Task 1 Step 5 |
| Progression event resets mastery clock | Task 1 Step 5 (`_completionsSince` uses `actedAt`) |
| Two-step modal: mastery notice → editor | Task 3 |
| Adjustable: rounds, work time, rest time | Task 3 (chips UI) |
| Single-select per parameter row | Task 3 (toggle: re-tap deselects) |
| Save as new session with `"Name +"` | Task 2 (`saveMode: 'new'`) |
| Update in-place keeping original name | Task 2 (`saveMode: 'update'`) |
| Confirm disabled until selection | Task 3 (`hasSelection` flag) |
| Update warning message | Task 3 (radioWarning) |
| Live preview line | Task 3 (`buildPreview()`) |
| Navigate to Sessions on confirm | Task 4 Step 4 (`onBack()`) |
| Rest floor 5s | Task 2 (`REST_FLOOR = 5`) |
| Easy mode: rounds, high, low adjustments | Task 2 Step 3 |
| Advanced mode: global work/rest delta + extra round pair | Task 2 Step 3 |
| Extra round inserts before trailing cooldown | Task 2 Step 3 |

### Placeholder scan

No TBD, TODO, or "implement later" language found.

### Type consistency

- `ProgressionAdjustments` defined in Task 2, consumed in Task 3 and Task 4 — consistent.
- `onConfirm: (result: Session, saveMode: 'new' | 'update') => void` defined in Task 3 props, called in Task 4 — consistent.
- `_completionsSince`, `_checkMastered` defined and exported in Task 1, used only in tests — consistent.
- `recordCompletion`, `recordProgression`, `isMastered`, `completionsSinceLastProgression` defined in Task 1, imported in Task 4 — consistent.
