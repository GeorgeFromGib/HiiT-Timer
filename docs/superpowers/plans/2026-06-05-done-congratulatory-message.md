# Done-State Congratulatory Message Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a randomly chosen short congratulatory message below the "DONE" heading when a workout session finishes.

**Architecture:** A module-scope `CONGRATS` string array is added to `WorkoutScreen.tsx`. A single `useState` initialiser picks one entry at random when the component mounts (stable for the session). The message is conditionally rendered below the existing `phaseLabel` Text element using the same `isDone` guard already in use throughout the component.

**Tech Stack:** React Native (`Text`, `StyleSheet`), existing `T` theme tokens, `Inter_700Bold` font already loaded.

---

### Task 1: Add the CONGRATS constant and congratsMsg state

**Files:**
- Modify: `src/WorkoutScreen.tsx`

> Note: there is no test suite in this project. Manual verification steps are provided instead.

- [ ] **Step 1: Add the `CONGRATS` constant at module scope**

Open `src/WorkoutScreen.tsx`. Directly above the `tfmt` function (line 27), add:

```typescript
const CONGRATS = [
  "You crushed it.",
  "That's what you're made of.",
  "Every rep counted.",
  "Nothing left in the tank. Perfect.",
  "Earned.",
  "That's the streak. Keep it.",
  "One more session in the bank.",
  "Progress doesn't lie.",
  "You showed up. That's everything.",
  "Tomorrow you'll be glad you did this.",
  "Your future self says thanks.",
  "Sweat well spent.",
  "Rest. You've earned it.",
  "Not bad at all.",
  "The couch wasn't this good anyway.",
  "Done. Well done.",
  "Work complete.",
  "That happened.",
  "Check.",
  "Session closed.",
] as const;
```

- [ ] **Step 2: Add `congratsMsg` state inside the component**

Inside `WorkoutScreen`, add this line alongside the other `useState` calls (after the `preStartCount` state, around line 57):

```typescript
const [congratsMsg] = useState(
  () => CONGRATS[Math.floor(Math.random() * CONGRATS.length)]
);
```

The lazy initialiser runs once on mount — the message is stable even if the component re-renders.

- [ ] **Step 3: Render the message below the DONE phaseLabel**

Locate the `phaseLabel` Text element (around line 161). Immediately after the closing `</Text>` tag for `phaseLabel`, add:

```tsx
{isDone && (
  <Text style={styles.congratsMsg}>{congratsMsg}</Text>
)}
```

The full block in context should read:

```tsx
<Text style={[styles.phaseLabel, {
  color:           (isPreStart || isDone) ? T.accent : meta.color,
  textShadowColor: ((isPreStart || isDone) ? T.accent : meta.color) + '55',
}]}>
  {isDone ? 'DONE' : isPreStart ? 'GET READY' : meta.word}
</Text>

{isDone && (
  <Text style={styles.congratsMsg}>{congratsMsg}</Text>
)}
```

- [ ] **Step 4: Add the `congratsMsg` style to StyleSheet.create**

Inside the `StyleSheet.create({…})` block at the bottom of the file, add after `phaseLabel`:

```typescript
congratsMsg: {
  fontFamily:    'Inter_700Bold',
  fontSize:      18,
  letterSpacing: 18 * 0.05,
  color:         T.accent,
  opacity:       0.7,
  textAlign:     'center',
},
```

- [ ] **Step 5: Verify manually**

Start the dev server (`npx expo start`) and run on a simulator or device. Let a short session finish (or temporarily shorten segment durations in the `DEMO` config). Confirm:
- A short message appears below "DONE" in the accent colour.
- The message does not change on re-render (e.g., backgrounding/foregrounding the app).
- A different message may appear on a fresh app launch (random).
- The message does not appear during active or idle states.

- [ ] **Step 6: Commit**

```bash
git add src/WorkoutScreen.tsx
git commit -m "feat: show random congratulatory message on workout completion"
```
