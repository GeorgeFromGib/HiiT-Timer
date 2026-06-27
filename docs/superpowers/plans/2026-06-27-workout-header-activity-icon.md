# Workout Screen: Activity Type Icon in Header — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the `ActivityTypeIcon` in the right corner of the workout screen header, matching the EditSessionScreen pattern.

**Architecture:** Add one import and one `right` prop to the existing `ScreenHeader` call in `WorkoutScreen.tsx`. `ScreenHeader` already accepts a `right: ReactNode` slot; `ActivityTypeIcon` already handles all session types and picks its own theme color.

**Tech Stack:** React Native, TypeScript, Expo SDK 56.

## Global Constraints

- Touch only `src/screens/WorkoutScreen.tsx`.
- `size={32}` — matches EditSessionScreen.
- No new styles or components.
- No tests infrastructure exists — verify manually in the simulator.

---

### Task 1: Add ActivityTypeIcon to the workout screen header

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx` (import block and `ScreenHeader` JSX, around line 26 and line 170)

**Interfaces:**
- Consumes: `ActivityTypeIcon` from `'../components/ActivityTypeIcon'` — props: `mode: 'easy' | 'advanced' | 'circuit'`, `activityType?: 'run' | 'spinning'`, `size?: number`
- Consumes: `session.mode` (present on all session variants), `session.activityType` (only on easy/advanced variants)

- [ ] **Step 1: Add the import**

In `src/screens/WorkoutScreen.tsx`, find the existing import block. Add after the `WorkoutIcon` import:

```tsx
import ActivityTypeIcon from '../components/ActivityTypeIcon';
```

- [ ] **Step 2: Add the `right` prop to `ScreenHeader`**

Find the existing `ScreenHeader` call (around line 170):

```tsx
<ScreenHeader
  onBack={onBack}
  title={session.name}
  titleStyle={styles.headerTitle}
/>
```

Replace with:

```tsx
<ScreenHeader
  onBack={onBack}
  title={session.name}
  titleStyle={styles.headerTitle}
  right={
    <ActivityTypeIcon
      mode={session.mode}
      activityType={'activityType' in session ? session.activityType : undefined}
      size={32}
    />
  }
/>
```

- [ ] **Step 3: Verify in simulator**

Run:
```bash
npx expo start --ios
```

1. Open a spinning session and start it — confirm spinning icon appears in the top-right of the header.
2. Open a run session — confirm run icon appears.
3. Open a general session — confirm general icon appears.
4. Open a circuit session — confirm circuit (dumbbell) icon appears.
5. Confirm the icon color matches the theme (tidal and daybreak).

- [ ] **Step 4: Commit**

```bash
git add src/screens/WorkoutScreen.tsx
git commit -m "feat(spinning): show activity type icon in workout screen header"
```
