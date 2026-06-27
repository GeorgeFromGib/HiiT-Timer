# Activity Type Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move activity type selection (General / Run / Circuit) out of EditSession and into an inline dropdown on the Sessions List screen that appears when the user taps +.

**Architecture:** Extend the `EditSession` route to carry an optional `activityType` field. `SessionsListScreen` shows a floating dropdown on +, navigates with the chosen type. `EditSessionScreen` removes the new-session picker and shows a read-only label for existing sessions. `useEditSession` is seeded with the type at construction.

**Tech Stack:** React Native (Expo SDK 56), TypeScript strict, no test runner configured — use `npx tsc --noEmit` as the automated check.

## Global Constraints

- No new dependencies.
- All string labels use existing i18n keys: `t('edit.general')`, `t('edit.run')`, `t('edit.circuit')`.
- Styles must use `ThemeTokens` values — no hard-coded colours except where already present.
- No changes to timer engine, session storage, or workout logic.
- TypeScript strict mode must pass (`npx tsc --noEmit`) at the end of every task.

---

### Task 1: Extend the EditSession route with `activityType`

**Files:**
- Modify: `src/navigation.ts`

**Interfaces:**
- Produces: `Route` union member `EditSession` now carries `activityType?: 'general' | 'run' | 'circuit'`; consumed by Tasks 3 and 4.

- [ ] **Step 1: Edit `src/navigation.ts`**

Replace the file contents with:

