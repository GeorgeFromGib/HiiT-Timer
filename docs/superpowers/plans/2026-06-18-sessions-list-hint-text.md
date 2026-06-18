# Sessions List Hint Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small instructional hint above the first session card telling users how to swipe and drag-to-reorder.

**Architecture:** Add a `sessions.hint` translation key to all three locale files, then render it via `ListHeaderComponent` on the existing `DraggableFlatList` in `SessionsListScreen`, visible only when sessions exist.

**Tech Stack:** React Native, `DraggableFlatList` (react-native-draggable-flatlist), `useTranslation` (src/lib/i18n.ts), theme tokens from `useTheme`.

## Global Constraints

- No test runner is configured — verification is manual (run `npx expo start --ios` and inspect visually).
- All three locales must be updated together: `src/locales/en.ts`, `src/locales/es.ts`, `src/locales/fr.ts`.
- Style must use `T.faintText` (theme-aware) and `Inter_400Regular` at 11px.
- Hint must NOT render when `sessions` array is empty.
- Do not alter any existing styles, logic, or unrelated code.

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/locales/en.ts` |
| Modify | `src/locales/es.ts` |
| Modify | `src/locales/fr.ts` |
| Modify | `src/screens/SessionsListScreen.tsx` |

---

### Task 1: Add translation keys to all three locales

**Files:**
- Modify: `src/locales/en.ts`
- Modify: `src/locales/es.ts`
- Modify: `src/locales/fr.ts`

**Interfaces:**
- Produces: `t('sessions.hint')` resolves in all three locales

- [ ] **Step 1: Add `hint` to `sessions` in `src/locales/en.ts`**

Find the `sessions` block (currently ends at `deleteMessage`) and add one line:

```ts
sessions: {
  title: 'My Sessions',
  empty: 'No sessions yet. Tap + to add one.',
  copyOf: 'Copy of %{name}',
  select: 'SELECT',
  deleteTitle: 'Delete Session',
  deleteMessage: 'Remove "%{name}"?',
  hint: 'Swipe right to duplicate, left to delete. Sort via the drag handles.',
},
```

- [ ] **Step 2: Add `hint` to `sessions` in `src/locales/es.ts`**

```ts
sessions: {
  title: 'Mis sesiones',
  empty: 'No hay sesiones. Toca + para añadir una.',
  copyOf: 'Copia de %{name}',
  select: 'SELECCIONAR',
  deleteTitle: 'Eliminar sesión',
  deleteMessage: '¿Eliminar "%{name}"?',
  hint: 'Desliza a la derecha para duplicar, a la izquierda para eliminar. Ordena con las asas.',
},
```

- [ ] **Step 3: Add `hint` to `sessions` in `src/locales/fr.ts`**

```ts
sessions: {
  title: 'Mes séances',
  empty: 'Aucune séance. Appuyez sur + pour en ajouter une.',
  copyOf: 'Copie de %{name}',
  select: 'SÉLECTIONNER',
  deleteTitle: 'Supprimer la séance',
  deleteMessage: 'Supprimer « %{name} » ?',
  hint: 'Glissez à droite pour dupliquer, à gauche pour supprimer. Triez via les poignées.',
},
```

- [ ] **Step 4: Verify TypeScript is satisfied**

The locale files use `typeof en` as the type for `es` and `fr`, so adding `hint` to `en.ts` first then the other two should compile without errors. Run a quick type check:

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `sessions.hint`.

- [ ] **Step 5: Commit**

```bash
git add src/locales/en.ts src/locales/es.ts src/locales/fr.ts
git commit -m "feat: add sessions.hint translation key in en/es/fr"
```

---

### Task 2: Render hint in SessionsListScreen

**Files:**
- Modify: `src/screens/SessionsListScreen.tsx`

**Interfaces:**
- Consumes: `t('sessions.hint')` from Task 1
- Consumes: `T.faintText`, `T` theme tokens from `useTheme()`

- [ ] **Step 1: Add `hintText` to `makeStyles`**

Inside the `makeStyles` function in `SessionsListScreen.tsx`, add after the `emptyText` style block:

```ts
hintText: {
  fontFamily: 'Inter_400Regular',
  fontSize: 11,
  color: T.faintText,
  textAlign: 'center',
},
```

Note: no `marginBottom` needed — `contentContainerStyle` already has `gap: 12`, which applies between the header and the first card. Adding a margin would stack additively with the gap.

- [ ] **Step 2: Add `ListHeaderComponent` to `DraggableFlatList`**

In the `DraggableFlatList` JSX (around line 86 in `SessionsListScreen.tsx`), add one prop after `onDragEnd`:

```tsx
ListHeaderComponent={
  sessions.length > 0
    ? <Text style={styles.hintText}>{t('sessions.hint')}</Text>
    : null
}
```

Do not change any other props.

- [ ] **Step 3: Manually verify — sessions present**

Run `npx expo start --ios` and open the Sessions List screen with at least one session loaded.

Expected:
- Small, faint hint text appears above the first card.
- Hint scrolls with the list (not fixed above it).
- Both Tidal (dark) and Daybreak (light) themes render the hint in a readable faint colour.

- [ ] **Step 4: Manually verify — empty state**

Delete all sessions so the list is empty.

Expected:
- Hint text does NOT appear.
- "No sessions yet. Tap + to add one." empty state message shows as before.

- [ ] **Step 5: Manually verify — language switching**

In Settings, switch language to Español and then Français. Return to Sessions List.

Expected:
- Hint text updates to the correct language in each case.

- [ ] **Step 6: Commit**

```bash
git add src/screens/SessionsListScreen.tsx
git commit -m "feat: show swipe/sort hint above first session card"
```
