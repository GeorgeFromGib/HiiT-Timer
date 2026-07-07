# Folder Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pick one of 28 cataloged icons (Folder Classification, Phase, Session Types, People) for each folder, shown beside the folder name on `FoldersScreen`, selectable from the create and rename modals.

**Architecture:** Add an optional `icon` field to `Folder`. A new `src/lib/folderIcons.ts` maps each icon name to an existing theme color token (not a fixed hex) and groups icons for the picker UI. A new `FolderIcon` component renders the SVGs; a new `FolderIconPicker` component renders the grouped, scrollable, tappable grid. Both `FolderCreateModal` and `FolderRenameModal` grow an icon-picker section and pass the chosen icon back through `onSubmit`. `FoldersScreen` threads the icon through `createFolder`/`renameFolder`/duplicate and renders an icon chip on each folder card.

**Tech Stack:** React Native + Expo SDK 56, TypeScript (strict), `react-native-svg`, no test framework (this project has none configured — see Global Constraints).

**Spec:** `docs/superpowers/specs/2026-07-07-folder-icons-design.md`

## Global Constraints

- No test framework is configured in this project — verification is `npx tsc --noEmit` (type safety) plus manual checks in the running app, per explicit user decision. Do not add Jest or any other test runner as part of this work.
- Theme colors must come from `ThemeTokens` (`src/theme.ts`) — never hardcode hex values for icon tints.
- Match existing code style: `StyleSheet.create` via a `makeStyles(T)` function, `useTheme()`/`useTranslation()` hooks, `react-native-svg` primitives (`Svg`, `G`, `Path`, `Circle`, `Rect`), `BASE_SVG_STROKE` from `src/components/svgStroke.ts` for stroke props.
- All new user-facing strings go through `src/locales/{en,es,fr}.ts` + `t()`, not hardcoded English.
- `icon` is optional on `Folder` — never write a migration; missing values fall back to `'folder'` at render/default time.

---

### Task 1: Data model — `FolderIconName` and `Folder.icon`

**Files:**
- Modify: `src/lib/sessions.ts:6-10` (Folder interface), `src/lib/sessions.ts:263-269` (createFolder), `src/lib/sessions.ts:271-288` (renameFolder), `src/lib/sessions.ts:180-186` (createDefaultFolder)

**Interfaces:**
- Produces: `export type FolderIconName = ...` (28-member string union), `Folder.icon?: FolderIconName`, `createFolder(name: string, icon?: FolderIconName): Folder`, `renameFolder(folderId: string, newName: string, icon: FolderIconName, currentFolders: Folder[]): { success: boolean; error?: string; folders?: Folder[] }`.

- [ ] **Step 1: Add the `FolderIconName` type and `icon` field**

In `src/lib/sessions.ts`, replace lines 6-10:

```ts
export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}
```

with:

```ts
export type FolderIconName =
  | 'sun' | 'flame' | 'bolt' | 'pauseIcon' | 'snow'
  | 'standard' | 'run' | 'circuit' | 'spinning'
  | 'user' | 'users'
  | 'folder' | 'folderOpen' | 'star' | 'heart' | 'tag' | 'bookmark' | 'flag'
  | 'target' | 'calendar' | 'pin' | 'archive' | 'grid' | 'list' | 'bell' | 'lock' | 'share' | 'home';

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  icon?: FolderIconName;
}
```

- [ ] **Step 2: Update `createFolder` to accept an icon**

Replace lines 263-269 (`export function createFolder...`):

```ts
export function createFolder(name: string, icon: FolderIconName = 'folder'): Folder {
  return {
    id: newId(),
    name: name.trim(),
    createdAt: Date.now(),
    icon,
  };
}
```

- [ ] **Step 3: Update `renameFolder` to accept and store an icon**

Replace lines 271-288 (`export function renameFolder...`):

```ts
export function renameFolder(
  folderId: string,
  newName: string,
  icon: FolderIconName,
  currentFolders: Folder[]
): { success: boolean; error?: string; folders?: Folder[] } {
  if (!validateFolderName(newName, currentFolders, folderId)) {
    return {
      success: false,
      error: 'Folder name is empty or already exists',
    };
  }

  const updated = currentFolders.map(f =>
    f.id === folderId ? { ...f, name: newName.trim(), icon } : f
  );

  return { success: true, folders: updated };
}
```

- [ ] **Step 4: Give the built-in default folder a `home` icon**

Replace lines 180-186 (`function createDefaultFolder...`):

```ts
function createDefaultFolder(): Folder {
  return {
    id: 'default',
    name: 'My Sessions',
    createdAt: Date.now(),
    icon: 'home',
  };
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: Errors at every call site of `createFolder`/`renameFolder` that doesn't yet pass an icon (`FoldersScreen.tsx`). This is expected — Task 7 fixes those call sites. Confirm the *only* errors are in `src/screens/FoldersScreen.tsx` about missing/extra arguments, nothing in `sessions.ts` itself.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sessions.ts
git commit -m "feat: add icon field to Folder data model"
```

---

### Task 2: Icon catalog and theme color mapping

**Files:**
- Create: `src/lib/folderIcons.ts`

