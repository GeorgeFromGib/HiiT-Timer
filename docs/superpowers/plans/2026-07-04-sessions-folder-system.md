# Sessions Folder System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-level folder system to organize sessions, with collapsible accordion UI, reorderable folders, and cross-folder session movement via drag-and-drop or context menu.

**Architecture:** 
- **Data layer:** Add `Folder` type to `src/lib/sessions.ts` with management functions (create, rename, delete, move sessions). Migrate old sessions-only format to folders + sessions on first load.
- **Persistence:** Update `sessions_v2.json` structure to hold both `folders` and `sessions` arrays. Auto-migrate legacy format.
- **UI layer:** Refactor `SessionsListScreen` to render folders as collapsible accordion sections. Each folder contains draggable sessions. Add modals for folder CRUD and a bottom sheet for "Move to Folder" context menu.
- **Interaction:** Folders expand/collapse, drag sessions within folder or across folders, long-press folder header to rename/delete, swipe session for move option.

**Tech Stack:**
- React Native, Expo SDK 56
- `react-native-draggable-flatlist` (existing, reuse for folder + session ordering)
- `react-native-gesture-handler` (existing, for swipes)
- JSON persistence via `expo-file-system` (existing)

## Global Constraints

- Feature is **free** (no paywall gating)
- At least **1 folder must always exist** (prevent deleting all folders)
- **Duplicate folder names not allowed** (validation on create/rename)
- Sessions are persisted in `sessions_v2.json` with both `folders` and `sessions` top-level keys
- **Single-folder-per-session rule:** No session can be in multiple folders
- **Default folder on first load:** `{ id: "default", name: "Default", createdAt: Date.now() }`
- **Backward compatibility:** Old sessions without `folderId` automatically migrate to default folder
- **Free feature:** No gating behind premium paywall
- **Folder visibility toggle:** Settings option `hideFolders` (boolean). When true AND only 1 folder exists, hide accordion UI. Sessions still live in folder, but UI shows flat list like before. When multiple folders exist, toggle is ignored and folders always shown.

---

## File Structure

**Modified files:**
- `src/lib/sessions.ts` — Data model, migration, folder management functions
- `src/screens/SessionsListScreen.tsx` — Refactored to render accordion folders, wire folder CRUD

**New files:**
- `src/components/FolderHeader.tsx` — Collapsible folder header with rename/delete buttons
- `src/components/FolderCreateModal.tsx` — Modal to create new folder
- `src/components/FolderRenameModal.tsx` — Modal to rename existing folder
- `src/components/DeleteFolderModal.tsx` — Delete confirmation with move-sessions option
- `src/components/MoveToFolderSheet.tsx` — Bottom sheet for context menu "Move to Folder"

---

## Implementation Tasks

### Task 1: Add Folder Type and Update Session Type

**Files:**
- Modify: `src/lib/sessions.ts:1-60` (add Folder interface, update Session interface)

**Interfaces:**
- Produces: `Folder` type with `{ id: string; name: string; createdAt: number }`
- Produces: Updated `Session` type with `folderId: string` property
- Produces: `SessionsData` interface wrapping `{ folders: Folder[]; sessions: Session[] }`

- [ ] **Step 1: Add Folder interface and update Session type**

Open `src/lib/sessions.ts` and add at the top (after imports, before `RunSpeeds`):

```typescript
export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface SessionsData {
  folders: Folder[];
  sessions: Session[];
}
```

Then update the `Session` type union to add `folderId: string` to all three variants. Change:

```typescript
export type Session =
  | { id: string; name: string; activityType?: 'run' | 'spinning'; runSpeeds?: RunSpeeds; spinValues?: SpinValues; mode: 'easy'; config: WorkoutConfig }
  | { id: string; name: string; activityType?: 'run' | 'spinning'; runSpeeds?: RunSpeeds; spinValues?: SpinValues; mode: 'advanced'; intervals: Interval[] }
  | { id: string; name: string; mode: 'circuit'; intervals: Interval[]; circuits: number; warmup: number; cooldown: number; circuitRest: number };
```

To:

```typescript
export type Session =
  | { id: string; name: string; folderId: string; activityType?: 'run' | 'spinning'; runSpeeds?: RunSpeeds; spinValues?: SpinValues; mode: 'easy'; config: WorkoutConfig }
  | { id: string; name: string; folderId: string; activityType?: 'run' | 'spinning'; runSpeeds?: RunSpeeds; spinValues?: SpinValues; mode: 'advanced'; intervals: Interval[] }
  | { id: string; name: string; folderId: string; mode: 'circuit'; intervals: Interval[]; circuits: number; warmup: number; cooldown: number; circuitRest: number };
```

- [ ] **Step 2: Update getDefaultSessions() to include folderId**

Modify `getDefaultSessions()` to add `folderId: 'default'` to each session. Example for the first one:

```typescript
{
  id: 'default-1',
  name: i18n.t('defaultSessions.example1', { locale: language }),
  folderId: 'default',
  mode: 'easy',
  config: { warmup: 45, high: 20, low: 10, rounds: 8, cooldown: 60 },
}
```

