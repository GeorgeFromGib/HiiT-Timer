# Done Letters Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animate each letter of "DONE" flying in from a different direction with rotation and spring physics when the workout finishes.

**Architecture:** New `DoneLetters` component owns all animation logic — four `AnimatedLetter` sub-components each manage their own Reanimated shared values, firing on mount with staggered delays. WorkoutScreen swaps the plain `<Text>DONE</Text>` for `<DoneLetters>` when `isDone` is true; since `DoneLetters` only mounts on finish and unmounts on reset, the animation replays each session automatically.

**Tech Stack:** `react-native-reanimated` 4.3.1 (already installed), React Native `StyleProp<TextStyle>`

---

## File Map

- **Create:** `src/components/DoneLetters.tsx` — animated letter row component
- **Modify:** `src/screens/WorkoutScreen.tsx` — import and use DoneLetters when isDone

---

### Task 1: Create DoneLetters component

**Files:**
- Create: `src/components/DoneLetters.tsx`

- [ ] **Step 1: Create the file with this exact content**

```tsx
import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const SPRING_CONFIG = { mass: 0.7, damping: 11, stiffness: 140 };
const STAGGER = 110;

const LETTER_CONFIG = [
  { char: 'D', tx: -280, ty: -220, rot: -200, delay: 0           },
  { char: 'O', tx:  260, ty: -280, rot:  180, delay: STAGGER     },
  { char: 'N', tx:  300, ty:  200, rot: -160, delay: STAGGER * 2 },
  { char: 'E', tx: -240, ty:  260, rot:  220, delay: STAGGER * 3 },
] as const;

interface LetterProps {
  char: string;
  tx: number;
  ty: number;
  rot: number;
  delay: number;
  style?: StyleProp<TextStyle>;
}

function AnimatedLetter({ char, tx, ty, rot, delay, style }: LetterProps) {
  const translateX = useSharedValue(tx);
  const translateY = useSharedValue(ty);
  const rotate = useSharedValue(rot);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withDelay(delay, withSpring(0, SPRING_CONFIG));
    translateY.value = withDelay(delay, withSpring(0, SPRING_CONFIG));
    rotate.value = withDelay(delay, withSpring(0, SPRING_CONFIG));
    opacity.value = withDelay(delay, withTiming(1, { duration: 120 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return <Animated.Text style={[style, animStyle]}>{char}</Animated.Text>;
}

interface Props {
  style?: StyleProp<TextStyle>;
}

export default function DoneLetters({ style }: Props) {
  return (
    <View style={styles.row}>
      {LETTER_CONFIG.map(cfg => (
        <AnimatedLetter key={cfg.char} {...cfg} style={style} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DoneLetters.tsx
git commit -m "feat: add DoneLetters animated component"
```

---

### Task 2: Integrate DoneLetters into WorkoutScreen

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx:26` (imports)
- Modify: `src/screens/WorkoutScreen.tsx:137-142` (phase label render)

- [ ] **Step 1: Add the import after the existing FinishedIcon import (line 26)**

Add this line after `import FinishedIcon from '../components/FinishedIcon';`:

```tsx
import DoneLetters from '../components/DoneLetters';
```

- [ ] **Step 2: Replace the phase label Text block (lines 137–142)**

Find this block:
```tsx
          <Text style={[styles.phaseLabel, {
            color:           isDone ? GOLD : isPreStart ? T.accent : phaseColor,
            textShadowColor: withOpacity(isDone ? GOLD : isPreStart ? T.accent : phaseColor, 0x55),
          }]}>
            {isDone ? 'DONE' : isPreStart ? 'GET READY' : meta.word}
          </Text>
```

Replace with:
```tsx
          {isDone ? (
            <DoneLetters style={[styles.phaseLabel, {
              color: GOLD,
              textShadowColor: withOpacity(GOLD, 0x55),
            }]} />
          ) : (
            <Text style={[styles.phaseLabel, {
              color:           isPreStart ? T.accent : phaseColor,
              textShadowColor: withOpacity(isPreStart ? T.accent : phaseColor, 0x55),
            }]}>
              {isPreStart ? 'GET READY' : meta.word}
            </Text>
          )}
```

- [ ] **Step 3: Run the app and verify**

```bash
npx expo start --ios
```

Expected behaviour:
1. Start a session and run to completion
2. When the timer hits zero, D flies in first (from top-left, rotating), then O (top-right), N (bottom-right), E (bottom-left) — each ~110ms apart
3. All four letters settle into the word "DONE" with a small spring overshoot
4. "GET READY" and phase labels during the workout are unchanged
5. Resetting and running again replays the animation cleanly

- [ ] **Step 4: Commit**

```bash
git add src/screens/WorkoutScreen.tsx
git commit -m "feat: use DoneLetters animation when workout finishes"
```
