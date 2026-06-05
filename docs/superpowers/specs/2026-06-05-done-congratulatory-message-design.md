---
name: done-congratulatory-message
description: Random short congratulatory message shown below DONE text when workout finishes
metadata:
  type: project
---

# Done-State Congratulatory Message

## What

When a workout session finishes, a short congratulatory message appears below the "DONE" heading in `WorkoutScreen`. The message is chosen at random from a fixed list and is stable for the lifetime of that session (does not re-randomise on re-render).

## Message List

Twenty messages across three tone registers:

**Earned it**
- "You crushed it."
- "That's what you're made of."
- "Every rep counted."
- "Nothing left in the tank. Perfect."
- "Earned."

**Momentum**
- "That's the streak. Keep it."
- "One more session in the bank."
- "Progress doesn't lie."
- "You showed up. That's everything."
- "Tomorrow you'll be glad you did this."

**Playful**
- "Your future self says thanks."
- "Sweat well spent."
- "Rest. You've earned it."
- "Not bad at all."
- "The couch wasn't this good anyway."

**Understated**
- "Done. Well done."
- "Work complete."
- "That happened."
- "Check."
- "Session closed."

## Display

- Positioned immediately below the "DONE" `phaseLabel` text, inside the existing `phaseBlock` View.
- Font: `Inter_700Bold`, 18px, letter-spacing ~5%.
- Colour: `T.accent` at 0.7 opacity (secondary read vs the 44px "DONE" above it).
- Hidden when not in done state (same `{isDone && …}` guard as the surrounding done-state UI).

## Implementation

One change in `src/WorkoutScreen.tsx`:

1. Define `CONGRATS` — a `readonly string[]` constant at module scope containing the 20 messages.
2. Add a `congratsMsg` state value (initialised via `useState(() => CONGRATS[Math.floor(Math.random() * CONGRATS.length)])`). This runs once on mount so the message is stable for the session. If the user resets and re-finishes in the same mount, the same message shows — acceptable.
3. Render `{isDone && <Text style={styles.congratsMsg}>{congratsMsg}</Text>}` directly after the `phaseLabel` Text element.
4. Add `congratsMsg` to `StyleSheet.create`.

No new files, no new components. All changes confined to `WorkoutScreen.tsx`.
