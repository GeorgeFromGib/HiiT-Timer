# Activity Type Dropdown — Design Spec

**Date:** 2026-06-27  
**Branch:** circuit  
**Status:** Approved

---

## Goal

Remove the activity type picker from the EditSession screen and move it into an inline dropdown that appears when the user taps the **+** button on the Sessions List screen. When editing an existing session the activity type becomes a read-only label.

---

## Changes by file

### `src/navigation.ts`

Add one optional field to the `EditSession` route union member:

```ts
| { name: 'EditSession'; session?: Session; activityType?: 'general' | 'run' | 'circuit' }
```

`activityType` is always present when creating (chosen in the dropdown). When editing, only `session` is passed.

---

### `src/screens/SessionsListScreen.tsx`

**State:** Add `showTypeMenu: boolean` (default `false`).

**+ button behaviour:** Tapping the `+` opens the menu (sets `showTypeMenu = true`). The existing `gate()` wrapper moves to wrap the open action — premium check fires before the menu appears.

**Dropdown UI:**
- Rendered absolutely below the header, overlaying the list (not shifting layout).
- Styled as a rounded card using `T.ghostBg` background and `T.hairline` border.
- Three rows: General, Run, Circuit — each a full-width pressable with the option name in `Inter_700Bold` and a small icon or phase colour indicator.
- Tapping a row: closes menu, navigates to `{ name: 'EditSession', activityType: <chosen> }`.
- A backdrop `Pressable` covering the rest of the screen closes the menu without navigating.
- Shadow/elevation consistent with existing `buttonShadow(T)` usage.

---

### `src/screens/EditSessionScreen.tsx`

**Props:** Add `activityType?: 'general' | 'run' | 'circuit'` alongside the existing `session?: Session` and `onBack`.

**New sessions (no `session` prop):**
- Remove the three-button activity type row entirely.
- Pass `activityType` prop into `useEditSession` as an initial value.
- Header title still uses `isCircuit` / `isEditing` logic as before (e.g. "New Circuit").

**Editing existing sessions (`session` prop present):**
- Replace the two-button General/Run toggle with a single non-interactive label chip displaying the session's resolved type: `"Circuit"`, `"Run"`, or `"General"`.
- Visual: same container style as other field groups, chip uses `T.ghostBg` + `T.hairline` border, `Inter_700Bold` text in `T.subText` colour to signal non-interactivity.

---

### `src/hooks/useEditSession.ts`

**New parameter:** Accept an optional `initialActivityType: 'general' | 'run' | 'circuit'` (or `undefined` when editing — type is derived from the existing session).

**Initialisation:** Use `initialActivityType` to seed `activityType` and `isCircuit` on first render instead of defaulting to `'general'`.

**`setDisplayActivityType` removal:** This function is only called from the new-session type picker, which is being deleted. Remove it. Confirm no other callers exist before deleting.

---

### `App.tsx`

Forward `route.activityType` to `EditSessionScreen` as a prop. No structural routing changes.

---

## Behaviour matrix

| Action | Result |
|---|---|
| Tap + (free user, no premium gate needed) | Inline dropdown opens |
| Tap + (gated — premium required) | Paywall shown, dropdown does not open |
| Tap "General" in dropdown | Navigate to EditSession with activityType='general' |
| Tap "Run" in dropdown | Navigate to EditSession with activityType='run' |
| Tap "Circuit" in dropdown | Navigate to EditSession with activityType='circuit' |
| Tap backdrop | Dropdown closes, no navigation |
| Edit existing General/Run session | Read-only label "General" or "Run" shown |
| Edit existing Circuit session | Read-only label "Circuit" shown |

---

## Out of scope

- Changing activity type on an existing session (user must delete and recreate).
- Any changes to the Workout screen or timer engine.
- Localisation of the new dropdown items (use the existing `t('edit.general')`, `t('edit.run')`, `t('edit.circuit')` keys which already exist in all three locale files).

---

## Testing

- Tap + → dropdown appears with all three options visible.
- Each option navigates to EditSession with the correct mode pre-selected (verify `isCircuit`, `activityType === 'run'`, and general defaults are each correct).
- Backdrop tap dismisses dropdown without navigating.
- Editing an existing session of each type shows the correct read-only label.
- Premium gate: paywall fires before dropdown opens (not after a type is selected).
- No regression: editing and saving an existing session still persists correctly.