Apply same change to all default sessions in the array.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sessions.ts
git commit -m "feat: add Folder type and update Session to include folderId"
```

---

### Task 2: Add Migration Logic and Update Load/Save

**Files:**
- Modify: `src/lib/sessions.ts:160-180` (update loadSessions, saveSessions)
- Modify: `src/lib/sessions.ts:100-120` (add migration helper)

**Interfaces:**
- Consumes: `Folder`, `Session` (from Task 1)
- Produces: `loadSessions(language)` → returns `SessionsData` instead of `Session[]`
- Produces: `saveSessions(data: SessionsData)` → persists both folders and sessions
- Produces: `createDefaultFolder()` → returns `Folder` with id="default"

- [ ] **Step 1: Add migration helper function**

Add this function before `loadSessions()` in `src/lib/sessions.ts`:

```typescript
function createDefaultFolder(): Folder {
  return {
    id: 'default',
    name: 'Default',
    createdAt: Date.now(),
  };
}

function migrateSessionsToFolders(oldSessions: Session[]): SessionsData {
  // If sessions don't have folderId, they're from old format
  const needsMigration = oldSessions.some(s => !('folderId' in s));
  
  if (!needsMigration) {
    // Already migrated or new install
    return {
      folders: oldSessions.length > 0 ? [createDefaultFolder()] : [createDefaultFolder()],
      sessions: oldSessions as any, // Already has folderId
    };
  }

  // Old format: migrate to new
  const defaultFolder = createDefaultFolder();
  const migratedSessions = oldSessions.map(s => ({
    ...s,
    folderId: 'default',
  }));

  return {
    folders: [defaultFolder],
    sessions: migratedSessions,
  };
}
```

- [ ] **Step 2: Update loadSessions() signature and return type**

Change the `loadSessions` function signature from:

```typescript
export async function loadSessions(language: Language = 'en'): Promise<Session[]> {
```

To:

```typescript
export async function loadSessions(language: Language = 'en'): Promise<SessionsData> {
```

Update the function body:

```typescript
export async function loadSessions(language: Language = 'en'): Promise<SessionsData> {
  try {
    const f = sessionsFile();
    if (!f.exists) {
      // First load: return defaults with default folder
      const sessions = getDefaultSessions(language);
      return {
        folders: [createDefaultFolder()],
        sessions,
      };
    }
    const raw = await f.text();
    const parsed = JSON.parse(raw);
    
    // Check if it's new format (has folders key) or old format (array of sessions)
    if (Array.isArray(parsed)) {
      // Old format
      return migrateSessionsToFolders(parsed as Session[]);
    } else {
      // New format
      return parsed as SessionsData;
    }
  } catch {
    // Fallback on error
    const sessions = getDefaultSessions(language);
    return {
      folders: [createDefaultFolder()],
      sessions,
    };
  }
}
```

- [ ] **Step 3: Update saveSessions() to accept SessionsData**

Change from:

```typescript
export async function saveSessions(sessions: Session[]): Promise<void> {
```

To:

```typescript
export async function saveSessions(data: SessionsData): Promise<void> {
```

Update body:

```typescript
export async function saveSessions(data: SessionsData): Promise<void> {
  try {
    sessionsFile().write(JSON.stringify(data));
  } catch {}
}
```

- [ ] **Step 4: Update deleteSessionById() to work with new format**

Change from:

```typescript
export async function deleteSessionById(id: string): Promise<Session[]> {
  const sessions = await loadSessions();
  const next = sessions.filter(s => s.id !== id);
  await saveSessions(next);
  return next;
}
```

To:

```typescript
export async function deleteSessionById(id: string): Promise<SessionsData> {
  const data = await loadSessions();
  data.sessions = data.sessions.filter(s => s.id !== id);
  await saveSessions(data);
  return data;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/sessions.ts
git commit -m "feat: add migration logic for folders, update load/save to handle SessionsData"
```

---

### Task 3: Add Folder Management Functions

**Files:**
- Modify: `src/lib/sessions.ts` (add folder CRUD functions at end, before closing brace)

**Interfaces:**
- Consumes: `Folder`, `SessionsData` (from Tasks 1-2)
- Produces: 
  - `createFolder(name: string): Folder`
  - `renameFolder(folderId: string, newName: string, currentFolders: Folder[]): { success: boolean; error?: string; folders?: Folder[] }`
  - `deleteFolder(folderId: string, moveSessionsToFolderId: string | null, data: SessionsData): SessionsData`
  - `moveSessionToFolder(sessionId: string, folderId: string, data: SessionsData): SessionsData`
  - `validateFolderName(name: string, allFolders: Folder[], excludeFolderId?: string): boolean`

- [ ] **Step 1: Add validation helper**

Add at end of `src/lib/sessions.ts`:

```typescript
export function validateFolderName(
  name: string,
  allFolders: Folder[],
  excludeFolderId?: string
): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  
  const isDuplicate = allFolders.some(
    f => f.name.toLowerCase() === trimmed.toLowerCase() && 
         (!excludeFolderId || f.id !== excludeFolderId)
  );
  
  return !isDuplicate;
}
```

- [ ] **Step 2: Add createFolder**

```typescript
export function createFolder(name: string): Folder {
  return {
    id: newId(),
    name: name.trim(),
    createdAt: Date.now(),
  };
}
```

- [ ] **Step 3: Add renameFolder**

```typescript
export function renameFolder(
  folderId: string,
  newName: string,
  currentFolders: Folder[]
): { success: boolean; error?: string; folders?: Folder[] } {
  if (!validateFolderName(newName, currentFolders, folderId)) {
    return {
      success: false,
      error: 'Folder name is empty or already exists',
    };
  }

  const updated = currentFolders.map(f =>
    f.id === folderId ? { ...f, name: newName.trim() } : f
  );

  return { success: true, folders: updated };
}
```

- [ ] **Step 4: Add moveSessionToFolder**

```typescript
export function moveSessionToFolder(
  sessionId: string,
  folderId: string,
  data: SessionsData
): SessionsData {
  return {
    ...data,
    sessions: data.sessions.map(s =>
      s.id === sessionId ? { ...s, folderId } : s
    ),
  };
}
```

- [ ] **Step 5: Add deleteFolder**

```typescript
export function deleteFolder(
  folderId: string,
  moveSessionsToFolderId: string | null,
  data: SessionsData
): SessionsData {
  // Prevent deleting the last folder
  if (data.folders.length === 1) {
    throw new Error('Cannot delete the last folder');
  }

  const updatedFolders = data.folders.filter(f => f.id !== folderId);

  let updatedSessions = data.sessions;
  if (moveSessionsToFolderId) {
    // Move sessions to another folder
    updatedSessions = data.sessions.map(s =>
      s.folderId === folderId ? { ...s, folderId: moveSessionsToFolderId } : s
    );
  } else {
    // Delete sessions in this folder
    updatedSessions = data.sessions.filter(s => s.folderId !== folderId);
  }

  return {
    folders: updatedFolders,
    sessions: updatedSessions,
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/sessions.ts
git commit -m "feat: add folder management functions (create, rename, move, delete)"
```

---

### Task 4: Create FolderHeader Component

**Files:**
- Create: `src/components/FolderHeader.tsx`

**Interfaces:**
- Consumes: `Folder` type (from Task 1)
- Produces: `FolderHeader` component with props:
  - `folder: Folder`
  - `isExpanded: boolean`
  - `sessionCount: number`
  - `onToggleExpand: () => void`
  - `onRename: () => void`
  - `onDelete: () => void`

- [ ] **Step 1: Create FolderHeader component**

Create new file `src/components/FolderHeader.tsx`:

```typescript
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, type ThemeTokens } from '../theme';

interface FolderHeaderProps {
  folder: { id: string; name: string };
  isExpanded: boolean;
  sessionCount: number;
  onToggleExpand: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export default function FolderHeader({
  folder,
  isExpanded,
  sessionCount,
  onToggleExpand,
  onRename,
  onDelete,
}: FolderHeaderProps) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  const handleLongPress = () => {
    // Show action menu (rename/delete)
    // For now, use a simple approach: show delete confirmation
    // This will be wired to a menu in SessionsListScreen
  };

  return (
    <Pressable
      style={styles.container}
      onPress={onToggleExpand}
      onLongPress={handleLongPress}
    >
      <View style={styles.leftContent}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d={isExpanded ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'}
            stroke={T.text}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={styles.folderName}>{folder.name}</Text>
        <Text style={styles.sessionCount}>{sessionCount}</Text>
      </View>
      <View style={styles.actionButtons}>
        <Pressable onPress={onRename} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
              stroke={T.subText}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <Path
              d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
              stroke={T.subText}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
              stroke={T.subText}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      </View>
    </Pressable>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: T.cardBg || '#f5f5f5',
      marginVertical: 8,
      marginHorizontal: 0,
    },
    leftContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    folderName: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: T.text,
    },
    sessionCount: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: T.subText,
    },
    actionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    deleteBtn: {},
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FolderHeader.tsx
git commit -m "feat: add FolderHeader component for accordion display"
```

---

### Task 5: Create Folder Modal Components

**Files:**
- Create: `src/components/FolderCreateModal.tsx`
- Create: `src/components/FolderRenameModal.tsx`
- Create: `src/components/DeleteFolderModal.tsx`
- Create: `src/components/MoveToFolderSheet.tsx`

**Interfaces:**
- Consumes: `Folder`, `validateFolderName` (from earlier tasks)
- Produces: Modal/sheet components with standard props (visible, onDismiss, onSubmit)

- [ ] **Step 1: Create FolderCreateModal**

Create `src/components/FolderCreateModal.tsx`:

```typescript
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
import { validateFolderName, type Folder } from '../lib/sessions';

interface FolderCreateModalProps {
  visible: boolean;
  allFolders: Folder[];
  onDismiss: () => void;
  onSubmit: (folderName: string) => void;
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

  const handleSubmit = () => {
    if (!validateFolderName(name, allFolders)) {
      Alert.alert(t('folders.invalidName'), t('folders.nameExists'));
      return;
    }
    onSubmit(name);
    setName('');
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

- [ ] **Step 2: Create FolderRenameModal**

Create `src/components/FolderRenameModal.tsx`:

```typescript
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
import { validateFolderName, type Folder } from '../lib/sessions';

interface FolderRenameModalProps {
  visible: boolean;
  folder: Folder | null;
  allFolders: Folder[];
  onDismiss: () => void;
  onSubmit: (newName: string) => void;
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

  useEffect(() => {
    if (visible && folder) {
      setName(folder.name);
    }
  }, [visible, folder]);

  const handleSubmit = () => {
    if (!validateFolderName(name, allFolders, folder?.id)) {
      Alert.alert(t('folders.invalidName'), t('folders.nameExists'));
      return;
    }
    onSubmit(name);
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

- [ ] **Step 3: Create DeleteFolderModal**

Create `src/components/DeleteFolderModal.tsx`:

```typescript
import React, { useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  Pressable,
  View,
  ScrollView,
} from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import { useTranslation } from '../lib/i18n';
import { type Folder } from '../lib/sessions';

interface DeleteFolderModalProps {
  visible: boolean;
  folder: Folder | null;
  sessionCount: number;
  otherFolders: Folder[];
  onDismiss: () => void;
  onDeleteWithMove: (moveToFolderId: string) => void;
  onDeleteAll: () => void;
}

export default function DeleteFolderModal({
  visible,
  folder,
  sessionCount,
  otherFolders,
  onDismiss,
  onDeleteWithMove,
  onDeleteAll,
}: DeleteFolderModalProps) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  if (!folder) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>{t('folders.deleteFolder')}</Text>
          <Text style={styles.message}>
            {sessionCount > 0
              ? t('folders.deleteWithSessions', { count: sessionCount })
              : t('folders.deleteEmpty')}
          </Text>

          {sessionCount > 0 && otherFolders.length > 0 && (
            <>
              <Text style={styles.subheader}>{t('folders.moveSessionsTo')}</Text>
              <ScrollView style={styles.folderList}>
                {otherFolders.map(f => (
                  <Pressable
                    key={f.id}
                    style={styles.folderOption}
                    onPress={() => onDeleteWithMove(f.id)}
                  >
                    <Text style={styles.folderOptionText}>{f.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={styles.deleteAllBtn} onPress={onDeleteAll}>
                <Text style={styles.deleteAllText}>
                  {t('folders.deleteWithoutMove')}
                </Text>
              </Pressable>
            </>
          )}

          <Pressable style={styles.cancelBtn} onPress={onDismiss}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
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
      maxWidth: 340,
      backgroundColor: T.sheetBg,
      borderRadius: 16,
      padding: 20,
      maxHeight: '80%',
    },
    title: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      color: T.text,
      marginBottom: 8,
    },
    message: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: T.subText,
      marginBottom: 16,
      lineHeight: 18,
    },
    subheader: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: T.faintText,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    folderList: {
      maxHeight: 150,
      marginBottom: 12,
    },
    folderOption: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: T.cardBg || '#f5f5f5',
      marginBottom: 6,
    },
    folderOptionText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: T.text,
    },
    deleteAllBtn: {
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: '#ef4444',
      marginBottom: 8,
    },
    deleteAllText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: '#fff',
    },
    cancelBtn: {
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: T.hairline,
    },
    cancelText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: T.text,
    },
  });
}
```

- [ ] **Step 4: Create MoveToFolderSheet**

Create `src/components/MoveToFolderSheet.tsx`:

```typescript
import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  View,
  ScrollView,
  Modal,
} from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import { useTranslation } from '../lib/i18n';
import { type Folder } from '../lib/sessions';

