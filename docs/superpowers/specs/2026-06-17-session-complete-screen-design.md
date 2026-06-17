# Session Complete Screen — Design Spec

**Date:** 2026-06-17  
**Branch:** done-screen  
**Status:** Approved

---

## Overview

When a HIIT session finishes (`status === 'finished'`), the workout timer UI is replaced in-place by a celebration screen. The screen lives inside `WorkoutScreen` as a conditional render — no new route is needed because all session stats are already in scope.

---

## Architecture

### Component

`src/screens/SessionCompleteScreen.tsx`

**Props:**
```ts
{
  session:  Session;    // for session.name in headline
  segments: Segment[];  // for PhaseStrip + ring arcs + stats
  totalDur: number;     // pre-computed total seconds (sum of all segment durations)
  onDone:   () => void; // navigates to Sessions list (calls onBack in WorkoutScreen)
  onRepeat: () => void; // resets engine + segments, returns to idle state
}
```

### Integration point

In `WorkoutScreen`, when `isDone === true`, render `<SessionCompleteScreen>` in place of the full workout UI. The `LinearGradient` root stays.

---

## Visual Layout (top to bottom)

### 1. Background
Same `LinearGradient` as the workout screen (`T.bgGradient`). An absolute-positioned large circular `View` at the top provides the radial accent glow (`T.accent` at ~13% opacity, blurred via large border radius).

### 2. Confetti
14 absolutely-positioned small shapes (circles and squares, alternating) cycling through phase colors (`warmup`, `work`, `rest`, `cooldown`). Each animates with `Animated.Value` on `translateY` (0 → screen height) and `opacity` (0 → 0.9 → 0), looping with staggered delays (`i * 180ms`). Skipped when `AccessibilityInfo.isReduceMotionEnabled()` returns true.

### 3. "WORKOUT COMPLETE" eyebrow
- Font: Inter 800, 11px, uppercase, letter-spacing 0.24em
- Color: `T.accent`
- Alignment: centered

### 4. Hero ring + checkmark
- `SegmentedRing` SVG component (188px diameter, stroke width 12) built with `react-native-svg`
- Arcs drawn per segment proportional to duration, each colored by `T.phases[segment.phase]`, all at 0.32 opacity (fully elapsed state)
- Centered inside the ring: a 96px circular View with `T.accent` background and a radial gradient-style glow shadow
- Inside that circle: checkmark SVG path (`M10 25l9.5 9.5L38 15`) stroked in `T.btnGlyph`
- Entry animation: spring scale `0.7 → 1` + opacity `0 → 1` on mount

### 5. Headline
- "Crushed it!" — Inter 900, 30px, letter-spacing -0.02em, `T.text`
- "You finished **[session.name]**" — Inter 600, 13.5px, `T.subText`; session name in Inter 800, `T.text`
- Alignment: centered
- Entry animation: `translateY(12 → 0)` + `opacity(0 → 1)`, delay 100ms

### 6. Stats row
Three equal-width ghost cards in a horizontal row, gap 9:

| Card | Value | Color |
|------|-------|-------|
| Total Time | `fmtTimer(totalDur)` | `T.accent` |
| Intervals | `segments.length` | `T.text` |
| Work Time | `fmtTimer(workSecs)` | `T.text` |

`workSecs` = sum of durations for segments where `phase === 'work' || phase === 'blast'`

Each card:
- Background: `T.card`, border: `T.hairline`, border-radius 16, padding 14/13
- Value: Chakra Petch 700, 25px, `tabular-nums`
- Label: Inter 700, 9.5px, uppercase, letter-spacing 0.12em, `T.faintText`

Entry animation: `translateY(12 → 0)` + `opacity(0 → 1)`, delay 180ms

### 7. Phase recap
- Label: "SESSION RECAP" — Inter 700, 10px, uppercase, letter-spacing 0.14em, `T.faintText`
- `<PhaseStrip segments={segments} />` (existing component, no changes)
- Entry animation: `translateY(12 → 0)` + `opacity(0 → 1)`, delay 260ms

### 8. Action buttons (pinned to bottom)
Vertical stack, gap 10, `marginTop: 'auto'`:

**DONE** (primary):
- Full width, padding 14px vertical, border-radius 16
- Background: `T.accent`, text: `T.btnGlyph`
- Font: Inter 800, 14.5px, uppercase, letter-spacing 0.05em
- Shadow: `buttonShadow(T)` + `shadowOffset {0, 10}` + `shadowOpacity 0.55`
- Action: `onDone()`

**REPEAT SESSION** (ghost):
- Full width, padding 13px vertical, border-radius 16
- Background: `T.ghostBg`, border: `T.hairline`
- Text: `T.subText`, Font: Inter 700, 13.5px, uppercase, letter-spacing 0.05em
- Prefix: reset SVG icon (same as WorkoutScreen reset button)
- Action: `onRepeat()`

---

## SegmentedRing Component

New file: `src/components/SegmentedRing.tsx`

**Props:**
```ts
{
  size:      number;    // outer diameter (188 on complete screen)
  stroke:    number;    // arc stroke width (12)
  segments:  Segment[]; // from workout lib
  totalDur:  number;    // sum of all durations
  gapDeg?:   number;    // gap between arcs in degrees (default 2.4)
}
```

Built with `react-native-svg` (`Svg`, `Path`, `Circle`, `Defs`, `Filter` from `react-native-svg`). All segments rendered at 0.32 opacity (complete state — no live progress handle needed on the done screen).

Arc math identical to the web design's `arcPath` / `polar` helpers (polar coordinates, clockwise from 12 o'clock).

---

## Animations

All entry animations use `Animated.timing` with `useNativeDriver: true` where possible (opacity + transform), firing sequentially on mount via `useEffect`.

| Element | Type | Duration | Delay | Easing |
|---------|------|----------|-------|--------|
| Ring + checkmark | Spring scale + opacity | — | 0ms | `spring({ tension: 100, friction: 8 })` |
| Eyebrow | Fade + slide up | 500ms | 0ms | ease |
| Headline | Fade + slide up | 500ms | 100ms | ease |
| Stats row | Fade + slide up | 500ms | 180ms | ease |
| Phase recap | Fade + slide up | 500ms | 260ms | ease |
| Confetti | Loop fall | 2.6–4.2s | staggered | linear |

Confetti is skipped if `AccessibilityInfo.isReduceMotionEnabled()` is true (checked once on mount).

---

## Files Changed

| File | Change |
|------|--------|
| `src/screens/SessionCompleteScreen.tsx` | New file |
| `src/components/SegmentedRing.tsx` | New file |
| `src/screens/WorkoutScreen.tsx` | Conditionally render `SessionCompleteScreen` when `isDone` |

No changes to `App.tsx`, `navigation.ts`, or the router.

---

## Out of Scope

- Share/export workout results
- Haptic feedback on complete (may be added later)
- Transition animation between workout screen and complete screen
