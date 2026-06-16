# Phone Locale → Speed Unit Auto-Detection

**Date:** 2026-06-16  
**Branch:** read-phone-settings  
**Status:** Approved

## Goal

On first use (and for existing users who have never manually changed the speed unit), read the phone's system locale to auto-select `km` or `miles`. Once a user explicitly picks a unit in Settings, that choice is respected permanently.

## Data Model

### `Settings` type — `src/lib/settings.ts`

Add one new field:

```ts
speedUnitIsManuallySet: boolean  // default: false
```

Default value: `false`. When `false`, the app will auto-detect on every launch. When `true`, the saved `speedUnit` is always used as-is.

Existing users who have never touched the toggle will have no `speedUnitIsManuallySet` key in their `settings_v1.json`. The merge in `loadSettings()` (`{ ...DEFAULT_SETTINGS, ...JSON.parse(raw) }`) will fill in `false`, so they get auto-detected on their next launch.

### Locale detection helper

```ts
// src/lib/settings.ts
import { getLocales } from 'expo-localization';

export function detectSpeedUnit(): 'km' | 'miles' {
  const system = getLocales()[0]?.measurementSystem;
  return system === 'us' || system === 'uk' ? 'miles' : 'km';
}
```

Mapping:
- `'us'` → `miles` (United States)
- `'uk'` → `miles` (UK uses miles informally for running/roads)
- `'metric'` / `null` / `undefined` → `km`

## App Startup — `App.tsx`

In the existing `loadSettings().then()` callback:

```ts
loadSettings().then(s => {
  const resolved = s.speedUnitIsManuallySet
    ? s
    : { ...s, speedUnit: detectSpeedUnit() };
  setSettings(resolved);
  setThemeKey(resolved.theme);
  if (!s.speedUnitIsManuallySet) saveSettings(resolved);
});
```

- If already manually set: use as-is, no save needed.
- If not manually set: detect locale, update `speedUnit`, save immediately so the correct value persists.

## User Interaction — `App.tsx`

In `updateSettings()`, when the user changes `speedUnit`, also lock in the manual flag:

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

No changes required to `SettingsScreen` — the existing km/mph toggle UI is unchanged.

## Dependency

`expo-localization` is not currently installed. Install with:

```bash
npx expo install expo-localization
```

`getLocales()` is synchronous — no async/await needed.

## Files Changed

| File | Change |
|---|---|
| `package.json` | Add `expo-localization` |
| `src/lib/settings.ts` | Add `speedUnitIsManuallySet` field + `detectSpeedUnit()` helper |
| `App.tsx` | Auto-detect on load; lock flag on manual unit change |

## Testing

Manual steps (no test framework configured):

1. **New install simulation** — delete `settings_v1.json` from the device, relaunch. Confirm `speedUnit` reflects the device locale (e.g. `miles` on a US-region device, `km` on a metric device).
2. **Manual override** — tap the km/mph toggle in Settings. Close and relaunch. Confirm the chosen unit persists and is not overwritten by locale detection.
3. **Existing user simulation** — manually edit `settings_v1.json` to remove `speedUnitIsManuallySet` (or set to `false`). Relaunch. Confirm locale detection runs and updates the unit.
4. **UK locale** — set device region to UK. Confirm `miles` is selected.
5. **Null/unknown locale** — simulate missing `measurementSystem` (e.g. force `getLocales()` to return `[]` in dev). Confirm fallback is `km`.
