# Folder Icons Design

**Date:** 2026-07-07

## Goal

Let users pick an icon for each folder (from the icon set catalogued in `design/Hiit-Timer.zip`'s `icon-library.jsx`) and show it beside the folder name on `FoldersScreen`. Icon selection happens when creating or renaming a folder.

## Icon Catalog

28 icons across the 4 categories from the design file's `ICON_GROUPS`, ported 1:1 (same SVG paths, 24×24 viewBox):

Picker display order (Folder Classification first — most relevant to a folder icon; the rest are borrowed from other screens):

| Group | Icons |
|---|---|
| Folder Classification | `folder`, `folderOpen`, `star`, `heart`, `tag`, `bookmark`, `flag`, `target`, `calendar`, `pin`, `archive`, `grid`, `list`, `bell`, `lock`, `share`, `home` |
| Phase | `sun`, `flame`, `bolt`, `pauseIcon`, `snow` |
| Session Types | `standard`, `run`, `circuit`, `spinning` |
| People | `user`, `users` |

## Data Model

`src/lib/sessions.ts`:

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
  icon?: FolderIconName;   // undefined → treated as 'folder' at render time
}
```

`icon` is optional so existing saved folders (no `icon` field) keep loading without any migration step — they just render the default `'folder'` glyph until the user sets one via rename.

`createFolder(name, icon?)` and `renameFolder(id, newName, icon, folders)` both gain an icon parameter and store it on the `Folder`. `createDefaultFolder()` (the built-in "My Sessions" folder) gets `icon: 'home'`.

## Color Mapping (theme-mapped, not fixed hex)

The design file assigns each icon a fixed hex value, but this app has two themes (Tidal/Daybreak) with different palettes. Instead, each icon maps to an existing `ThemeTokens` color so it stays legible and consistent with how `ActivityTypeIcon` already tints icons:

New file **`src/lib/folderIcons.ts`**:

```ts
export const DEFAULT_FOLDER_ICON: FolderIconName = 'folder';

type ColorToken = 'accent' | 'warmup' | 'work' | 'rest' | 'cooldown' | 'circuitRest' | 'subText' | 'faintText';

const FOLDER_ICON_COLOR_TOKEN: Record<FolderIconName, ColorToken> = {
  sun: 'warmup', flame: 'work', bolt: 'accent', pauseIcon: 'rest', snow: 'cooldown',
  standard: 'accent', run: 'cooldown', circuit: 'warmup', spinning: 'rest',
  user: 'accent', users: 'cooldown',
  folder: 'accent', folderOpen: 'accent', star: 'warmup', heart: 'work', tag: 'circuitRest',
  bookmark: 'cooldown', flag: 'warmup', target: 'work', calendar: 'cooldown', pin: 'warmup',
  archive: 'faintText', grid: 'subText', list: 'subText', bell: 'warmup', lock: 'faintText',
  share: 'cooldown', home: 'rest',
};

