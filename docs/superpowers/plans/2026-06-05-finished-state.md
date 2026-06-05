# Finished State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an accent-coloured "DONE" finished state in the workout screen phase block when the interval session completes.

**Architecture:** Add a `FinishedIcon` component (checkmark SVG) following the same props interface as `ReadyIcon`. In `WorkoutScreen.tsx`, add `isDone` branches parallel to the existing `isPreStart` branches — swapping the icon, label text, colour, and hiding the countdown row, interval counter, progress bar, and next-up row when finished.

**Tech Stack:** React Native, react-native-svg, Expo SDK 56, TypeScript

---

### Task 1: Create FinishedIcon component

**Files:**
- Create: `src/components/FinishedIcon.tsx`

- [ ] **Step 1: Create the file**

```tsx
import React from 'react';
import Svg, { G, Path, Circle } from 'react-native-svg';

interface Props {
  color: string;
  size?: number;
}

export default function FinishedIcon({ color, size = 23 }: Props) {
  const p = {
    fill: 'none', stroke: color, strokeWidth: 2.2,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G {...p}>
        <Circle cx="12" cy="12" r="9" />
        <Path d="M8 12.5l2.5 2.5 5.5-5.5" />
      </G>
    </Svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FinishedIcon.tsx
git commit -m "feat: add FinishedIcon checkmark component"
```

---

### Task 2: Wire finished state into WorkoutScreen

**Files:**
- Modify: `src/WorkoutScreen.tsx`

The `isDone` variable is already defined at line 116:
```ts
const isDone = state.status === 'finished';
```

- [ ] **Step 1: Import FinishedIcon**

At the top of `src/WorkoutScreen.tsx`, after the existing `ReadyIcon` import (line 23), add:

```tsx
import FinishedIcon from './components/FinishedIcon';
```

- [ ] **Step 2: Update the icon badge**

Find the icon badge block (lines 148–155):
```tsx
<View style={[styles.iconBadge, {
  backgroundColor: (isPreStart ? T.accent : meta.color) + '22',
  borderColor:     (isPreStart ? T.accent : meta.color) + '55',
}]}>
  {isPreStart
    ? <ReadyIcon color={T.accent} size={30} />
    : <PhaseIcon phase={seg.phase} color={meta.color} size={30} />
  }
</View>
```

Replace with:
```tsx
<View style={[styles.iconBadge, {
  backgroundColor: (isPreStart || isDone ? T.accent : meta.color) + '22',
  borderColor:     (isPreStart || isDone ? T.accent : meta.color) + '55',
}]}>
  {isDone
    ? <FinishedIcon color={T.accent} size={30} />
    : isPreStart
      ? <ReadyIcon color={T.accent} size={30} />
      : <PhaseIcon phase={seg.phase} color={meta.color} size={30} />
  }
</View>
```

- [ ] **Step 3: Update the phase label**

Find the phase label (lines 158–163):
```tsx
<Text style={[styles.phaseLabel, {
  color:           isPreStart ? T.accent : meta.color,
  textShadowColor: (isPreStart ? T.accent : meta.color) + '55',
}]}>
  {isPreStart ? 'GET READY' : meta.word}
</Text>
```

Replace with:
```tsx
<Text style={[styles.phaseLabel, {
  color:           (isPreStart || isDone) ? T.accent : meta.color,
  textShadowColor: ((isPreStart || isDone) ? T.accent : meta.color) + '55',
}]}>
  {isDone ? 'DONE' : isPreStart ? 'GET READY' : meta.word}
</Text>
```

- [ ] **Step 4: Hide countdown row when done**

Find the countdown row (lines 165–179):
```tsx
<View style={styles.countdownRow}>
  {displayCountdown.split('').map((ch, i) => (
    ...
  ))}
</View>
```

Wrap it:
```tsx
{!isDone && (
  <View style={styles.countdownRow}>
    {displayCountdown.split('').map((ch, i) => (
      <Text
        key={i}
        style={[styles.countdown, {
          textShadowColor: (isPreStart ? T.accent : meta.color) + '3a',
          fontSize: countdownFontSize,
          lineHeight: countdownFontSize,
          width: ch === ':' ? countdownFontSize * 0.28 : countdownFontSize * 0.62,
        }]}
      >
        {ch}
      </Text>
    ))}
  </View>
)}
```

- [ ] **Step 5: Hide interval counter and progress bar when done**

