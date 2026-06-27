# Sustained Haptic Burst Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-tap haptic on phase transitions with a 2-second burst (~14 taps at 150ms intervals).

**Architecture:** Add a `hapticBurstRef` to track the active interval and a `startHapticBurst` helper inside `useWorkoutSession`. The helper cancels any in-flight burst before starting a new one. Cleanup is hooked into the existing `reset` path.

**Tech Stack:** `expo-haptics` (already installed), React `useRef`

## Global Constraints

- No new dependencies — `expo-haptics` is already imported in `useWorkoutSession.ts`
- No tests configured in this project — verification is manual on a dev build (Expo Go does not support haptics)
- Touch only `src/hooks/useWorkoutSession.ts`

---

### Task 1: Replace single-tap haptic with sustained burst

**Files:**
- Modify: `src/hooks/useWorkoutSession.ts`

**Interfaces:**
- Consumes: `settings.hapticFeedback: boolean`, `Haptics.impactAsync`, `Haptics.ImpactFeedbackStyle.Medium`
- Produces: no new exports — internal change only

- [ ] **Step 1: Add `hapticBurstRef` below the existing refs near the top of `useWorkoutSession`**

In `src/hooks/useWorkoutSession.ts`, after the `onCountdownBeatRef` declaration (line ~46), add:

```ts
const hapticBurstRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

- [ ] **Step 2: Add the `startHapticBurst` helper inside the function body, before the `useTimerEngine` call**

```ts
function startHapticBurst() {
  if (hapticBurstRef.current) clearInterval(hapticBurstRef.current);
  let count = 0;
  hapticBurstRef.current = setInterval(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    count++;
    if (count >= 14) {
      clearInterval(hapticBurstRef.current!);
      hapticBurstRef.current = null;
    }
  }, 150);
}
```

- [ ] **Step 3: Replace the single `impactAsync` call in `onTransition` with `startHapticBurst()`**

Find this block inside `useTimerEngine(segments, { onTransition: ... })`:

```ts
if (to !== null && settings.hapticFeedback) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
```

Replace with:

```ts
if (to !== null && settings.hapticFeedback) {
  startHapticBurst();
}
```

- [ ] **Step 4: Cancel the burst in `reset`**

Find the existing `reset` callback:

```ts
const reset = useCallback(() => {
  countdown.cancel();
  cues.stopKeepAlive();
  engineReset();
}, [countdown, cues, engineReset]);
```

Replace with:

```ts
const reset = useCallback(() => {
  if (hapticBurstRef.current) {
    clearInterval(hapticBurstRef.current);
    hapticBurstRef.current = null;
  }
  countdown.cancel();
  cues.stopKeepAlive();
  engineReset();
}, [countdown, cues, engineReset]);
```

- [ ] **Step 5: Manual verification on a dev build**

Haptics do not fire in Expo Go — test on a physical device via `npx eas build --profile development --platform ios`.

Check:
1. Start a workout — vibration lasts ~2 seconds on the first phase transition
2. Let multiple transitions fire — each gets a fresh burst (previous one cancels)
3. Reset mid-burst — vibration stops immediately
4. Toggle haptic feedback off in Settings — no vibration on transitions

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useWorkoutSession.ts
git commit -m "feat(haptics): sustain vibration for ~2s on phase transition"
```
