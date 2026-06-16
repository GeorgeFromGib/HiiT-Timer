# Phone Locale → Speed Unit Auto-Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-detect `km` vs `miles` from the phone's system locale on first launch, and lock in the user's explicit choice permanently once they toggle the setting.

**Architecture:** Add a `speedUnitIsManuallySet` flag to the `Settings` type and a `detectSpeedUnit()` helper to `settings.ts`. Wire both into `App.tsx`: auto-detect on load if the flag is false, set the flag to `true` when the user changes the speed unit.

**Tech Stack:** Expo SDK 56, `expo-localization` (new install), TypeScript, `expo-file-system` (already used for settings persistence).

## Global Constraints

- Target: Expo SDK 56 (`npx expo install` for any new packages — not `npm install`)
- No test framework configured — all verification is manual on-device / in simulator
- `settings_v1.json` is the persisted settings file; do not change the file name or storage format
- `getLocales()` from `expo-localization` is synchronous — no async/await needed
- UK locale maps to `miles` (not `km`) per spec
- Fallback for missing/unknown `measurementSystem` is `km`

---

### Task 1: Add `speedUnitIsManuallySet` field + `detectSpeedUnit()` helper to settings

**Files:**
- Modify: `src/lib/settings.ts`
- Install: `expo-localization` via `npx expo install`

**Interfaces:**
- Produces:
  - `Settings.speedUnitIsManuallySet: boolean` (default `false`)
  - `detectSpeedUnit(): 'km' | 'miles'` — exported from `src/lib/settings.ts`

- [ ] **Step 1: Install expo-localization**

```bash
npx expo install expo-localization
```

Expected: package added to `package.json`, no errors.

- [ ] **Step 2: Add `speedUnitIsManuallySet` to the `Settings` interface**

In `src/lib/settings.ts`, change:

```ts
export interface Settings {
  theme: ThemeKey;
  congratsMessage: boolean;
  finalCountdownBeep: boolean;
  keepScreenAwake: boolean;
  soundCues: boolean;
  soundOff: boolean;
  countdownFlash: boolean;
  soundVolume: number;
  speedUnit: 'km' | 'miles';
  speedUnitIsManuallySet: boolean;
}
```

- [ ] **Step 3: Add `speedUnitIsManuallySet` to `DEFAULT_SETTINGS`**

```ts
export const DEFAULT_SETTINGS: Settings = {
  theme: 'tidal',
  congratsMessage: true,
  finalCountdownBeep: true,
  keepScreenAwake: true,
  soundCues: true,
  soundOff: false,
  countdownFlash: true,
  soundVolume: 100,
  speedUnit: 'km',
  speedUnitIsManuallySet: false,
};
```

- [ ] **Step 4: Add `detectSpeedUnit()` helper**

Add the import at the top of `src/lib/settings.ts` (after the existing `expo-file-system` import):

```ts
import { getLocales } from 'expo-localization';
```

Then add the function before `loadSettings`:

```ts
export function detectSpeedUnit(): 'km' | 'miles' {
  const system = getLocales()[0]?.measurementSystem;
  return system === 'us' || system === 'uk' ? 'miles' : 'km';
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If `expo-localization` types are missing, run `npx expo install expo-localization` again to ensure the `@types` are resolved.

- [ ] **Step 6: Commit**

```bash
git add src/lib/settings.ts package.json
git commit -m "feat: add speedUnitIsManuallySet field and detectSpeedUnit() helper"
```

---

### Task 2: Wire auto-detection and manual lock into App.tsx

**Files:**
- Modify: `App.tsx`

**Interfaces:**
- Consumes:
  - `detectSpeedUnit(): 'km' | 'miles'` from `src/lib/settings.ts`
  - `Settings.speedUnitIsManuallySet: boolean` from `src/lib/settings.ts`

- [ ] **Step 1: Import `detectSpeedUnit` in App.tsx**

Change the existing settings import line in `App.tsx` from:

```ts
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings, type ThemeKey } from './src/lib/settings';
```

to:

```ts
import { DEFAULT_SETTINGS, detectSpeedUnit, loadSettings, saveSettings, type Settings, type ThemeKey } from './src/lib/settings';
```

- [ ] **Step 2: Update the `loadSettings` callback to auto-detect**

Replace the existing `loadSettings` effect (lines 59–64):

```ts
useEffect(() => {
  loadSettings().then(s => {
    setSettings(s);
    setThemeKey(s.theme);
  });
}, []);
```

with:

```ts
useEffect(() => {
  loadSettings().then(s => {
    const resolved = s.speedUnitIsManuallySet
      ? s
      : { ...s, speedUnit: detectSpeedUnit() };
    setSettings(resolved);
    setThemeKey(resolved.theme);
    if (!s.speedUnitIsManuallySet) saveSettings(resolved);
  });
}, []);
```

- [ ] **Step 3: Update `updateSettings` to lock the flag on manual speed unit change**

Replace the existing `updateSettings` function (lines 72–77):

```ts
function updateSettings<K extends keyof Settings>(key: K, value: Settings[K]) {
  const next = { ...settings, [key]: value };
  setSettings(next);
  saveSettings(next);
  if (key === 'theme') setThemeKey(value as ThemeKey);
}
```

with:

```ts
function updateSettings<K extends keyof Settings>(key: K, value: Settings[K]) {
  const next: Settings = key === 'speedUnit'
    ? { ...settings, speedUnit: value as 'km' | 'miles', speedUnitIsManuallySet: true }
    : { ...settings, [key]: value };
  setSettings(next);
  saveSettings(next);
  if (key === 'theme') setThemeKey(value as ThemeKey);
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual verification — new install simulation**

In the iOS simulator, find and delete `settings_v1.json` from the app's documents directory, or reinstall the app. Launch. Open Settings screen and confirm `speedUnit` reflects the device locale (e.g. `miles` on a US-region device, `km` on a metric device).

- [ ] **Step 6: Manual verification — manual override persists**

Tap the km/mph toggle in Settings. Close the app and relaunch. Confirm the chosen unit is still shown and was not overwritten by locale detection.

- [ ] **Step 7: Manual verification — existing user with no flag**

In the simulator, edit `settings_v1.json` directly to remove `speedUnitIsManuallySet` (or set it to `false`). Relaunch. Confirm locale detection runs and updates the unit.

- [ ] **Step 8: Manual verification — UK locale**

In iOS Settings → General → Language & Region, set Region to United Kingdom. Relaunch the app (with `speedUnitIsManuallySet` absent or `false`). Confirm `miles` is selected.

- [ ] **Step 9: Commit**

```bash
git add App.tsx
git commit -m "feat: auto-detect speed unit from phone locale on first launch"
```