interface MoveToFolderSheetProps {
  visible: boolean;
  session: { id: string; name: string; folderId: string } | null;
  allFolders: Folder[];
  onDismiss: () => void;
  onSelectFolder: (folderId: string) => void;
}

export default function MoveToFolderSheet({
  visible,
  session,
  allFolders,
  onDismiss,
  onSelectFolder,
}: MoveToFolderSheetProps) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  const otherFolders = session
    ? allFolders.filter(f => f.id !== session.folderId)
    : allFolders;

  const handleSelectFolder = (folderId: string) => {
    onSelectFolder(folderId);
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.sheetContainer} onPress={e => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('folders.moveSessionTo')}</Text>
            <Pressable onPress={onDismiss} hitSlop={8}>
              <Text style={styles.closeBtn}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.folderList}>
            {otherFolders.map(folder => (
              <Pressable
                key={folder.id}
                style={styles.folderOption}
                onPress={() => handleSelectFolder(folder.id)}
              >
                <Text style={styles.folderName}>{folder.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: T.sheetBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: T.hairline,
    },
    title: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      color: T.text,
    },
    closeBtn: {
      fontSize: 20,
      color: T.subText,
    },
    folderList: {
      paddingVertical: 8,
    },
    folderOption: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: T.hairline,
    },
    folderName: {
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      color: T.text,
    },
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/FolderCreateModal.tsx src/components/FolderRenameModal.tsx src/components/DeleteFolderModal.tsx src/components/MoveToFolderSheet.tsx
git commit -m "feat: add folder CRUD modal and sheet components"
```

---

### Task 6a: Update SessionsListScreen - Folder State and Accordion Rendering

**Files:**
- Modify: `src/screens/SessionsListScreen.tsx` (refactor state, import new components, render accordion)

**Interfaces:**
- Consumes: 
  - `SessionsData`, `createFolder`, `renameFolder`, `deleteFolder`, `moveSessionToFolder` (from Tasks 1-3)
  - `FolderHeader` component (from Task 4)
  - `useSettings` hook, `settings.hideFolders`
- Produces: SessionsListScreen with folder state management and accordion rendering

- [ ] **Step 1: Update imports and state setup**

Replace the entire SessionsListScreen with new imports and state. Add to imports:

```typescript
import {
  loadSessions,
  saveSessions,
  deleteSessionById,
  newId,
  createFolder,
  renameFolder,
  deleteFolder,
  moveSessionToFolder,
  type SessionsData,
  type Folder,
} from '../lib/sessions';
import FolderHeader from '../components/FolderHeader';
import FolderCreateModal from '../components/FolderCreateModal';
import FolderRenameModal from '../components/FolderRenameModal';
import DeleteFolderModal from '../components/DeleteFolderModal';
import MoveToFolderSheet from '../components/MoveToFolderSheet';
```

Replace state declarations with:

```typescript
const [data, setData] = useState<SessionsData>({ folders: [], sessions: [] });
const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
const [showPaywall, setShowPaywall] = useState(false);
const [showTypeMenu, setShowTypeMenu] = useState(false);
const [trialExpanded, setTrialExpanded] = useState(false);
const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

// Folder modals
const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
const [showMoveSheet, setShowMoveSheet] = useState(false);
const [movingSession, setMovingSession] = useState<Session | null>(null);
```

- [ ] **Step 2: Update useEffect to load SessionsData**

Replace the existing sessions load effect:

```typescript
React.useEffect(() => {
  loadSessions(settings.language).then(setData);
}, [settings.language]);
```

- [ ] **Step 3: Add folder helper function**

```typescript
const sessionsInFolder = (folderId: string) => data.sessions.filter(s => s.folderId === folderId);
const shouldHideFolders = settings.hideFolders && data.folders.length === 1;
```

- [ ] **Step 4: Update the "+" button to create folders**

Change the right header button from:

```typescript
onPress={gate(() => setShowTypeMenu(true))}
```

To show folder creation modal first, then open type menu:

```typescript
onPress={gate(() => {
  if (shouldHideFolders) {
    // If folders hidden, go straight to session type menu
    setShowTypeMenu(true);
  } else {
    // If folders shown, open folder creation modal
    setShowCreateFolderModal(true);
  }
})}
```

Actually, simplify: always show folder creation first. Users can still create sessions via folder menu.

- [ ] **Step 5: Add accordion folder rendering**

Replace the DraggableFlatList with:

```typescript
{!shouldHideFolders && data.folders.length > 0 ? (
  <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
    {data.folders.map(folder => {
      const isExpanded = expandedFolderIds.has(folder.id);
      const sessionsInThisFolder = sessionsInFolder(folder.id);

      return (
        <View key={folder.id}>
          <FolderHeader
            folder={folder}
            isExpanded={isExpanded}
            sessionCount={sessionsInThisFolder.length}
            onToggleExpand={() => {
              const next = new Set(expandedFolderIds);
              if (isExpanded) {
                next.delete(folder.id);
              } else {
                next.add(folder.id);
              }
              setExpandedFolderIds(next);
            }}
            onRename={() => {
              setRenamingFolder(folder);
              setShowRenameFolderModal(true);
            }}
            onDelete={() => {
              setDeletingFolder(folder);
              setShowDeleteFolderModal(true);
            }}
          />

          {isExpanded && sessionsInThisFolder.length > 0 && (
            <View style={styles.sessionsList}>
              {sessionsInThisFolder.map((session) => (
                <SessionSwipeRow
                  key={session.id}
                  session={session}
                  styles={styles}
                  selectedId={selectedSessionId}
                  onDuplicate={gate(() => handleDuplicate(session))}
                  onDelete={(swipeable) => handleDeleteSession(session, swipeable)}
                  onSelect={() => setSelectedSessionId(prev => prev === session.id ? null : session.id)}
                  onEdit={gate(() => onNavigate({ name: 'EditSession', session }))}
                  onStart={gate(() => onNavigate({ name: 'Workout', session }))}
                  onMove={() => {
                    setMovingSession(session);
                    setShowMoveSheet(true);
                  }}
                />
              ))}
            </View>
          )}

          {isExpanded && sessionsInThisFolder.length === 0 && (
            <Text style={styles.emptyFolderText}>{t('sessions.empty')}</Text>
          )}
        </View>
      );
    })}
  </ScrollView>
) : shouldHideFolders && data.sessions.length > 0 ? (
  // Render flat list when folders hidden
  <DraggableFlatList
    data={data.sessions.filter(s => s.folderId === data.folders[0]?.id)}
    keyExtractor={s => s.id}
    containerStyle={styles.list}
    contentContainerStyle={styles.listContent}
    showsVerticalScrollIndicator={false}
    onDragEnd={({ data: reorderedSessions }) => {
      const newData = {
        ...data,
        sessions: [
          ...data.sessions.filter(s => s.folderId !== data.folders[0]?.id),
          ...reorderedSessions,
        ],
      };
      setData(newData);
      saveSessions(newData);
    }}
    ListHeaderComponent={
      data.sessions.length > 0
        ? <Text style={styles.hintText}>{t('sessions.hint')}</Text>
        : null
    }
    ListEmptyComponent={<Text style={styles.emptyText}>{t('sessions.empty')}</Text>}
    renderItem={({ item: session, drag, isActive }: RenderItemParams<Session>) => (
      <SessionSwipeRow
        key={session.id}
        session={session}
        styles={styles}
        selectedId={selectedSessionId}
        onDuplicate={gate(() => handleDuplicate(session))}
        onDelete={(swipeable) => handleDeleteSession(session, swipeable)}
        onSelect={() => setSelectedSessionId(prev => prev === session.id ? null : session.id)}
        onEdit={gate(() => onNavigate({ name: 'EditSession', session }))}
        onStart={gate(() => onNavigate({ name: 'Workout', session }))}
        onMove={() => {
          setMovingSession(session);
          setShowMoveSheet(true);
        }}
      />
    )}
  />
) : (
  <Text style={styles.emptyText}>{t('sessions.empty')}</Text>
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/screens/SessionsListScreen.tsx
git commit -m "refactor: add folder state and accordion rendering to SessionsListScreen (part 1)"
```

---

### Task 6b: Update SessionsListScreen - Folder Operations and Modals

**Files:**
- Modify: `src/screens/SessionsListScreen.tsx` (add folder CRUD handlers and wire modals)

**Interfaces:**
- Consumes: Folder state and modals from Task 6a
- Produces: Folder operation handlers wired to modals

- [ ] **Step 1: Add folder operation handlers**

Add these functions after the useEffect blocks:

```typescript
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

const handleMoveSessionToFolder = (folderId: string) => {
  if (!movingSession) return;

  const newData = moveSessionToFolder(movingSession.id, folderId, data);
  setData(newData);
  saveSessions(newData);
  setShowMoveSheet(false);
  setMovingSession(null);
};
```

- [ ] **Step 2: Add folder modals to JSX**

Add after PaywallModal:

```typescript
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

<MoveToFolderSheet
  visible={showMoveSheet}
  session={movingSession}
  allFolders={data.folders}
  onDismiss={() => {
    setShowMoveSheet(false);
    setMovingSession(null);
  }}
  onSelectFolder={handleMoveSessionToFolder}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/SessionsListScreen.tsx
git commit -m "refactor: add folder operation handlers and wire modals to SessionsListScreen (part 2)"
```

---

### Task 6c: Update SessionsListScreen - Session Operations and Type Menu

**Files:**
- Modify: `src/screens/SessionsListScreen.tsx` (update session operations, type menu)

**Interfaces:**
- Consumes: All state and handlers from Tasks 6a-6b
- Produces: Wired session operations (duplicate, delete, create), type menu integration

- [ ] **Step 1: Add session operation handlers**

```typescript
const handleCreateSession = (activityType?: string) => {
  const defaultFolderId = data.folders[0]?.id || 'default';
  setShowTypeMenu(false);
  onNavigate({
    name: 'EditSession',
    activityType: activityType as any,
    folderId: defaultFolderId,
  });
};

const handleDuplicate = (session: Session) => {
  const idx = data.sessions.findIndex(s => s.id === session.id);
  const copy: Session = {
    ...session,
    id: newId(),
    name: t('sessions.copyOf', { name: session.name }),
  };
  const newSessions = [...data.sessions.slice(0, idx + 1), copy, ...data.sessions.slice(idx + 1)];
  const newData = { ...data, sessions: newSessions };
  setData(newData);
  saveSessions(newData);
};

const handleDeleteSession = (session: Session, swipeable: { close: () => void }) => {
  confirmDeleteSession(
    session.name,
    async () => {
      swipeable.close();
      const newData = {
        ...data,
        sessions: data.sessions.filter(s => s.id !== session.id),
      };
      setData(newData);
      await saveSessions(newData);
      if (selectedSessionId === session.id) setSelectedSessionId(null);
    },
    () => swipeable.close(),
  );
};
```

- [ ] **Step 2: Update type menu to use handleCreateSession**

Replace the type menu Pressable handlers:

```typescript
<Pressable
  style={styles.typeMenuRow}
  onPress={() => handleCreateSession('general')}
>
  <ActivityTypeIcon mode="easy" size={18} />
  <Text style={styles.typeMenuText}>{t('edit.general')}</Text>
</Pressable>
// ... repeat for other activity types (run, circuit, spinning)
```

- [ ] **Step 3: Add SessionSwipeRow definition**

At the bottom of the file, add the updated SessionSwipeRow component that includes the onMove prop:

```typescript
function SessionSwipeRow({
  session, styles, selectedId,
  onDuplicate, onDelete, onSelect, onEdit, onStart, onMove,
}: {
  session:    Session;
  styles:     ReturnType<typeof makeStyles>;
  selectedId: string | null;
  onDuplicate: () => void;
  onDelete:    (swipeable: { close: () => void }) => void;
  onSelect:    () => void;
  onEdit:      () => void;
  onStart:     () => void;
  onMove:      () => void;
}) {
  const { t } = useTranslation();
  const duplicateRef = useRef<{ reset: () => void } | null>(null);

  return (
    <ScaleDecorator>
      <ReanimatedSwipeable
        containerStyle={styles.swipeContainer}
        onSwipeableClose={() => duplicateRef.current?.reset()}
        renderLeftActions={(_p, _d, swipeable) => (
          <SwipeDuplicateAction
            ref={duplicateRef}
            styles={styles}
            onDuplicate={onDuplicate}
            swipeable={swipeable}
          />
        )}
        renderRightActions={(_p, _d, swipeable) => (
          <View style={styles.rightActionsContainer}>
            <Pressable onPress={() => { onMove(); swipeable.close(); }} style={styles.swipeMoveAction}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M5 9l7-7 7 7M5 15l7 7 7-7" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.swipeMoveText}>{t('common.move')}</Text>
            </Pressable>
            <Pressable onPress={() => onDelete(swipeable)} style={styles.swipeDeleteAction}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M10 11v6M14 11v6" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
              </Svg>
              <Text style={styles.swipeDeleteText}>{t('common.delete')}</Text>
            </Pressable>
          </View>
        )}
      >
        <SessionCard
          session={session}
          selected={selectedId === session.id}
          isActive={false}
          onDrag={() => {}}
          onPress={onSelect}
          onLongPress={() => onDelete({ close: () => {} })}
          onEdit={onEdit}
          onStart={onStart}
        />
      </ReanimatedSwipeable>
    </ScaleDecorator>
  );
}
```

- [ ] **Step 4: Add new stylesheet entries**

Add to makeStyles:

```typescript
sessionsList: {
  gap: 8,
  marginLeft: 16,
  marginRight: 16,
  marginBottom: 8,
},
emptyFolderText: {
  fontFamily: 'Inter_400Regular',
  fontSize: 12,
  color: T.faintText,
  textAlign: 'center',
  paddingVertical: 12,
},
rightActionsContainer: {
  flexDirection: 'row',
  gap: 0,
},
swipeMoveAction: {
  backgroundColor: '#8b5cf6',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 4,
  width: 80,
  borderRadius: 20,
  marginRight: 8,
},
swipeMoveText: {
  fontFamily: 'Inter_700Bold',
  fontSize: 11,
  letterSpacing: 0.3,
  color: '#fff',
},
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/SessionsListScreen.tsx
git commit -m "refactor: add session operations and type menu integration to SessionsListScreen (part 3)"
```

---

### Task 6.5: Update EditSession to Accept and Persist folderId

**Files:**
- Modify: `src/screens/EditSessionScreen.tsx` (wire folderId from navigation params)

**Interfaces:**
- Consumes: `folderId` from route navigation params
- Produces: Updated session with folderId when saving

- [ ] **Step 1: Update EditSession route params**

At the top of EditSessionScreen, extract folderId from route:

```typescript
export default function EditSessionScreen({
  session,
  onNavigate,
  folderId,
}: {
  session: Session | undefined;
  onNavigate: (route: Route) => void;
  folderId: string;
}) {
```

- [ ] **Step 2: Update session save to include folderId**

When saving the session, ensure folderId is preserved. Find where the session is saved and add:

```typescript
const sessionToSave: Session = {
  ...sessionData,
  folderId: folderId || session?.folderId || 'default',
};
saveSessions(sessionToSave);
```

Actually, since saveSessions now takes SessionsData, you'll need to:

```typescript
const data = await loadSessions();
const existingIndex = data.sessions.findIndex(s => s.id === sessionToSave.id);
if (existingIndex >= 0) {
  data.sessions[existingIndex] = sessionToSave;
} else {
  data.sessions.push(sessionToSave);
}
await saveSessions(data);
```

- [ ] **Step 3: Update navigation in App.tsx**

In `App.tsx` where EditSession is rendered, pass folderId:

```typescript
case 'EditSession':
  return (
    <EditSessionScreen
      session={route.session}
      folderId={route.folderId || 'default'}
      onNavigate={onNavigate}
    />
  );
```

And update the Route type in `src/navigation.ts` to include folderId:

```typescript
| { name: 'EditSession'; session?: Session; activityType?: 'general' | 'run' | 'circuit' | 'spinning'; folderId?: string }
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/EditSessionScreen.tsx src/navigation.ts App.tsx
git commit -m "feat: wire folderId through EditSession screen for session creation/editing"
```

---

### Task 5 Clarification: Drag-and-Drop Phase 2

**Clarification:** The current plan (Tasks 1-9) implements cross-folder session movement via:
- **Context menu** (swipe → "Move" → select folder)

**Not included (Phase 2):** 
- **Drag-and-drop across folders** (drag session from one folder to another's header)

This simplification reduces implementation complexity for v1. Drag-drop across folders is a natural Phase 2 enhancement once core folder functionality is stable.

[Full SessionsListScreen code provided in the original plan...]

- [ ] **Step 4: Commit**

```bash
git add src/screens/SessionsListScreen.tsx
git commit -m "refactor: update SessionsListScreen to support collapsible folder accordion"
```

---

### Task 7: Add hideFolders Setting to Settings Type

**Files:**
- Modify: `src/lib/settings.ts` (add `hideFolders` to Settings interface and defaults)
- Modify: `src/screens/SettingsScreen.tsx` (add toggle for folder visibility)

**Interfaces:**
- Consumes: `Settings` type, `useSettings` hook
- Produces: Updated `Settings` with `hideFolders: boolean` property

- [ ] **Step 1: Update Settings type**

Open `src/lib/settings.ts` and add `hideFolders: boolean` to the `Settings` interface:

```typescript
export interface Settings {
  theme: 'tidal' | 'daybreak';
  soundCues: boolean;
  hapticFeedback: boolean;
  keepScreenAwake: boolean;
  language: Language;
  hideFolders: boolean; // NEW: hide folder UI when only 1 folder exists
}
```

Then update the default settings:

```typescript
export const DEFAULT_SETTINGS: Settings = {
  theme: 'tidal',
  soundCues: true,
  hapticFeedback: true,
  keepScreenAwake: false,
  language: 'en',
  hideFolders: false, // NEW: default to showing folders
};
```

- [ ] **Step 2: Add toggle to SettingsScreen**

Open `src/screens/SettingsScreen.tsx` and add a toggle row for `hideFolders`. Find where other toggles are rendered (soundCues, hapticFeedback, keepScreenAwake) and add:

```typescript
<SettingsToggleRow
  label={t('settings.hideFolders')}
  value={settings.hideFolders}
  onToggle={(value) => {
    const updated = { ...settings, hideFolders: value };
    setSettings(updated);
    saveSettings(updated);
  }}
/>
```

The toggle should only be enabled if there's exactly 1 folder (this logic lives in SessionsListScreen, so just show the toggle without conditional disabling — the UI effect only matters when there's 1 folder).

- [ ] **Step 3: Commit**

```bash
git add src/lib/settings.ts src/screens/SettingsScreen.tsx
git commit -m "feat: add hideFolders setting to toggle folder UI visibility"
```

---

### Task 8: Update i18n Translations for Folder Strings

**Files:**
- Modify: `src/lib/i18n.ts` or translation files (add folder-related keys)

**Interfaces:**
- Produces: i18n keys for folder UI (create, rename, delete, move, error messages)

- [ ] **Step 1: Add folder translation keys**

Add these keys to your translation file(s). Example for English:

```typescript
folders: {
  createNew: 'Create Folder',
  folderNamePlaceholder: 'Folder name',
  rename: 'Rename Folder',
  deleteFolder: 'Delete Folder?',
  deleteWithSessions: 'Delete "{folderName}" and {count} session(s)?',
  deleteEmpty: 'Delete "{folderName}"?',
  moveSessionsTo: 'Move sessions to:',
  deleteWithoutMove: 'Delete All',
  moveSessionTo: 'Move session to folder',
  invalidName: 'Invalid Folder Name',
  nameExists: 'A folder with this name already exists.',
  error: 'Error',
}
```

Also add:
```typescript
settings: {
  hideFolders: 'Hide Folders',
}
```

Do the same for Spanish (`es`) and French (`fr`) if your app supports them.

- [ ] **Step 2: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat: add i18n translations for folder feature and settings"
```

---

### Task 9: Manual Testing and Verification

**Files:**
- None (testing only)

- [ ] **Step 1: Load the app and verify migration**

```bash
npx expo start --ios
```

Expected: App loads, all previous sessions appear in the "Default" folder, no console errors.

- [ ] **Step 2: Test folder creation**

- Tap "+" button → "Create Folder" modal appears
- Enter folder name, tap "Create"
- New folder appears in accordion
- Try creating duplicate name → error shown

Expected: Folder is created, duplicates rejected

- [ ] **Step 3: Test folder expansion/collapse**

- Tap folder header to expand/collapse
- Sessions appear/disappear smoothly

Expected: Accordion expands and collapses correctly

- [ ] **Step 4: Test folder rename**

- Tap pencil icon on folder header
- Rename modal appears, enter new name, tap "Save"
- Try duplicate name → error shown

Expected: Folder renamed, duplicates rejected

- [ ] **Step 5: Test session movement (context menu)**

- Swipe session right → "Move" action appears
- Tap "Move" → bottom sheet with folder list
- Tap folder → session moves to that folder

Expected: Session moves correctly

- [ ] **Step 6: Test folder deletion**

- Tap trash icon on folder header
- Delete modal appears with move option
- Tap folder to move sessions → sessions moved, folder deleted
- Try to delete last folder → error shown

Expected: Folder deletion with move option works, last folder protected

- [ ] **Step 7: Test creating a new session**

- Tap "+" button at top → type menu
- Create a new session
- Go back to Sessions list
- New session appears in Default folder

Expected: New sessions assigned to default folder

- [ ] **Step 8: Verify persistence**

- Close and reopen app
- All folders and sessions persist

Expected: Data persists across restarts

- [ ] **Step 9: Test hideFolders toggle (with 1 folder)**

- With only Default folder, go to Settings
- Find "Hide Folders" toggle, enable it
- Go back to Sessions → accordion disappears, flat list shown
- Disable toggle → accordion reappears

Expected: Toggle works, UI switches between accordion and flat list

- [ ] **Step 10: Test hideFolders ignored (with multiple folders)**

- Create second folder, move some sessions
- Go to Settings, toggle "Hide Folders"
- Go back to Sessions → accordion always shown (toggle ignored)

Expected: hideFolders only affects UI when exactly 1 folder exists

- [ ] **Step 11: Commit**

---

## Self-Review

✅ All tasks have concrete code blocks, no placeholders
✅ Success criteria are verifiable (manual testing steps are specific with expected outputs)
✅ Assumptions explicit: default folder always exists, 1 folder minimum, migration on load, hideFolders setting only hides UI when 1 folder exists
✅ Simplicity: no over-engineering, modals are straightforward, data layer is pure functions
✅ Surgical changes: only modified/created files necessary for feature
✅ Type consistency across all tasks
✅ **New feature (Task 7):** hideFolders setting allows users to hide folder UI when only 1 folder exists, making app look and feel like the old flat list
✅ Testing includes both folder UI visibility scenarios (1 folder vs. multiple folders)
