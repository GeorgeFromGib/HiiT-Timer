# Countdown Flash Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Countdown flash" toggle to Settings so users can disable the full-screen flash that fires on the last 3 seconds of each interval.

**Architecture:** Add `countdownFlash: boolean` to the `Settings` type and `DEFAULT_SETTINGS` (default `true`). Wire a new toggle row into the Workout section of `SettingsScreen`. Guard the flash callback in `WorkoutScreen` behind the new setting — no changes to `useWorkoutSession` or `useTimerEngine`.

**Tech Stack:** React Native (Expo SDK 56), TypeScript, `expo-file-system` for settings persistence.

> **Note:** No test framework is configured. Each task uses manual verification via the Expo dev server instead of automated tests.

---

## File Map

| File | Change |
|---|---|
| `src/lib/settings.ts` | Add `countdownFlash` field to `Settings` interface and `DEFAULT_SETTINGS` |
| `src/screens/SettingsScreen.tsx` | Add `SRow` toggle for `countdownFlash` in the Workout section |
| `src/screens/WorkoutScreen.tsx` | Gate `setFlashing` call on `settings.countdownFlash` |

---

### Task 1: Add `countdownFlash` to the Settings type and defaults

**Files:**
- Modify: `src/lib/settings.ts`

- [ ] **Step 1: Add the field to the `Settings` interface**

In `src/lib/settings.ts`, add `countdownFlash: boolean` after `soundOff`:

```ts
export interface Settings {
  theme: ThemeKey;
  congratsMessage: boolean;
  finalCountdownBeep: boolean;
  keepScreenAwake: boolean;
  soundCues: boolean;
  soundOff: boolean;
  countdownFlash: boolean;
}
```

- [ ] **Step 2: Add the default value**

In the same file, add `countdownFlash: true` to `DEFAULT_SETTINGS`:

```ts
export const DEFAULT_SETTINGS: Settings = {
  theme: 'tidal',
  congratsMessage: true,
  finalCountdownBeep: true,
  keepScreenAwake: true,
  soundCues: true,
  soundOff: false,
  countdownFlash: true,
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/george/dev/react-native/hiit-timer && npx tsc --noEmit
```

Expected: no errors (or only pre-existing errors unrelated to `countdownFlash`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/settings.ts
git commit -m "feat: add countdownFlash setting (default true)"
```

---

### Task 2: Add the toggle row to SettingsScreen

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Add the new SRow in the Workout section**

In `src/screens/SettingsScreen.tsx`, the Workout `SSection` currently reads:

```tsx
<SSection title="Workout">
  <SRow
    label="Congratulatory message"
    sub="Full-screen celebration at workout end"
    right={<Toggle value={settings.congratsMessage} onChange={v => updateSettings('congratsMessage', v)} />}
  />
  <SRow
    label="Keep screen awake"
    sub="Prevent display sleep during workout"
    right={<Toggle value={settings.keepScreenAwake} onChange={v => updateSettings('keepScreenAwake', v)} />}
    last
  />
</SSection>
```

Replace it with (new row inserted between the two existing rows; `last` moves to the new row):

```tsx
<SSection title="Workout">
  <SRow
    label="Congratulatory message"
    sub="Full-screen celebration at workout end"
    right={<Toggle value={settings.congratsMessage} onChange={v => updateSettings('congratsMessage', v)} />}
  />
  <SRow
    label="Countdown flash"
    sub="Screen flash on last 3 seconds of each interval"
    right={<Toggle value={settings.countdownFlash} onChange={v => updateSettings('countdownFlash', v)} />}
  />
  <SRow
    label="Keep screen awake"
    sub="Prevent display sleep during workout"
    right={<Toggle value={settings.keepScreenAwake} onChange={v => updateSettings('keepScreenAwake', v)} />}
    last
  />
</SSection>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/george/dev/react-native/hiit-timer && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual verification — open Settings screen**

Start the dev server:
```bash
npx expo start --ios
```

Navigate to Settings. Confirm:
- "Countdown flash" row appears between "Congratulatory message" and "Keep screen awake"
- Toggle starts in the ON (right) position
- Toggling it animates correctly and persists after leaving and returning to Settings

- [ ] **Step 4: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: add Countdown flash toggle to Settings Workout section"
```

---

### Task 3: Gate the flash in WorkoutScreen

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx`

- [ ] **Step 1: Add the early-return guard to the flash callback**

In `src/screens/WorkoutScreen.tsx`, the callback passed as the third argument to `useWorkoutSession` currently reads:

```ts
() => {
  if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  setFlashing(true);
  flashTimerRef.current = setTimeout(() => setFlashing(false), 250);
}
```

Add a guard at the top:

```ts
() => {
  if (!settings.countdownFlash) return;
  if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  setFlashing(true);
  flashTimerRef.current = setTimeout(() => setFlashing(false), 250);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/george/dev/react-native/hiit-timer && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual verification — toggle off**

With the dev server running, navigate to Settings and turn "Countdown flash" OFF. Start a workout. Confirm:
- The screen does **not** flash during the last 3 seconds of any interval
- The audio countdown beep (if enabled) still fires normally

- [ ] **Step 4: Manual verification — toggle on**

Return to Settings and turn "Countdown flash" ON. Start a workout. Confirm:
- The screen **does** flash (gradient-swap) on each of the 3, 2, 1 countdown beats
- Toggling back to OFF mid-session takes effect immediately on the next beat

- [ ] **Step 5: Commit**

```bash
git add src/screens/WorkoutScreen.tsx
git commit -m "feat: gate countdown flash on countdownFlash setting"
```
