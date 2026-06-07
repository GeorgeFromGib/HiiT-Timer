# Done Letters Animation — Design Spec

**Date:** 2026-06-07
**Status:** Approved

## Overview

When the workout finishes and `status === 'finished'`, the "DONE" phase label animates in dramatically: each letter flies in from a different far-off position, rotating as it travels, and lands in place with a spring overshoot. Letters arrive in sequence (D → O → N → E) with a ~110ms stagger.

## Architecture

### New component: `src/components/DoneLetters.tsx`

- Accepts `color: string` and `style: TextStyle` props
- Renders a `flex row` container with four Reanimated `Animated.Text` children (one per letter: D, O, N, E)
- Uses `transform` (translateX, translateY, rotate) relative to each letter's natural flex position — when all transforms resolve to zero, the word reads "DONE" exactly where a plain `<Text>DONE</Text>` would sit
- Animation fires on mount (no explicit trigger prop needed)

### WorkoutScreen change

Replace line 141 in `src/screens/WorkoutScreen.tsx`:

```jsx
// before
{isDone ? 'DONE' : isPreStart ? 'GET READY' : meta.word}

// after — inside the same Text element's position, swap the string for the component
```

Because `isDone` drives a conditional render, `DoneLetters` mounts when the workout finishes and unmounts on reset — so the animation replays naturally each session.

The existing `styles.phaseLabel` style (color, font, textShadow) is passed into `DoneLetters` and applied to each letter so visual consistency is maintained.

## Animation Spec

| Letter | translateX start | translateY start | Rotation start | Stagger delay |
|--------|-----------------|-----------------|----------------|---------------|
| D      | −280            | −220            | −200°          | 0ms           |
| O      | +260            | −280            | +180°          | 110ms         |
| N      | +300            | +200            | −160°          | 220ms         |
| E      | −240            | +260            | +220°          | 330ms         |

**All values animate to:** translateX: 0, translateY: 0, rotate: '0deg'

**Spring config:** `{ mass: 0.7, damping: 11, stiffness: 140 }` — fast approach with a small organic overshoot.

**Opacity:** Each letter fades from 0 → 1 via `withTiming(1, { duration: 120 })` fired at the same stagger delay, so letters are invisible mid-flight and appear as they arrive.

**Total settle time:** ~700ms for all four letters.

## Implementation Notes

- Use `react-native-reanimated` v4.3.1 (already installed). Use `useSharedValue`, `useAnimatedStyle`, `withDelay`, `withSpring`, `withTiming`, and Reanimated's `Animated.Text`.
- `useEffect` with empty dep array triggers animation on mount.
- No new dependencies required.

## Out of Scope

- No animation on the `FinishedIcon` (checkmark badge) — letters only
- No sound/haptic changes
- No replay button or interaction with the animation