**Interfaces:**
- Consumes: `FolderIconName` from `src/lib/sessions.ts`, `ThemeTokens` from `src/theme.ts`.
- Produces: `DEFAULT_FOLDER_ICON: FolderIconName`, `resolveFolderIconColor(T: ThemeTokens, icon: FolderIconName): string`, `FOLDER_ICON_GROUPS: { labelKey: string; icons: FolderIconName[] }[]`.

- [ ] **Step 1: Create the file**

Create `src/lib/folderIcons.ts`:

```ts
import type { ThemeTokens } from '../theme';
import type { FolderIconName } from './sessions';

export const DEFAULT_FOLDER_ICON: FolderIconName = 'folder';

type ColorToken = 'accent' | 'warmup' | 'work' | 'rest' | 'cooldown' | 'circuitRest' | 'subText' | 'faintText';

const FOLDER_ICON_COLOR_TOKEN: Record<FolderIconName, ColorToken> = {
  // Folder Classification
  folder: 'accent', folderOpen: 'accent', star: 'warmup', heart: 'work', tag: 'circuitRest',
  bookmark: 'cooldown', flag: 'warmup', target: 'work', calendar: 'cooldown', pin: 'warmup',
  archive: 'faintText', grid: 'subText', list: 'subText', bell: 'warmup', lock: 'faintText',
  share: 'cooldown', home: 'rest',
  // Phase
  sun: 'warmup', flame: 'work', bolt: 'accent', pauseIcon: 'rest', snow: 'cooldown',
  // Session Types (mirrors ActivityTypeIcon's tinting)
  standard: 'accent', run: 'cooldown', circuit: 'warmup', spinning: 'rest',
  // People
  user: 'accent', users: 'cooldown',
};

export function resolveFolderIconColor(T: ThemeTokens, icon: FolderIconName): string {
  const token = FOLDER_ICON_COLOR_TOKEN[icon];
  if (token === 'accent') return T.accent;
  if (token === 'subText') return T.subText;
  if (token === 'faintText') return T.faintText;
  return T.phases[token];
}

export interface FolderIconGroup {
  labelKey: string;
  icons: FolderIconName[];
}

export const FOLDER_ICON_GROUPS: FolderIconGroup[] = [
  {
    labelKey: 'folders.iconGroupClassification',
    icons: ['folder', 'folderOpen', 'star', 'heart', 'tag', 'bookmark', 'flag', 'target', 'calendar', 'pin', 'archive', 'grid', 'list', 'bell', 'lock', 'share', 'home'],
  },
  { labelKey: 'folders.iconGroupPhase', icons: ['sun', 'flame', 'bolt', 'pauseIcon', 'snow'] },
  { labelKey: 'folders.iconGroupSessionTypes', icons: ['standard', 'run', 'circuit', 'spinning'] },
  { labelKey: 'folders.iconGroupPeople', icons: ['user', 'users'] },
];
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors from `src/lib/folderIcons.ts` (the pre-existing `FoldersScreen.tsx` errors from Task 1 are still present and expected until Task 7).

- [ ] **Step 3: Commit**

```bash
git add src/lib/folderIcons.ts
git commit -m "feat: add folder icon catalog and theme color mapping"
```

---

### Task 3: `FolderIcon` render component

**Files:**
- Create: `src/components/FolderIcon.tsx`

**Interfaces:**
- Consumes: `FolderIconName` from `src/lib/sessions.ts`, `BASE_SVG_STROKE` from `src/components/svgStroke.ts`.
- Produces: `export default function FolderIcon({ name, color, size = 20 }: { name: FolderIconName; color: string; size?: number })`.

- [ ] **Step 1: Create the component**

Create `src/components/FolderIcon.tsx`:

```tsx
import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { FolderIconName } from '../lib/sessions';
import { BASE_SVG_STROKE } from './svgStroke';

interface Props {
  name: FolderIconName;
  color: string;
  size?: number;
}

