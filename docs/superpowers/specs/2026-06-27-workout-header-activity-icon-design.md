# Workout Screen: Activity Type Icon in Header

**Date:** 2026-06-27

## Problem

The workout screen header shows only the session name. The edit screen already shows an `ActivityTypeIcon` in the header's right corner — the workout screen should match.

## Solution

Pass `ActivityTypeIcon` to `ScreenHeader`'s existing `right` slot in `WorkoutScreen`, using the same pattern as `EditSessionScreen`.

## Design

### Implementation

In `src/screens/WorkoutScreen.tsx`:

1. Add import:
```tsx
import ActivityTypeIcon from '../components/ActivityTypeIcon';
```

2. Add `right` prop to the existing `ScreenHeader`:
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

- `session.mode` is present on all session variants ('easy' | 'advanced' | 'circuit').
- `'activityType' in session` safely handles circuit sessions, which don't have `activityType`.
- `size={32}` matches EditSessionScreen.
- `ActivityTypeIcon` picks its own color from the theme — no color prop needed.

## Scope

Single file (`src/screens/WorkoutScreen.tsx`): one new import, one new prop on `ScreenHeader`. No new styles or components.