export function resolveFolderIconColor(T: ThemeTokens, icon: FolderIconName): string {
  const token = FOLDER_ICON_COLOR_TOKEN[icon];
  if (token === 'accent') return T.accent;
  if (token === 'subText') return T.subText;
  if (token === 'faintText') return T.faintText;
  return T.phases[token]; // warmup | work | rest | cooldown | circuitRest
}
```

Notes on the mapping:
- `run`/`circuit`/`spinning` reuse the exact tokens `ActivityTypeIcon` already uses (`cooldown`/`warmup`/`rest`) for consistency.
- `bolt` ("All Out") has no matching phase in this app's `Phase` type, so it falls back to `accent`.
- Several icons share a token (e.g. `sun`/`circuit`/`star`/`flag`/`pin`/`bell` all resolve to `warmup`/orange) — that's expected; the goal is theme-consistent legibility, not 28 unique hues.

Also export **`FOLDER_ICON_GROUPS`** from `folderIcons.ts` — the 4 groups above, in picker display order (Folder Classification, Phase, Session Types, People), with display labels — for the picker UI to render section headers.

## Components

**New file: `src/components/FolderIcon.tsx`**
Same pattern as `ActivityTypeIcon.tsx` / `WorkoutIcon.tsx`:
- Props: `{ name: FolderIconName; color: string; size?: number }`
- Renders the matching SVG (`Svg`/`G`/`Path`/`Circle`/`Rect` from `react-native-svg`, `BASE_SVG_STROKE` for stroke props), paths ported directly from `icon-library.jsx`'s `IconGlyph`.

**New file: `src/components/FolderIconPicker.tsx`**
- Props: `{ value: FolderIconName; onChange: (icon: FolderIconName) => void }`
- Renders `FOLDER_ICON_GROUPS` as a vertical list of sections: a small uppercase section label (Phase / Session Types / People / Folder Classification), then a wrapped row of tappable swatches for that group's icons.
- Each swatch: ~40×40 rounded square, background = `resolveFolderIconColor(T, icon) + '1e'` (low-opacity tint), `FolderIcon` centered inside using the resolved color. Selected swatch gets a 2px border in its resolved color; unselected swatches get `T.hairline`.
- Single-select: tapping a swatch calls `onChange(name)`.
- The whole picker is wrapped in a `ScrollView` with a fixed max height (~220–260px) so the 28-icon grid doesn't push modal buttons off-screen.

## Modal Integration

**`FolderCreateModal.tsx`** and **`FolderRenameModal.tsx`** both:
- Add local `icon` state:
  - Create modal: initialized to `DEFAULT_FOLDER_ICON` (`'folder'`).
  - Rename modal: initialized/reset (in the existing `useEffect` keyed on `visible`/`folder`) to `folder?.icon ?? DEFAULT_FOLDER_ICON`.
- Insert an "Icon" section label + `<FolderIconPicker value={icon} onChange={setIcon} />` between the name `TextInput` and the button row.
- `modalContent` becomes scrollable (wrap existing content in a `ScrollView`, cap `maxHeight` e.g. `'80%'` of screen) since the grid adds significant height to what's currently a compact modal.
- `onSubmit` signature changes from `(name: string) => void` to `(name: string, icon: FolderIconName) => void`; both modals call `onSubmit(name, icon)`.

## FoldersScreen Integration

- `handleCreateFolder(name, icon)` → `createFolder(name, icon)`.
- `handleRenameFolder(name, icon)` → `renameFolder(renamingFolder.id, name, icon, data.folders)`.
- `handleDuplicateFolder`: the duplicated folder copies `folder.icon` (falls back to `'folder'` implicitly if source has none).
- `FolderSwipeRow`: add an icon chip before `folderName` — 30×30 rounded-9 square, background = `resolveFolderIconColor(T, icon) + '1e'`, `FolderIcon` (size 17) centered, using `folder.icon ?? DEFAULT_FOLDER_ICON`. This mirrors the layout already sketched in the design file's `folders-screen.jsx` mockup (`FolderIcon` in a 30×30 tinted chip left of the name).
- `folderCard` style gets `gap: 12` (or similar) to space the new chip from the drag handle/name.

## Defaults & Migration

- No data migration needed — `icon` is optional, missing values render as `'folder'`.
- `createDefaultFolder()` sets `icon: 'home'` for new installs' built-in folder.
- Existing installs' existing folders simply show `'folder'` until edited.

## Verification

Manual only (no test framework in this project currently):
- Create a folder, confirm the icon grid shows all 4 groups / 28 icons, pick one, confirm it persists and shows on the folder card.
- Rename an existing folder, confirm its current icon is pre-selected, change it, confirm it updates.
- Duplicate a folder, confirm the duplicate keeps the source icon.
- Check both Tidal and Daybreak themes — confirm every icon's tint is legible against its chip background in both.
- Restart the app (reload persisted JSON) — confirm icons survive a reload.
- Confirm a pre-existing folder (created before this feature, no `icon` field) still loads and displays the default `'folder'` glyph without errors.

## Out of Scope

- Per-session icons (only folders).
- A "recolor without changing icon" option — color is fully derived from icon + theme, not independently customizable.
- Custom/uploaded icons — picker is limited to the 28 cataloged icons.