export default function FolderIcon({ name, color, size = 20 }: Props) {
  const p = { ...BASE_SVG_STROKE, stroke: color };

  switch (name) {
    case 'sun':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Circle cx="12" cy="12" r="4.2" />
            <Path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
          </G>
        </Svg>
      );
    case 'flame':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M12 2.5c3 4 6 5.5 6 10a6 6 0 0 1-12 0c0-2 1-3.4 2.4-4.6.2 1.6 1 2.4 2 2.6-1.2-3 .3-6.4 1.6-8z" />
        </Svg>
      );
    case 'bolt':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M13 2 4 13h6l-1 9 9-12h-6l1-8z" />
        </Svg>
      );
    case 'pauseIcon':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Rect x="6" y="5" width="4" height="14" rx="1.5" />
            <Rect x="14" y="5" width="4" height="14" rx="1.5" />
          </G>
        </Svg>
      );
    case 'snow':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10" />
            <Path d="M12 6l-2.5-2.5M12 6l2.5-2.5M12 18l-2.5 2.5M12 18l2.5 2.5" />
          </G>
        </Svg>
      );
    case 'standard':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Circle cx="12" cy="14" r="7" />
            <Path d="M9.7 3.2h4.6" />
            <Path d="M12 3.4V7" />
            <Path d="M18.4 7.6l1.3-1.3" />
            <Path d="M12 14l3 1.8" />
            <Path d="M12 14V10.2" />
          </G>
        </Svg>
      );
    case 'run':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Circle cx="15.5" cy="4.6" r="2.1" />
            <Path d="M14.2 8.3 10 13.4l3.6 1.9.5 5" />
            <Path d="M10 13.4 6.2 16.8 4 18.4" />
            <Path d="M13.6 9.6l3.3 1.7 2.7-.6" />
            <Path d="M16.9 11.3l-.4 3" />
          </G>
        </Svg>
      );
    case 'circuit':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Path d="M3.2 9.5v5" />
            <Path d="M6.4 7.2v9.6" />
            <Path d="M6.4 12h11.2" />
            <Path d="M17.6 7.2v9.6" />
            <Path d="M20.8 9.5v5" />
          </G>
        </Svg>
      );
    case 'spinning':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Circle cx="6" cy="16.4" r="3.5" />
            <Circle cx="18" cy="16.4" r="3.5" />
            <Path d="M11 16.4 9 8.2M11 16.4 16 8.2M9 8.2h7M11 16.4H6M16 8.2l2 8.2" />
            <Path d="M7.9 7.7h2.4" />
            <Path d="M16 8.2V6.4M14.7 6.4h2.6" />
          </G>
        </Svg>
      );
    case 'folder':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </Svg>
      );
    case 'folderOpen':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M3 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 1.95 2.45l-1.2 5.5a2 2 0 0 1-1.95 1.55H6a2 2 0 0 1-2-2v-7.5z" />
        </Svg>
      );
    case 'star':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M12 3.2l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7z" />
        </Svg>
      );
    case 'heart':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M12 20.5s-7.6-4.6-10-9.1C.5 8 2.3 4.5 5.8 4c2-.3 3.9.6 5 2.2C11.9 4.6 13.8 3.7 15.8 4c3.5.5 5.3 4 3.8 7.4-2.4 4.5-10 9.1-10 9.1z" />
        </Svg>
      );
    case 'tag':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M3 11.5V5a2 2 0 0 1 2-2h6.5L21 11.5 12.5 20 3 11.5z" />
          <Circle cx="8" cy="8" r="1.4" fill={color} stroke="none" />
        </Svg>
      );
    case 'bookmark':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M6 3.5h12v17l-6-4-6 4v-17z" />
        </Svg>
      );
    case 'flag':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Path d="M6 21V3.8" />
            <Path d="M6 4.2c2-1.4 4.2-1.4 6.2 0 2.2 1.5 4.4 1.5 6.4 0v8.5c-2 1.5-4.2 1.5-6.4 0-2-1.4-4.2-1.4-6.2 0z" />
          </G>
        </Svg>
      );
    case 'target':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Circle cx="12" cy="12" r="8.5" />
            <Circle cx="12" cy="12" r="4.8" />
          </G>
          <Circle cx="12" cy="12" r="1.2" fill={color} stroke="none" />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Rect x="3.5" y="5" width="17" height="16" rx="2.4" />
            <Path d="M8 3v4M16 3v4M3.5 10h17" />
          </G>
        </Svg>
      );
    case 'pin':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Path d="M12 21.5s-6.5-6.1-6.5-11.3a6.5 6.5 0 1 1 13 0c0 5.2-6.5 11.3-6.5 11.3z" />
            <Circle cx="12" cy="10.2" r="2.3" />
          </G>
        </Svg>
      );
    case 'archive':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Rect x="3.5" y="4.5" width="17" height="4.5" rx="1.2" />
            <Path d="M4.7 9v9.3a2 2 0 0 0 2 2h10.6a2 2 0 0 0 2-2V9" />
            <Path d="M10 13.3h4" />
          </G>
        </Svg>
      );
    case 'grid':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Rect x="3.5" y="3.5" width="7.2" height="7.2" rx="1.4" />
            <Rect x="13.3" y="3.5" width="7.2" height="7.2" rx="1.4" />
            <Rect x="3.5" y="13.3" width="7.2" height="7.2" rx="1.4" />
            <Rect x="13.3" y="13.3" width="7.2" height="7.2" rx="1.4" />
          </G>
        </Svg>
      );
    case 'list':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M8.5 6h12M8.5 12h12M8.5 18h12" />
          <Circle cx="4" cy="6" r="1.1" fill={color} stroke="none" />
          <Circle cx="4" cy="12" r="1.1" fill={color} stroke="none" />
          <Circle cx="4" cy="18" r="1.1" fill={color} stroke="none" />
        </Svg>
      );
    case 'bell':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Path d="M6 17V10.5a6 6 0 0 1 12 0V17l1.8 2.5H4.2z" />
            <Path d="M10 21a2.2 2.2 0 0 0 4 0" />
          </G>
        </Svg>
      );
    case 'lock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Rect x="5" y="10.5" width="14" height="10" rx="2.2" />
            <Path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
          </G>
        </Svg>
      );
    case 'share':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Circle cx="18" cy="5.5" r="2.4" />
            <Circle cx="6" cy="12" r="2.4" />
            <Circle cx="18" cy="18.5" r="2.4" />
            <Path d="M8.1 10.8l7.8-4.3M8.1 13.2l7.8 4.3" />
          </G>
        </Svg>
      );
    case 'home':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Path d="M4 11.5L12 4l8 7.5" />
            <Path d="M6 10v9.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10" />
            <Path d="M10 20.5V14h4v6.5" />
          </G>
        </Svg>
      );
    case 'user':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Circle cx="12" cy="8" r="3.6" />
            <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
          </G>
        </Svg>
      );
    case 'users':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Circle cx="9" cy="8.2" r="3.2" />
            <Path d="M3 20.2a6 6 0 0 1 12 0" />
            <Path d="M15.5 5.4a3.2 3.2 0 0 1 0 6.2" />
            <Path d="M17.5 14.5a6 6 0 0 1 3.5 5.7" />
          </G>
        </Svg>
      );
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors from `src/components/FolderIcon.tsx`. The `switch` covers every member of `FolderIconName`, so there's no fallthrough/`undefined` return path.