```ts
import type { Session } from './lib/sessions';

export type Route =
  | { name: 'Sessions' }
  | { name: 'Workout'; session: Session }
  | { name: 'EditSession'; session?: Session; activityType?: 'general' | 'run' | 'circuit' }
  | { name: 'Settings' }
  | { name: 'PrivacyPolicy' };
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors (the new field is optional — existing call sites that omit it are still valid).

- [ ] **Step 3: Commit**

```bash
git add src/navigation.ts
git commit -m "feat(nav): add activityType to EditSession route"
```

---

### Task 2: Seed `useEditSession` from `initialActivityType`; remove `setDisplayActivityType`

`setDisplayActivityType` is only called from the new-session type picker (which this feature removes). Deleting it here, before removing the UI in Task 3, will cause a TypeScript error in `EditSessionScreen` until Task 3 is committed. Complete Tasks 2 and 3 in the same session before running `tsc`.

**Files:**
- Modify: `src/hooks/useEditSession.ts`

**Interfaces:**
- Consumes: nothing new yet (parameter added here, wired up from Task 3).
- Produces:
  - `useEditSession(existing, onBack, initialActivityType?)` — new optional third parameter
  - `setDisplayActivityType` **removed** from `EditSessionInterface` and return object
  - `resetToDefaults` internal helper **removed** (only called from `setDisplayActivityType`)

- [ ] **Step 1: Update the function signature**

Find the function declaration at line 85:
```ts
export function useEditSession(
  existing: Session | undefined,
  onBack: () => void,
): EditSessionInterface {
```

Replace with:
```ts
export function useEditSession(
  existing: Session | undefined,
  onBack: () => void,
  initialActivityType?: 'general' | 'run' | 'circuit',
): EditSessionInterface {
```

- [ ] **Step 2: Update `mode` state initialisation**

Find:
```ts
  const [mode, setMode] = useState<'easy' | 'advanced' | 'circuit'>(existing?.mode ?? 'easy');
```

Replace with:
```ts
  const [mode, setMode] = useState<'easy' | 'advanced' | 'circuit'>(() => {
    if (existing) return existing.mode;
    if (initialActivityType === 'circuit') return 'circuit';
    return 'easy';
  });
```

- [ ] **Step 3: Update `activityType` state initialisation**

Find:
```ts
  const [activityType, setActivityType] = useState<'run' | undefined>(
    existing && existing.mode !== 'circuit' ? existing.activityType : undefined
  );
```

Replace with:
```ts
  const [activityType, setActivityType] = useState<'run' | undefined>(() => {
    if (existing && existing.mode !== 'circuit') return existing.activityType;
    if (!existing && initialActivityType === 'run') return 'run';
    return undefined;
  });
```

- [ ] **Step 4: Rename the `initialActivityType` ref to avoid shadowing the parameter**

Find (around line 111):
```ts
  const initialActivityType = useRef(existing && existing.mode !== 'circuit' ? existing.activityType : undefined).current;
```

Replace with:
```ts
  const initialActivityTypeRef = useRef<'run' | undefined>(
    existing && existing.mode !== 'circuit'
      ? existing.activityType
      : (initialActivityType === 'run' ? 'run' : undefined)
  ).current;
```

- [ ] **Step 5: Update `hasChanges` to use the renamed ref — body and deps array**

Find:
```ts
      || activityType !== initialActivityType
```

Replace with:
```ts
      || activityType !== initialActivityTypeRef
```

Also find the `useMemo` dependency array for `hasChanges`:
```ts
    initialName, initialActivityType,
```

Replace with:
```ts
    initialName, initialActivityTypeRef,
```

- [ ] **Step 6: Remove `resetToDefaults` and `setDisplayActivityType`**

Delete the entire `resetToDefaults` function (around lines 174–189):
```ts
  function resetToDefaults(type: 'general' | 'run' | 'circuit') {
    setName('');
    setIntervals([]);
    setTimingDirty(false);
    if (type === 'circuit') {
      setMode('circuit');
      setActivityType(undefined);
      circuitEdit.reset();
    } else {
      setMode('easy');
      setActivityType(type === 'run' ? 'run' : undefined);
      setSpeedsDirty(false);
      setActiveSpeedPreset(null);
      easyEdit.reset();
    }
  }
```

Delete the entire `setDisplayActivityType` function (around lines 191–206):
```ts
  function setDisplayActivityType(type: 'general' | 'run' | 'circuit') {
    const currentType = mode === 'circuit' ? 'circuit' : activityType === 'run' ? 'run' : 'general';
    if (currentType === type) return;
    if (!hasChanges) {
      resetToDefaults(type);
      return;
    }
    Alert.alert(
      i18n.t('alerts.switchTypeTitle'),
      i18n.t('alerts.switchTypeMessage'),
      [
        { text: i18n.t('alerts.cancel'), style: 'cancel' },
        { text: i18n.t('alerts.discard'), style: 'destructive', onPress: () => resetToDefaults(type) },
      ],
    );
  }
```

- [ ] **Step 7: Remove `setDisplayActivityType` from `EditSessionInterface`**

Find in the interface block:
```ts
  setDisplayActivityType:   (type: 'general' | 'run' | 'circuit') => void;
```

Delete that line.

- [ ] **Step 8: Remove `setDisplayActivityType` from the return object**

Find in the return statement:
```ts
    setDisplayActivityType,
```

Delete that line.

- [ ] **Step 9: Check if the `Alert` import is still needed**

Search for remaining uses of `Alert` in the file. It is still used in `toggleMode`, `applyDurationPreset`, `applySpeedPreset`, and `buildSavePayload` — keep the import.

---

### Task 3: Update `EditSessionScreen` and `App.tsx`

This task removes the new-session type picker, replaces the edit-session type toggle with a read-only label, adds the `activityType` prop, and wires it through `App.tsx`. Run `npx tsc --noEmit` only after completing all steps in this task (Task 2 left a temporary TS error).

**Files:**
- Modify: `src/screens/EditSessionScreen.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `useEditSession` with new third param (Task 2); `Route.EditSession.activityType` (Task 1).
- Produces: `EditSessionScreen` accepts `activityType?: 'general' | 'run' | 'circuit'` prop.

- [ ] **Step 1: Add `activityType` to the Props interface**

Find:
```ts
interface Props {
  session?: Session;
  onBack: () => void;
}
```

Replace with:
```ts
interface Props {
  session?: Session;
  activityType?: 'general' | 'run' | 'circuit';
  onBack: () => void;
}
```

- [ ] **Step 2: Destructure the new prop and pass it to the hook**

Find:
```ts
export default function EditSessionScreen({ session: existing, onBack }: Props) {
```

Replace with:
```ts
export default function EditSessionScreen({ session: existing, activityType, onBack }: Props) {
```

Find:
```ts
  } = useEditSession(existing, onBack);
```

Replace with:
```ts
  } = useEditSession(existing, onBack, activityType);
```

- [ ] **Step 3: Remove `setDisplayActivityType` from the hook destructure**

Find:
```ts
    setName,
    setActivityType,
    setDisplayActivityType,
    toggleMode,
```

Replace with:
```ts
    setName,
    setActivityType,
    toggleMode,
```

- [ ] **Step 4: Remove `selectedBg` from the theme import**

Find:
```ts
import { useTheme, withOpacity, buttonShadow, selectedBg, selectedBorder, type ThemeTokens } from '../theme';
```

Replace with:
```ts
import { useTheme, withOpacity, buttonShadow, selectedBorder, type ThemeTokens } from '../theme';
```

(`selectedBg` was only used in the activity type buttons being removed. `selectedBorder` is still used in the Switch and `addIntervalBtn`.)

- [ ] **Step 5: Replace the activity type section in the JSX**

Find the entire activity type block — it spans from the comment through both branches (`!isEditing ?` and `!isCircuit ?`):

```tsx
          {/* Activity Type */}
          {!isEditing ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('edit.activityType')}</Text>
              <View style={styles.activityTypeRow}>
                <Pressable
                  style={[styles.activityTypeBtn, (!isCircuit && activityType !== 'run') && { borderColor: T.accent, backgroundColor: selectedBg(T.accent) }]}
                  onPress={() => setDisplayActivityType('general')}
                >
                  <Text style={[styles.activityTypeBtnText, { color: (!isCircuit && activityType !== 'run') ? T.accent : T.subText }]}>{t('edit.general')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.activityTypeBtn, (!isCircuit && activityType === 'run') && { borderColor: T.accent, backgroundColor: selectedBg(T.accent) }]}
                  onPress={() => setDisplayActivityType('run')}
                >
                  <Text style={[styles.activityTypeBtnText, { color: (!isCircuit && activityType === 'run') ? T.accent : T.subText }]}>{t('edit.run')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.activityTypeBtn, isCircuit && { borderColor: T.accent, backgroundColor: selectedBg(T.accent) }]}
                  onPress={() => setDisplayActivityType('circuit')}
                >
                  <Text style={[styles.activityTypeBtnText, { color: isCircuit ? T.accent : T.subText }]}>{t('edit.circuit')}</Text>
                </Pressable>
              </View>
            </View>
          ) : !isCircuit ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('edit.activityType')}</Text>
              <View style={styles.activityTypeRow}>
                <Pressable
                  style={[styles.activityTypeBtn, !isRun && { borderColor: T.accent, backgroundColor: selectedBg(T.accent) }]}
                  onPress={() => setActivityType(undefined)}
                >
                  <Text style={[styles.activityTypeBtnText, { color: !isRun ? T.accent : T.subText }]}>{t('edit.general')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.activityTypeBtn, isRun && { borderColor: T.accent, backgroundColor: selectedBg(T.accent) }]}
                  onPress={() => setActivityType('run')}
                >
                  <Text style={[styles.activityTypeBtnText, { color: isRun ? T.accent : T.subText }]}>{t('edit.run')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
```

Replace with a single read-only label shown for all sessions (new and existing):

```tsx
          {/* Activity Type — read-only */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('edit.activityType')}</Text>
            <View style={styles.activityTypeLabelChip}>
              <Text style={styles.activityTypeLabelText}>
                {isCircuit ? t('edit.circuit') : isRun ? t('edit.run') : t('edit.general')}
              </Text>
            </View>
          </View>
```

- [ ] **Step 6: Remove the three unused styles; add two new ones**

In `makeStyles`, find and delete these three style entries:

```ts
  activityTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  activityTypeBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: T.hairline,
    backgroundColor: T.ghostBg,
  },
  activityTypeBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    letterSpacing: 13 * 0.04,
  },
```

Add these two new entries in their place:

```ts
  activityTypeLabelChip: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: T.hairline,
    backgroundColor: T.ghostBg,
  },
  activityTypeLabelText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    letterSpacing: 13 * 0.04,
    color: T.subText,
  },
```

- [ ] **Step 7: Forward `activityType` from `App.tsx`**

In `App.tsx`, find:

```tsx
      {route.name === 'EditSession' && (
        <RouteScreen><EditSessionScreen session={route.session} onBack={goBack} /></RouteScreen>
      )}
```

Replace with:

```tsx
      {route.name === 'EditSession' && (
        <RouteScreen>
          <EditSessionScreen
            session={route.session}
            activityType={route.activityType}
            onBack={goBack}
          />
        </RouteScreen>
      )}
```

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useEditSession.ts src/screens/EditSessionScreen.tsx App.tsx
git commit -m "feat(edit): thread activityType from route through hook; replace type picker with read-only label"
```

---

### Task 4: Add activity type dropdown to `SessionsListScreen`

**Files:**
- Modify: `src/screens/SessionsListScreen.tsx`

**Interfaces:**
- Consumes: `Route.EditSession.activityType` (Task 1) via `onNavigate`.

- [ ] **Step 1: Add `showTypeMenu` state**

Find in `SessionsListScreen`:
```ts
  const [showPaywall, setShowPaywall] = useState(false);
```

Add after it:
```ts
  const [showTypeMenu, setShowTypeMenu] = useState(false);
```

- [ ] **Step 2: Change the + button to open the menu instead of navigating directly**

Find:
```tsx
          <Pressable style={styles.addBtn} onPress={gate(() => onNavigate({ name: 'EditSession' }))}>
```

Replace with:
```tsx
          <Pressable style={styles.addBtn} onPress={gate(() => setShowTypeMenu(true))}>
```

- [ ] **Step 3: Render the backdrop and menu card**

Find:
```tsx
      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />
    </LinearGradient>
```

Replace with:
```tsx
      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />

      {showTypeMenu && (
        <>
          <Pressable
            style={[StyleSheet.absoluteFillObject, { zIndex: 9 }]}
            onPress={() => setShowTypeMenu(false)}
          />
          <View style={styles.typeMenu}>
            <Pressable
              style={styles.typeMenuRow}
              onPress={() => { setShowTypeMenu(false); onNavigate({ name: 'EditSession', activityType: 'general' }); }}
            >
              <Text style={styles.typeMenuText}>{t('edit.general')}</Text>
            </Pressable>
            <View style={styles.typeMenuSeparator} />
            <Pressable
              style={styles.typeMenuRow}
              onPress={() => { setShowTypeMenu(false); onNavigate({ name: 'EditSession', activityType: 'run' }); }}
            >
              <Text style={styles.typeMenuText}>{t('edit.run')}</Text>
            </Pressable>
            <View style={styles.typeMenuSeparator} />
            <Pressable
              style={styles.typeMenuRow}
              onPress={() => { setShowTypeMenu(false); onNavigate({ name: 'EditSession', activityType: 'circuit' }); }}
            >
              <Text style={styles.typeMenuText}>{t('edit.circuit')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </LinearGradient>
```

- [ ] **Step 4: Add `StyleSheet` to the React Native import**

Find:
```ts
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
```

`StyleSheet` is already imported — no change needed.

- [ ] **Step 5: Add the new styles to `makeStyles`**

In `makeStyles`, after the existing `hintText` style, add:

```ts
    typeMenu: {
      position: 'absolute',
      top: 98,
      right: 20,
      backgroundColor: T.ghostBg,
      borderWidth: 1.5,
      borderColor: T.hairline,
      borderRadius: 14,
      minWidth: 160,
      zIndex: 10,
      overflow: 'hidden',
      ...buttonShadow(T),
    },
    typeMenuRow: {
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    typeMenuSeparator: {
      height: 1,
      backgroundColor: T.hairline,
      marginHorizontal: 12,
    },
    typeMenuText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 15,
      color: T.text,
    },
```

- [ ] **Step 6: Add `buttonShadow` to the theme import**

Find:
```ts
import { useTheme, ghostBtnStyle, buttonShadow, type ThemeTokens } from '../theme';
```

`buttonShadow` is already imported — no change needed.

- [ ] **Step 7: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Manual verification**

Start the Expo dev server:
```bash
npx expo start --ios
```

Check these scenarios:

| Scenario | Expected |
|---|---|
| Tap + | Dropdown appears with General / Run / Circuit rows |
| Tap General | Navigates to EditSession, activity type label shows "General", easy/advanced toggle visible |
| Tap Run | Navigates to EditSession, activity type label shows "Run", speed fields visible |
| Tap Circuit | Navigates to EditSession, activity type label shows "Circuit", circuit config visible |
| Tap backdrop | Dropdown closes, no navigation |
| Edit existing General/Run session (tap Edit on a card) | Read-only label shows "General" or "Run" |
| Edit existing Circuit session | Read-only label shows "Circuit" |
| Premium gate: tap + when gated | Paywall appears, dropdown does NOT open |

- [ ] **Step 9: Commit**

```bash
git add src/screens/SessionsListScreen.tsx
git commit -m "feat(sessions): add inline activity type dropdown on new session"
```