Find the interval counter (line 181):
```tsx
<Text style={[styles.intervalCounter, isPreStart && { opacity: 0 }]}>
```

Replace with:
```tsx
{!isDone && (
  <Text style={[styles.intervalCounter, isPreStart && { opacity: 0 }]}>
    {'INTERVAL '}
    <Text style={{ color: 'white' }}>{intervalNum}</Text>
    {` OF ${SEGMENTS.length}`}
  </Text>
)}
```

Find the progress track (lines 187–201):
```tsx
<View style={[styles.progressTrack, isPreStart && { opacity: 0 }]}>
  <Animated.View
    style={[
      styles.progressFill,
      {
        backgroundColor: meta.color,
        shadowColor:     meta.color,
        width: progressAnim.interpolate({
          inputRange:  [0, 1],
          outputRange: ['0%', '100%'],
        }),
      },
    ]}
  />
</View>
```

Replace with:
```tsx
{!isDone && (
  <View style={[styles.progressTrack, isPreStart && { opacity: 0 }]}>
    <Animated.View
      style={[
        styles.progressFill,
        {
          backgroundColor: meta.color,
          shadowColor:     meta.color,
          width: progressAnim.interpolate({
            inputRange:  [0, 1],
            outputRange: ['0%', '100%'],
          }),
        },
      ]}
    />
  </View>
)}
```

- [ ] **Step 6: Show all timeline segments at full opacity when done**

The timeline renders completed segments at 0.28 opacity and the active segment with an animated fill. When `isDone`, all segments should appear at full opacity (everything was completed).

Find the segment rendering inside the `SEGMENTS.map` block (around line 224). The two variables at the top of the map callback are:
```tsx
const isActive    = i === state.currentIndex;
const isCompleted = state.currentIndex > 0 && i < state.currentIndex;
```

Replace them with:
```tsx
const isActive    = !isDone && i === state.currentIndex;
const isCompleted = !isDone && state.currentIndex > 0 && i < state.currentIndex;
```

This means when finished: `isActive` is always false, `isCompleted` is always false, and every segment falls through to the plain `<View>` branch with `opacity: 1.0` (the else branch's default). The marker stays at the far right because `chevronLeft` is driven by `progressAnim` which is already at 0 when remaining = 0, mapping to `segEndPct` of the last segment.

- [ ] **Step 7: Hide next-up row when done**

Find the next-up row (lines 204–218):
```tsx
{/* ── Next up row ── */}
<View style={styles.nextUpRow}>
  {nextMeta ? (
    ...
  ) : (
    <Text style={[styles.nextPhase, { color: meta.color }]}>FINISH</Text>
  )}
</View>
```

Wrap it:
```tsx
{/* ── Next up row ── */}
{!isDone && (
  <View style={styles.nextUpRow}>
    {nextMeta ? (
      <>
        <Text style={styles.nextLabel}>NEXT</Text>
        <Text style={[styles.nextLabel, { marginHorizontal: 4 }]}>→</Text>
        <PhaseIcon phase={nextSeg!.phase} color={nextMeta.color} size={20} />
        <Text style={[styles.nextPhase, { color: nextMeta.color, marginLeft: 5 }]}>
          {nextMeta.word}
        </Text>
      </>
    ) : (
      <Text style={[styles.nextPhase, { color: meta.color }]}>FINISH</Text>
    )}
  </View>
)}
```

- [ ] **Step 8: Commit**

```bash
git add src/WorkoutScreen.tsx
git commit -m "feat: show accent-coloured DONE state when workout finishes"
```

---

### Task 3: Verify in the app

- [ ] **Step 1: Start the dev server**

```bash
npx expo start
```

Open in a simulator or device. Start a short session (edit `DEMO` in `WorkoutScreen.tsx` temporarily to use a 3-second work interval if needed).

- [ ] **Step 2: Let the session finish**

Confirm:
- Phase block shows checkmark icon in accent teal (`#3ad6c6`)
- Label reads "DONE" in accent teal
- No countdown digits visible
- No interval counter visible
- No progress bar visible
- Next-up row is hidden
- Timeline bar shows all segments at full opacity
- Reset button still works (restarts the pre-start countdown)
- Skip button is disabled

- [ ] **Step 3: Commit if any tweaks were needed**

```bash
git add -p
git commit -m "fix: tweak finished state appearance"
```