- [ ] **Step 3: Commit**

```bash
git add src/components/FolderIcon.tsx
git commit -m "feat: add FolderIcon component rendering the 28-icon catalog"
```

---

### Task 4: `FolderIconPicker` grid component

**Files:**
- Create: `src/components/FolderIconPicker.tsx`
- Modify: `src/locales/en.ts`, `src/locales/es.ts`, `src/locales/fr.ts` (add 4 group-label keys inside the existing `folders` block)

**Interfaces:**
- Consumes: `FOLDER_ICON_GROUPS`, `resolveFolderIconColor` from `src/lib/folderIcons.ts`; `FolderIcon` from `src/components/FolderIcon.tsx`; `useTheme()` from `src/theme.ts`; `useTranslation()` from `src/lib/i18n.ts`.
- Produces: `export default function FolderIconPicker({ value, onChange }: { value: FolderIconName; onChange: (icon: FolderIconName) => void })`.

- [ ] **Step 1: Add the 4 group-label translation keys**

In `src/locales/en.ts`, inside the `folders: { ... }` block (after `folderNamePlaceholder: 'e.g. Weekend Sessions',` at line 49), add:

```ts
    iconGroupClassification: 'Folder Classification',
    iconGroupPhase: 'Phase',
    iconGroupSessionTypes: 'Session Types',
    iconGroupPeople: 'People',
```

In `src/locales/es.ts`, inside the `folders: { ... }` block (after `folderNamePlaceholder: 'Ej. Sesiones de fin de semana',`), add:

```ts
    iconGroupClassification: 'Clasificación de carpetas',
    iconGroupPhase: 'Fase',
    iconGroupSessionTypes: 'Tipos de sesión',
    iconGroupPeople: 'Personas',
```

In `src/locales/fr.ts`, inside the `folders: { ... }` block (after `folderNamePlaceholder: 'Ex. Séances du week-end',`), add:

```ts
    iconGroupClassification: 'Classification des dossiers',
    iconGroupPhase: 'Phase',
    iconGroupSessionTypes: 'Types de séance',
    iconGroupPeople: 'Personnes',
```

- [ ] **Step 2: Create the picker component**

Create `src/components/FolderIconPicker.tsx`:

```tsx
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import { useTranslation } from '../lib/i18n';
import type { FolderIconName } from '../lib/sessions';
import { FOLDER_ICON_GROUPS, resolveFolderIconColor } from '../lib/folderIcons';
import FolderIcon from './FolderIcon';

interface FolderIconPickerProps {
  value: FolderIconName;
  onChange: (icon: FolderIconName) => void;
}

export default function FolderIconPicker({ value, onChange }: FolderIconPickerProps) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  return (
    <ScrollView style={styles.scroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
      {FOLDER_ICON_GROUPS.map(group => (
        <View key={group.labelKey} style={styles.group}>
          <Text style={styles.groupLabel}>{t(group.labelKey)}</Text>
          <View style={styles.row}>
            {group.icons.map(icon => {
              const color = resolveFolderIconColor(T, icon);
              const selected = icon === value;
              return (
                <Pressable
                  key={icon}
                  onPress={() => onChange(icon)}
                  style={[
                    styles.swatch,
                    { backgroundColor: color + '1e', borderColor: selected ? color : T.hairline },
                  ]}
                >
                  <FolderIcon name={icon} color={color} size={20} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    scroll: {
      maxHeight: 240,
      marginBottom: 16,
    },
    group: {
      marginBottom: 12,
    },
    groupLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: T.faintText,
      marginBottom: 6,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    swatch: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors from `src/components/FolderIconPicker.tsx` or the three locale files.

- [ ] **Step 4: Commit**

```bash
git add src/components/FolderIconPicker.tsx src/locales/en.ts src/locales/es.ts src/locales/fr.ts
git commit -m "feat: add FolderIconPicker grouped icon grid"
```

---

### Task 5: Wire the picker into `FolderCreateModal`

**Files:**
- Modify: `src/components/FolderCreateModal.tsx`
- Modify: `src/locales/en.ts`, `src/locales/es.ts`, `src/locales/fr.ts` (add one more `folders` key: `icon`)

**Interfaces:**
- Consumes: `FolderIconPicker` from `src/components/FolderIconPicker.tsx`, `DEFAULT_FOLDER_ICON` from `src/lib/folderIcons.ts`, `FolderIconName` from `src/lib/sessions.ts`.
- Produces: `FolderCreateModalProps.onSubmit: (folderName: string, icon: FolderIconName) => void` (was `(folderName: string) => void`).

- [ ] **Step 1: Add the `folders.icon` translation key**

In `src/locales/en.ts`, in the `folders` block, add: `icon: 'Icon',`
In `src/locales/es.ts`, in the `folders` block, add: `icon: 'Icono',`
In `src/locales/fr.ts`, in the `folders` block, add: `icon: 'Icône',`

- [ ] **Step 2: Update `FolderCreateModal.tsx`**

Replace the full file content of `src/components/FolderCreateModal.tsx` with:

```tsx
import React, { useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
  Alert,
} from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import { useTranslation } from '../lib/i18n';
import { validateFolderName, type Folder, type FolderIconName } from '../lib/sessions';
import { DEFAULT_FOLDER_ICON } from '../lib/folderIcons';
import FolderIconPicker from './FolderIconPicker';

