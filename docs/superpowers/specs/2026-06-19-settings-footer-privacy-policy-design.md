# Settings: Developer Footer & Privacy Policy Screen

**Date:** 2026-06-19
**Status:** Approved

---

## Overview

Two additions to the Settings screen:
1. A "Developed by George Gaskin" footer label at the bottom of the scroll content, translated into all three supported languages.
2. A "Privacy Policy" row in the About section that navigates to a new, static PrivacyPolicyScreen.

---

## 1. "Developed by George Gaskin" Footer

### Placement
Rendered inside the `ScrollView` content in `SettingsScreen.tsx`, below all `SettingsSection` blocks, centered horizontally. Not a section — just a plain `Text` node with top margin.

### Styling
- Font: `Inter_600SemiBold`, 12px
- Color: `T.faintText`
- `textAlign: 'center'`
- `marginTop: 32`, `marginBottom: 8`

### Translation keys (added to `settings` namespace in en/es/fr)

| Key | en | es | fr |
|-----|----|----|-----|
| `settings.developedBy` | `Developed by George Gaskin` | `Desarrollado por George Gaskin` | `Développé par George Gaskin` |

---

## 2. Privacy Policy Row

### Placement
Added as the last row in the **About** `SettingsSection` (after "Rate the app"), with `last` prop. Wrapped in a `Pressable` since `SettingsRow` has no `onPress` prop — no refactor to `SettingsRow` needed.

### Right element
Chevron SVG, identical to the "Rate the app" row.

### Translation keys

| Key | en | es | fr |
|-----|----|----|-----|
| `settings.privacyPolicy` | `Privacy Policy` | `Política de privacidad` | `Politique de confidentialité` |

---

## 3. PrivacyPolicyScreen

### File
`src/screens/PrivacyPolicyScreen.tsx`

### Props
```ts
{ onBack: () => void }
```

### Layout
- `LinearGradient` root (same pattern as other screens)
- `ScreenHeader` with `title="Privacy Policy"` and `onBack`
- `ScrollView` containing the static policy text

### Content
Static English text (legal documents are not translated). The `[your email here]` placeholder is replaced with `george.gaskin.gg@gmail.com`.

Full text:

```
Privacy Policy for ClearHiiT
Last updated: June 19, 2026

ClearHiiT does not collect, store, or share any personal data.

All app data — including your workout settings, timers, and preferences — is stored locally on your device and is never transmitted to us or to any third party. We do not use analytics, advertising, or tracking services of any kind.

Since ClearHiiT does not collect any personal information, there is no data to access, delete, or transfer. If you delete the app, all locally stored data is removed from your device.

ClearHiiT does not integrate with any third-party services that would receive your data.

If you have any questions about this policy, please contact us at george.gaskin.gg@gmail.com.
```

### Typography
- Title-level text (heading): `Inter_700Bold`, 16px, `T.text`
- Body paragraphs: `Inter_600SemiBold`, 14px, `T.subText`, line height 22

---

## 4. Navigation

### `src/navigation.ts`
Add `{ name: 'PrivacyPolicy' }` to the `Route` union.

### `src/screens/SettingsScreen.tsx`
Add `onPrivacyPolicy: () => void` prop. Wire to the Privacy Policy `Pressable`.

### `App.tsx`
- Pass `onPrivacyPolicy={() => setRoute({ name: 'PrivacyPolicy' })}` to `SettingsScreen`
- Add new route branch:
  ```tsx
  {route.name === 'PrivacyPolicy' && (
    <RouteScreen>
      <PrivacyPolicyScreen onBack={() => setRoute({ name: 'Settings' })} />
    </RouteScreen>
  )}
  ```
- Back from PrivacyPolicy → Settings (not Sessions)

---

## Files Changed

| File | Change |
|------|--------|
| `src/navigation.ts` | Add `PrivacyPolicy` route |
| `src/locales/en.ts` | Add `settings.developedBy`, `settings.privacyPolicy` |
| `src/locales/es.ts` | Add `settings.developedBy`, `settings.privacyPolicy` |
| `src/locales/fr.ts` | Add `settings.developedBy`, `settings.privacyPolicy` |
| `src/screens/SettingsScreen.tsx` | Add footer label + Privacy Policy row + `onPrivacyPolicy` prop |
| `src/screens/PrivacyPolicyScreen.tsx` | New file |
| `App.tsx` | Wire `PrivacyPolicy` route + pass `onPrivacyPolicy` to SettingsScreen |

---

## Out of Scope

- Translating the privacy policy text itself
- Adding an `onPress` prop to `SettingsRow` component
- Any other refactoring
