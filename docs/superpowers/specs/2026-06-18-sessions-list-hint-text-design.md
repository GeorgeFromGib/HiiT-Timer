---
title: Sessions List Hint Text
date: 2026-06-18
status: approved
---

## Problem

Users discovering the app for the first time may not know that session cards support swipe gestures (duplicate / delete) or drag-to-reorder. A brief hint above the first card surfaces these affordances without cluttering the UI.

## Solution

Add a single line of instructional text rendered via `ListHeaderComponent` on the `DraggableFlatList` in `SessionsListScreen`. The hint only appears when there is at least one session to interact with.

## Hint Text

Correct swipe directions (matching code implementation):
- `renderLeftActions` → duplicate (revealed by swiping **right**)
- `renderRightActions` → delete (revealed by swiping **left**)

**English:** "Swipe right to duplicate, left to delete. Sort via the drag handles."

## Visual Placement

```
[Header: "My Sessions"          ⚙  +]
─────────────────────────────────────
  Swipe right to duplicate, left to delete. Sort via the drag handles.

┌─────────────────────────────────────┐
│  Session Card 1                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Session Card 2                     │
└─────────────────────────────────────┘
```

The hint sits inside the scrollable list content, so it scrolls away naturally as the user scrolls down.

## Style

- Font: `Inter_400Regular`
- Size: 11px
- Color: `T.faintText` (theme-aware, matches `emptyText`)
- Alignment: centre
- Margin: `marginBottom: 4` (tight gap to first card; the list's `gap: 12` handles spacing below)

## Translations

| Locale | Key | Value |
|--------|-----|-------|
| en | `sessions.hint` | `Swipe right to duplicate, left to delete. Sort via the drag handles.` |
| es | `sessions.hint` | `Desliza a la derecha para duplicar, a la izquierda para eliminar. Ordena con las asas.` |
| fr | `sessions.hint` | `Glissez à droite pour dupliquer, à gauche pour supprimer. Triez via les poignées.` |

## Files Changed

| File | Change |
|------|--------|
| `src/locales/en.ts` | Add `sessions.hint` |
| `src/locales/es.ts` | Add `sessions.hint` |
| `src/locales/fr.ts` | Add `sessions.hint` |
| `src/screens/SessionsListScreen.tsx` | Add `ListHeaderComponent` + `hintText` style |

## Out of Scope

- Dismissible / one-time hint (not requested)
- Hint on EditSession or other screens