interface FolderCreateModalProps {
  visible: boolean;
  allFolders: Folder[];
  onDismiss: () => void;
  onSubmit: (folderName: string, icon: FolderIconName) => void;
}

export default function FolderCreateModal({
  visible,
  allFolders,
  onDismiss,
  onSubmit,
}: FolderCreateModalProps) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<FolderIconName>(DEFAULT_FOLDER_ICON);

  const handleSubmit = () => {
    if (!validateFolderName(name, allFolders)) {
      Alert.alert(t('folders.invalidName'), t('folders.nameExists'));
      return;
    }
    onSubmit(name, icon);
    setName('');
    setIcon(DEFAULT_FOLDER_ICON);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>{t('folders.createNew')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('folders.folderNamePlaceholder')}
            placeholderTextColor={T.faintText}
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <Text style={styles.sectionLabel}>{t('folders.icon')}</Text>
          <FolderIconPicker value={icon} onChange={setIcon} />
          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelBtn} onPress={onDismiss}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitText}>{t('common.create')}</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '85%',
      maxWidth: 320,
      backgroundColor: T.sheetBg,
      borderRadius: 16,
      padding: 20,
    },
    title: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      color: T.text,
      marginBottom: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: T.hairline,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: T.text,
      marginBottom: 16,
    },
    sectionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: T.subText,
      marginBottom: 8,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 8,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: T.faintText + '20',
    },
    cancelText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: T.subText,
    },
    submitBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: T.accent,
    },
    submitText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: '#fff',
    },
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: New errors only where `FoldersScreen.tsx` calls `<FolderCreateModal onSubmit={handleCreateFolder} .../>` with a `handleCreateFolder` that doesn't yet accept an icon — expected until Task 7.

- [ ] **Step 4: Commit**

```bash
git add src/components/FolderCreateModal.tsx src/locales/en.ts src/locales/es.ts src/locales/fr.ts
git commit -m "feat: add icon picker to FolderCreateModal"
```

---

### Task 6: Wire the picker into `FolderRenameModal`

**Files:**
- Modify: `src/components/FolderRenameModal.tsx`

**Interfaces:**
- Consumes: `FolderIconPicker`, `DEFAULT_FOLDER_ICON`, `FolderIconName` (same as Task 5).
- Produces: `FolderRenameModalProps.onSubmit: (newName: string, icon: FolderIconName) => void` (was `(newName: string) => void`).

- [ ] **Step 1: Update `FolderRenameModal.tsx`**

Replace the full file content of `src/components/FolderRenameModal.tsx` with:

```tsx
import React, { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
  Alert,
} from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import { useTranslation } from '../lib/i18n';
import { validateFolderName, type Folder, type FolderIconName } from '../lib/sessions';
import { DEFAULT_FOLDER_ICON } from '../lib/folderIcons';
import FolderIconPicker from './FolderIconPicker';

interface FolderRenameModalProps {
  visible: boolean;
  folder: Folder | null;
  allFolders: Folder[];
  onDismiss: () => void;
  onSubmit: (newName: string, icon: FolderIconName) => void;
}

export default function FolderRenameModal({
  visible,
  folder,
  allFolders,
  onDismiss,
  onSubmit,
}: FolderRenameModalProps) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<FolderIconName>(DEFAULT_FOLDER_ICON);

  useEffect(() => {
    if (visible && folder) {
      setName(folder.name);
      setIcon(folder.icon ?? DEFAULT_FOLDER_ICON);
    }
  }, [visible, folder]);

  const handleSubmit = () => {
    if (!validateFolderName(name, allFolders, folder?.id)) {
      Alert.alert(t('folders.invalidName'), t('folders.nameExists'));
      return;
    }
    onSubmit(name, icon);
    setName('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>{t('folders.rename')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('folders.folderNamePlaceholder')}
            placeholderTextColor={T.faintText}
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <Text style={styles.sectionLabel}>{t('folders.icon')}</Text>
          <FolderIconPicker value={icon} onChange={setIcon} />
          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelBtn} onPress={onDismiss}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitText}>{t('common.save')}</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '85%',
      maxWidth: 320,
      backgroundColor: T.sheetBg,
      borderRadius: 16,
      padding: 20,
    },
    title: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      color: T.text,
      marginBottom: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: T.hairline,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: T.text,
      marginBottom: 16,
    },
    sectionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: T.subText,
      marginBottom: 8,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 8,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: T.faintText + '20',
    },
    cancelText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: T.subText,
    },
    submitBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: T.accent,
    },
    submitText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: '#fff',
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: Remaining errors are only in `src/screens/FoldersScreen.tsx` (Task 7 fixes them).

- [ ] **Step 3: Commit**

```bash
git add src/components/FolderRenameModal.tsx
git commit -m "feat: add icon picker to FolderRenameModal, pre-selecting the current icon"
```

---

### Task 7: Wire icons through `FoldersScreen` and render the card chip

**Files:**
- Modify: `src/screens/FoldersScreen.tsx`

**Interfaces:**
- Consumes: `createFolder(name, icon?)`, `renameFolder(id, newName, icon, folders)` (Task 1); `DEFAULT_FOLDER_ICON`, `resolveFolderIconColor` (Task 2); `FolderIcon` (Task 3); `FolderIconName` type (Task 1).

- [ ] **Step 1: Update imports**

In `src/screens/FoldersScreen.tsx`, replace the import block at lines 11-20:

```ts
import {
  loadSessions,
  saveSessions,
  createFolder,
  renameFolder,
  deleteFolder,
  newId,
  type SessionsData,
  type Folder,
} from '../lib/sessions';
```

with:

```ts
import {
  loadSessions,
  saveSessions,
  createFolder,
  renameFolder,
  deleteFolder,
  newId,
  type SessionsData,
  type Folder,
  type FolderIconName,
} from '../lib/sessions';
import { DEFAULT_FOLDER_ICON, resolveFolderIconColor } from '../lib/folderIcons';
import FolderIcon from '../components/FolderIcon';
```

- [ ] **Step 2: Update `handleCreateFolder`**

Replace lines 54-61:

```ts
  const handleCreateFolder = (folderName: string) => {
    const folder = createFolder(folderName);
    const newData = { ...data, folders: [...data.folders, folder] };
    setData(newData);
    setSessionCounts(prev => ({ ...prev, [folder.id]: 0 }));
    saveSessions(newData);
    setShowCreateFolderModal(false);
  };
