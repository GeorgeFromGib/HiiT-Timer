# Activity Type Icons Design

**Date:** 2026-06-27

## Goal

Show a small icon before the session name in `SessionCard` to give immediate visual recognition of the activity type (general, run, circuit, spinning).

## Activity Types

The app has four activity types derived from the `Session` type:

| Type | Condition | Icon concept |
|---|---|---|
| General | no `activityType` set, mode is `easy`/`advanced` | Lightning bolt (zap) |
| Run | `activityType === 'run'` | Running figure |
| Circuit | `mode === 'circuit'` | Repeat arrows loop |
| Spinning | `activityType === 'spinning'` | Bicycle wheel |

## Component

**New file:** `src/components/ActivityTypeIcon.tsx`

Follows the same pattern as `WorkoutIcon.tsx`:
- 24×24 viewBox
- Stroke-based paths using `BASE_SVG_STROKE`
- Props: `activityType?: 'run' | 'spinning'`, `mode: Session['mode']`, `size?: number`, `color?: string`
- Default `size`: 16
- Default `color`: caller provides (SessionCard uses `T.subText`)

**Icon resolution logic:**
```
mode === 'circuit'          → circuit icon
activityType === 'run'      → run icon
activityType === 'spinning' → spinning icon
otherwise                   → general icon
```

## SVG Paths (24×24 stroke)

- **General:** classic zap/lightning bolt — `M13 2L3 14h9l-1 8 10-12h-9l1-8z`
- **Run:** simplified running figure — head circle + angled body/limbs suggesting motion
- **Circuit:** two-arc repeat arrows — the standard ↻ loop symbol
- **Spinning:** bicycle wheel — outer circle, hub circle, crossing spokes

Exact paths are confirmed during implementation; the shapes above define the intent.

## Integration

**`SessionCard.tsx`** — wrap the existing title `Text` in a horizontal row with the icon preceding it:

```tsx
<View style={styles.titleRow}>
  <ActivityTypeIcon
    activityType={session.activityType}
    mode={session.mode}
    size={16}
    color={T.subText}
  />
  <Text style={styles.title}>{session.name}</Text>
</View>
```

`titleRow` style: `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 6`.

The existing `modeLabel` text in the stats row is unchanged — the icon is additive.

## Out of Scope

- Icons in the "new session" type menu (`SessionsListScreen`)
- Icons on `EditSessionScreen` or `WorkoutScreen`
- Colour customisation beyond theme `subText`
