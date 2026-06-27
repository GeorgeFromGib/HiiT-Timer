# Activity Type Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a small activity-type icon before the session name in `SessionCard` for immediate visual recognition.

**Architecture:** Create a new `ActivityTypeIcon` component with four inline SVG variants (general, run, circuit, spinning), then integrate it into `SessionCard` before the title text. No new dependencies — uses existing `react-native-svg` and `BASE_SVG_STROKE` pattern from `WorkoutIcon.tsx`.

**Tech Stack:** React Native, `react-native-svg`, TypeScript

## Global Constraints

- No test framework is configured — all testing is manual via the Expo dev server
- Follow existing SVG icon pattern: 24×24 viewBox, stroke-based, `BASE_SVG_STROKE` props spread onto SVG elements
- `BASE_SVG_STROKE` is exported from `src/components/WorkoutIcon.tsx` as `{ fill: 'none', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }`
- `Session` type has three union members: `mode: 'easy'`, `mode: 'advanced'`, `mode: 'circuit'`; `activityType` is only present on easy/advanced
- Do not modify any file except the two listed below

---

### Task 1: Create `ActivityTypeIcon` component

**Files:**
- Create: `src/components/ActivityTypeIcon.tsx`

**Interfaces:**
- Consumes: `BASE_SVG_STROKE` from `src/components/svgStroke.ts`; `Session` type from `src/lib/sessions.ts`
- Produces: `ActivityTypeIcon` default export with props `{ activityType?: 'run' | 'spinning'; mode: 'easy' | 'advanced' | 'circuit'; size?: number; color: string }`

- [ ] **Step 1: Create the component file**

Create `src/components/ActivityTypeIcon.tsx` with the following content:

```tsx
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { BASE_SVG_STROKE } from './svgStroke';

interface Props {
  activityType?: 'run' | 'spinning';
  mode: 'easy' | 'advanced' | 'circuit';
  size?: number;
  color: string;
}

export default function ActivityTypeIcon({ activityType, mode, size = 16, color }: Props) {
  const p = { ...BASE_SVG_STROKE, stroke: color };

  if (mode === 'circuit') {
    // Repeat/loop arrows
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path {...p} d="M17 1l4 4-4 4" />
        <Path {...p} d="M3 11V9a4 4 0 0 1 4-4h14" />
        <Path {...p} d="M7 23l-4-4 4-4" />
        <Path {...p} d="M21 13v2a4 4 0 0 1-4 4H3" />
      </Svg>
    );
  }

  if (activityType === 'run') {
    // Simplified running figure: head + body in motion
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="14" cy="4" r="1.5" stroke={color} fill="none" strokeWidth={2.2} />
        <Path {...p} d="M12 6.5l-3 5 3.5 2-3 5" />
        <Path {...p} d="M12 6.5l2.5 3.5-3.5 1.5" />
      </Svg>
    );
  }

  if (activityType === 'spinning') {
    // Bicycle wheel: outer rim, hub, 4 spokes (N/S/E/W)
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="9" stroke={color} fill="none" strokeWidth={2.2} />
        <Circle cx="12" cy="12" r="2" stroke={color} fill="none" strokeWidth={2.2} />
        <Path {...p} d="M12 3v7M12 14v7M3 12h7M14 12h7" />
      </Svg>
    );
  }

  // General HIIT: lightning bolt / zap
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...p} d="M13 2L3 14h9l-1 8 10-12h-9z" />
    </Svg>
  );
}
```

- [ ] **Step 2: Manually verify the component compiles**

Start the dev server:
```bash
npx expo start --ios
```

The app should launch without TypeScript errors. No visual check yet — the component isn't used anywhere.

- [ ] **Step 3: Commit**

```bash
git add src/components/ActivityTypeIcon.tsx
git commit -m "feat: add ActivityTypeIcon component (general/run/circuit/spinning)"
```

---

### Task 2: Integrate icon into `SessionCard`

**Files:**
- Modify: `src/components/SessionCard.tsx`

**Interfaces:**
- Consumes: `ActivityTypeIcon` from `./ActivityTypeIcon`

- [ ] **Step 1: Add the import**

In `src/components/SessionCard.tsx`, add after the existing imports:

```tsx
import ActivityTypeIcon from './ActivityTypeIcon';
```

- [ ] **Step 2: Wrap the title in a row with the icon**

Find this block (around line 47):

```tsx
<View style={styles.left}>
  <Text style={styles.title}>{session.name}</Text>
</View>
```

Replace it with:

```tsx
<View style={styles.left}>
  <View style={styles.titleRow}>
    <ActivityTypeIcon
      activityType={session.mode !== 'circuit' ? session.activityType : undefined}
      mode={session.mode}
      size={16}
      color={T.subText}
    />
    <Text style={styles.title}>{session.name}</Text>
  </View>
</View>
```

- [ ] **Step 3: Add `titleRow` style**

In `makeStyles`, add after the `left` style:

```ts
titleRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
},
```

- [ ] **Step 4: Manually verify all four icons render**

With the dev server running (`npx expo start --ios`), navigate to the Sessions List screen and confirm:

1. A default general session shows a **lightning bolt** before its name
2. The default run session ("5K Pace Trainer" or similar) shows a **running figure**
3. The default circuit session shows **repeat arrows**
4. The default spinning session shows a **bicycle wheel**

Check both Tidal (dark) and Daybreak (light) themes in Settings — the `subText` color should be readable in both.

If any icon shape looks wrong or unrecognisable, tweak the SVG paths in `ActivityTypeIcon.tsx` and hot-reload to verify.

- [ ] **Step 5: Commit**

```bash
git add src/components/SessionCard.tsx
git commit -m "feat: show activity type icon before session name in SessionCard"
```