```

with:

```ts
  const handleCreateFolder = (folderName: string, icon: FolderIconName) => {
    const folder = createFolder(folderName, icon);
    const newData = { ...data, folders: [...data.folders, folder] };
    setData(newData);
    setSessionCounts(prev => ({ ...prev, [folder.id]: 0 }));
    saveSessions(newData);
    setShowCreateFolderModal(false);
  };
```

- [ ] **Step 3: Update `handleRenameFolder`**

Replace lines 63-77:

```ts
  const handleRenameFolder = (newName: string) => {
    if (!renamingFolder) return;

    const result = renameFolder(renamingFolder.id, newName, data.folders);
    if (!result.success) {
      Alert.alert(t('folders.error'), result.error);
      return;
    }

    const newData = { ...data, folders: result.folders! };
    setData(newData);
    saveSessions(newData);
    setShowRenameFolderModal(false);
    setRenamingFolder(null);
  };
```

with:

```ts
  const handleRenameFolder = (newName: string, icon: FolderIconName) => {
    if (!renamingFolder) return;

    const result = renameFolder(renamingFolder.id, newName, icon, data.folders);
    if (!result.success) {
      Alert.alert(t('folders.error'), result.error);
      return;
    }

    const newData = { ...data, folders: result.folders! };
    setData(newData);
    saveSessions(newData);
    setShowRenameFolderModal(false);
    setRenamingFolder(null);
  };
```

- [ ] **Step 4: Carry the icon over when duplicating a folder**

Replace lines 79-97 (`handleDuplicateFolder`):

```ts
  const handleDuplicateFolder = (folder: Folder) => {
    const idx = data.folders.findIndex(f => f.id === folder.id);
    const newFolder: Folder = {
      id: newId(),
      name: t('sessions.copyOf', { name: folder.name }),
      createdAt: Date.now(),
      icon: folder.icon ?? DEFAULT_FOLDER_ICON,
    };
    const duplicatedSessions = data.sessions
      .filter(s => s.folderId === folder.id)
      .map(s => ({ ...s, id: newId(), folderId: newFolder.id }));

    const newData = {
      folders: [...data.folders.slice(0, idx + 1), newFolder, ...data.folders.slice(idx + 1)],
      sessions: [...data.sessions, ...duplicatedSessions],
    };
    setData(newData);
    setSessionCounts(prev => ({ ...prev, [newFolder.id]: duplicatedSessions.length }));
    saveSessions(newData);
  };
```

- [ ] **Step 5: Render the icon chip on the folder card**

Replace the `FolderSwipeRow` function body's `Pressable` (lines 294-305):

```tsx
      <Pressable
        style={[styles.folderCard, isActive && styles.folderCardActive]}
        onPress={onPress}
      >
        <Pressable onLongPress={drag} delayLongPress={150} style={styles.dragHandle} hitSlop={8}>
          <DragHandle color={T.subText} />
        </Pressable>
        <Text style={styles.folderName}>{folder.name}</Text>
        <Text style={styles.sessionCount}>
          {sessionCount} {t('common.intervals')}
        </Text>
      </Pressable>
```

with:

```tsx
      <Pressable
        style={[styles.folderCard, isActive && styles.folderCardActive]}
        onPress={onPress}
      >
        <Pressable onLongPress={drag} delayLongPress={150} style={styles.dragHandle} hitSlop={8}>
          <DragHandle color={T.subText} />
        </Pressable>
        <View style={[styles.folderIconChip, { backgroundColor: iconColor + '1e' }]}>
          <FolderIcon name={iconName} color={iconColor} size={17} />
        </View>
        <Text style={styles.folderName}>{folder.name}</Text>
        <Text style={styles.sessionCount}>
          {sessionCount} {t('common.intervals')}
        </Text>
      </Pressable>
```

Then, just above that `return (` statement inside `FolderSwipeRow` (after the existing `const duplicateRef = useRef...` line), add:

```ts
  const iconName = folder.icon ?? DEFAULT_FOLDER_ICON;
  const iconColor = resolveFolderIconColor(T, iconName);
```

- [ ] **Step 6: Add the chip style**

In `makeStyles`, add a new style next to `dragHandle`:

```ts
    folderIconChip: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors anywhere in the project.

- [ ] **Step 8: Manual verification**

Run: `npx expo start --ios` (or your usual dev-build workflow — Expo Go is fine for this UI-only change).

1. Open the Folders screen. Tap the `+` button.
2. Confirm the create modal shows a name input, then an "Icon" label, then a scrollable grid grouped into **Folder Classification / Phase / Session Types / People** — 28 icons total.
3. Tap a few different swatches — confirm exactly one shows a colored border ring at a time, and each icon's tint reads clearly against its background chip.
4. Type a name, submit. Confirm the new folder card shows a 30×30 tinted icon chip to the left of the name with the icon you picked.
5. Swipe the new folder left to reveal "Edit", tap it. Confirm the rename modal opens with your previously chosen icon already highlighted in the grid.
6. Pick a different icon, save. Confirm the card updates to the new icon/color.
7. Swipe left, tap the duplicate action (left-swipe). Confirm the duplicated folder card shows the same icon as the original.
8. Go to Settings and switch theme (Tidal ↔ Daybreak). Return to Folders. Confirm all icon tints still look legible (no icon disappearing into its background) in both themes.
9. Force-quit and reopen the app. Confirm folder icons persisted (survived reload from disk).
10. If you have a folder created before this change (or delete the app's saved JSON and reinstall to get the default "My Sessions" folder), confirm it shows the `home` icon (default folder) or the plain `folder` icon (any pre-existing folder with no `icon` field) without crashing.

- [ ] **Step 9: Commit**

```bash
git add src/screens/FoldersScreen.tsx
git commit -m "feat: thread folder icon through create/rename/duplicate and render icon chip on folder cards"
```

---

---

### Task 8: Remove dead folder-CRUD code from `SessionsListScreen.tsx`

**Context (discovered during Task 1's typecheck, confirmed with the user):** `SessionsListScreen.tsx` still imports and renders `FolderHeader`, `FolderCreateModal`, `FolderRenameModal`, and `DeleteFolderModal`, with their own `handleCreateFolder`/`handleRenameFolder`/`handleDeleteFolder` and state — left over from before the "refactor folders to separate screen" commit. None of it is reachable: `FolderHeader` is imported but never rendered in JSX; `setShowCreateFolderModal(true)`, `setShowRenameFolderModal(true)`/`setRenamingFolder(folder)`, and `setShowDeleteFolderModal(true)`/`setDeletingFolder(folder)` are never called anywhere in the file (only reset to `false`/`null`). The live multi-folder path (line ~260) only renders a "View Folders" button that navigates to `FoldersScreen`. User confirmed: remove this dead code now rather than also update it for icons.

`MoveToFolderSheet` (and its `showMoveSheet`/`movingSession` state) is genuinely live — `onMove` on `SessionSwipeRow` calls `setMovingSession(session); setShowMoveSheet(true);` — do not touch it.

`selectedFolderForSession` state is unrelated to this dead code (it's about which folder a new session is created into) and is left alone even though it looks similarly unused — out of scope for this task.

**Files:**
- Modify: `src/screens/SessionsListScreen.tsx`

- [ ] **Step 1: Remove the now-unused imports**

Remove these 4 lines (currently around lines 38-41):
```ts
import FolderHeader from '../components/FolderHeader';
import FolderCreateModal from '../components/FolderCreateModal';
import FolderRenameModal from '../components/FolderRenameModal';
import DeleteFolderModal from '../components/DeleteFolderModal';
```

In the `react-native` import block, remove `Alert,` (it's only used inside the handlers this task removes).

In the `../lib/sessions` import block, remove `createFolder,`, `renameFolder,`, `deleteFolder,`, and `type Folder,` (all only used by the code this task removes) — keep `loadSessions`, `saveSessions`, `newId`, `moveSessionToFolder`, `type Session`, `type SessionsData`.

- [ ] **Step 2: Remove the now-unused state**

Remove the `expandedFolderIds`/`setExpandedFolderIds` state (was only read by the now-unrendered `FolderHeader`) and the comment above it:
```ts
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
```

Remove the folder-modal state block and its comment:
```ts
  // Folder modals — state, handlers, and rendering.
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
```
Keep `showMoveSheet`, `movingSession`, and `selectedFolderForSession` exactly as they are.

- [ ] **Step 3: Remove the now-unused `sessionsInFolder` helper**

Remove this line (it was only used by the removed `DeleteFolderModal`'s `sessionCount` prop):
```ts
  const sessionsInFolder = (folderId: string) => data.sessions.filter(s => s.folderId === folderId);
```

- [ ] **Step 4: Simplify the load effect**

Replace:
```ts
  React.useEffect(() => {
    loadSessions(settings.language).then((loadedData) => {
      setData(loadedData);
      // Expand the first folder by default
      if (loadedData.folders.length > 0) {
        setExpandedFolderIds(new Set([loadedData.folders[0].id]));
      }
    });
  }, [settings.language]);
```
with:
```ts
  React.useEffect(() => {
    loadSessions(settings.language).then((loadedData) => {
      setData(loadedData);
    });
  }, [settings.language]);
```

- [ ] **Step 5: Remove the three dead handlers**

Remove `handleCreateFolder`, `handleRenameFolder`, and `handleDeleteFolder` in their entirety:
```ts
  const handleCreateFolder = (folderName: string) => {
    const folder = createFolder(folderName);
    const newData = {
      ...data,
      folders: [...data.folders, folder],
    };
    setData(newData);
    saveSessions(newData);
    setShowCreateFolderModal(false);
  };

  const handleRenameFolder = (newName: string) => {
    if (!renamingFolder) return;

    const result = renameFolder(renamingFolder.id, newName, data.folders);
    if (!result.success) {
      Alert.alert(t('folders.error'), result.error);
      return;
    }

    const newData = {
      ...data,
      folders: result.folders!,
    };
    setData(newData);
    saveSessions(newData);
    setShowRenameFolderModal(false);
    setRenamingFolder(null);
  };

  const handleDeleteFolder = (moveToFolderId: string | null) => {
    if (!deletingFolder) return;

    try {
      const newData = deleteFolder(deletingFolder.id, moveToFolderId, data);
      setData(newData);
      saveSessions(newData);
      setShowDeleteFolderModal(false);
      setDeletingFolder(null);
    } catch (e: any) {
      Alert.alert(t('folders.error'), e.message);
    }
  };
```
Keep `handleMoveSessionToFolder` exactly as it is.

- [ ] **Step 6: Remove the three dead modal JSX blocks**

Remove:
```tsx
      <FolderCreateModal
        visible={showCreateFolderModal}
        allFolders={data.folders}
        onDismiss={() => setShowCreateFolderModal(false)}
        onSubmit={handleCreateFolder}
      />

      <FolderRenameModal
        visible={showRenameFolderModal}
        folder={renamingFolder}
        allFolders={data.folders}
        onDismiss={() => {
          setShowRenameFolderModal(false);
          setRenamingFolder(null);
        }}
        onSubmit={handleRenameFolder}
      />

      <DeleteFolderModal
        visible={showDeleteFolderModal}
        folder={deletingFolder}
        sessionCount={deletingFolder ? sessionsInFolder(deletingFolder.id).length : 0}
        otherFolders={deletingFolder ? data.folders.filter(f => f.id !== deletingFolder.id) : []}
        onDismiss={() => {
          setShowDeleteFolderModal(false);
          setDeletingFolder(null);
        }}
        onDeleteWithMove={handleDeleteFolder}
        onDeleteAll={() => handleDeleteFolder(null)}
      />
```
Keep the `<MoveToFolderSheet ... />` block immediately after it exactly as it is.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors anywhere in the project (this task removes the last remaining call sites of the old 3-argument `renameFolder`/2-argument `createFolder` signatures).

- [ ] **Step 8: Manual verification**

Run: `npx expo start --ios`

1. Open the Sessions list with more than one folder existing. Confirm the "View Folders" button still appears and still navigates to `FoldersScreen` correctly.
2. Open a single folder's session list (via `FoldersScreen` → tap a folder). Confirm sessions still list, drag-reorder, swipe-to-delete/duplicate, and "move to folder" (via swipe → move) all still work exactly as before.
3. Confirm nothing on this screen looks different — this task removes unreachable code only, no visible behavior should change.

- [ ] **Step 9: Commit**

```bash
git add src/screens/SessionsListScreen.tsx
git commit -m "chore: remove unreachable folder create/rename/delete UI from SessionsListScreen

This screen's own folder CRUD modals (FolderHeader, FolderCreateModal,
FolderRenameModal, DeleteFolderModal) were superseded by the dedicated
FoldersScreen and had become unreachable — no code path ever set them
visible. Removing them here rather than updating them for the new
folder-icon feature."
```

---

## Self-Review Notes

- **Spec coverage:** Data model (Task 1), color mapping (Task 2), `FolderIcon` render component (Task 3), `FolderIconPicker` grid (Task 4), Create modal integration (Task 5), Rename modal integration (Task 6), FoldersScreen wiring + card chip + duplicate carry-over (Task 7), manual verification checklist (Task 7 Step 8, matches the spec's Verification section) — every section of `2026-07-07-folder-icons-design.md` has a corresponding task.
- **Simplification vs. spec:** the spec suggested wrapping the *entire* modal content in a `ScrollView` in case the 28-icon grid overflows the modal. In practice `FolderIconPicker` already caps itself at `maxHeight: 240` with its own internal `ScrollView`, which bounds the modal's total height without a second nested scroll container — simpler, same guarantee. No outer `ScrollView` was added to the modals.
- **Type consistency check:** `FolderIconName` (Task 1) is the single source of truth, imported unchanged into `folderIcons.ts`, `FolderIcon.tsx`, `FolderIconPicker.tsx`, both modals, and `FoldersScreen.tsx` — no renamed duplicates. `onSubmit` signatures changed consistently in both modals and both `FoldersScreen` handlers. `createFolder`/`renameFolder` signatures match between Task 1's definition and Task 7's call sites.
