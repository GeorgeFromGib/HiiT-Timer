# Onboarding Modal Design

## Purpose

Introduce a versioned onboarding modal that surfaces on app launch to explain what's new and let the user set a few preferences before their first session. Version 1 introduces voice cues, folders, and multi-activity-type support as informational copy, lets the user pick a theme, and lets them directly set the two settings tied to the informational copy: whether folders are shown, and whether voice prompts replace chimes — all already exist in the app but have no first-run introduction.

Unlike a typical "first launch ever" flag, this is **version-based**: it targets both brand-new installs and existing users updating to a version that introduces new settings. Future releases that add settings worth calling out can bump the version and update the modal's content to introduce those, and everyone (new or existing) sees it once.

UI is pixel-modeled on `design/Hiit-Timer.zip`'s `welcome-modal.jsx` (`WelcomeModal`) for the overall sheet layout — header, "What's new" list, theme picker, sticky footer. The "Quick setup" section deviates from that reference in one respect: instead of the design's sound/haptic/keep-awake toggles, it exposes **Show folders** and **Voice prompts instead of chimes** — per explicit product decision, since those are the two settings the "What's new" copy actually introduces. The theme picker matches the reference design as-is.

## Data model

`src/lib/settings.ts`:

- Add `onboardingVersion: number` to the `Settings` interface. **(done)**
- Add `onboardingVersion: 0` to `DEFAULT_SETTINGS`. **(done)**
- No changes needed to `loadSettings()` — the existing `{ ...DEFAULT_SETTINGS, ...JSON.parse(raw) }` merge already yields `0` for any settings file saved before this field existed, and for brand-new installs with no file at all.

## Version constant

Exported from `src/components/OnboardingModal.tsx`:

```ts
export const CURRENT_ONBOARDING_VERSION = 1;
```

Future onboarding content changes bump this constant and update the modal's copy/toggles in the same commit, keeping the version and its content colocated.

## Component: `src/components/OnboardingModal.tsx`

A bottom sheet (`Modal` with `animationType="slide"`, dimmed backdrop, rounded top corners, decorative drag handle), not a centered card — matching `WelcomeModal`'s layout rather than `PaywallModal`'s. No backdrop-tap dismiss; `onRequestClose={() => {}}` (no-op, not omitted) so the Android hardware back button doesn't dismiss it but RN's required-prop warning is still suppressed.

Reads and writes settings via `useSettings()` internally (same as `SettingsScreen.tsx`), not via `settings`/`updateSettings` props — the modal mounts inside the existing `SettingsContext.Provider` in `App.tsx`, so prop-drilling them would be redundant.

Content, top to bottom, in a `ScrollView` inside the sheet:

1. **Header** — app-glyph badge (stopwatch icon on accent-filled rounded square), title "Welcome to Clear HiiT", subtitle explaining what follows.
2. **"What's new"** — three informational feature rows (icon + title + sub-copy), purely descriptive, no controls: voice cues, folders, multi-activity-type support.
3. **"Quick setup"**:
   - **Appearance** — the two themes as compact swatches (condensed variant of `ThemeCard`, built locally in this file — smaller gradient preview, single accent dot, no phase dots or note line). Selecting a swatch calls `updateSettings('theme', ...)` **immediately** (live re-theme), matching `SettingsScreen.tsx`'s `ThemeCard` — it reads `themeKey` straight from `useTheme()` rather than holding its own local copy. A deferred/batched theme selection was tried first and discarded: nothing visually changed when tapping a swatch (only the checkmark moved), which read as broken next to every other theme picker in the app applying instantly.
   - A card (`SettingsRow` + `SettingsToggle`, same components `SettingsScreen.tsx` already uses for these exact settings) with two toggles:
     - **Show Folders** (`settings.hideFoldersLabel`/`Sub`) — bound to local `showFolders` state, initialized from `!settings.hideFolders` (inverted, matching `SettingsScreen.tsx`'s existing toggle).
     - **Voice announcements** (`settings.voiceCuesLabel`/`Sub`) — bound to local `voiceCues` state, initialized from `settings.voiceCues`.

   No sound/haptic/keep-awake toggles in this version — an earlier iteration matched `WelcomeModal`'s full "Quick setup" (theme + those 3 toggles) exactly, but per explicit decision that part of the scope was narrowed to just the two settings the "What's new" copy above actually introduces. Theme selection was kept.

Sticky footer (outside the `ScrollView`, matching `PaywallModal`'s pattern of buttons outside scrollable content):

- **"Get Started"** (primary, accent-filled). On press: writes `hideFolders` (inverted from `showFolders`), `voiceCues`, and `onboardingVersion: CURRENT_ONBOARDING_VERSION` via `updateSettings`, then calls `onConfirm(showFolders)`. (`theme` isn't included — it's already been applied live by the swatch tap, if any.)
- **"Set up later"** (text button, skip path). On press: writes only `onboardingVersion: CURRENT_ONBOARDING_VERSION` via `updateSettings`, then calls `onConfirm()` (no argument). Any theme tap already took effect (live); the two toggles' pending local changes are discarded since they were never applied.

`onConfirm` takes an optional `showFolders: boolean` so `App.tsx` can react to the folders choice — see Wiring below. This exists because `App.tsx`'s initial-route decision (`if (!resolved.hideFolders) setRouteState({ name: 'Folders' })`) only runs once at launch off the settings loaded from disk, before the user has interacted with this modal. Without passing the value up, turning "Show Folders" on and confirming would save `hideFolders` correctly but leave the user stranded on the Sessions screen instead of navigating to Folders.

Local component state (`showFolders`, `voiceCues`) initializes from `settings` on mount, **and re-syncs whenever `visible` becomes `true`** — the modal mounts once at launch (always rendered, `visible` toggles, mirroring `PaywallModal`'s pattern so RN's slide-down close animation plays), before `App.tsx`'s `loadSettings()` effect has resolved. Without the re-sync, an existing user's actual saved toggle values would never be reflected — the sheet would silently show stale defaults from the moment of first mount. Theme doesn't need this treatment since it reads live from `useTheme()`, not local state.

`updateSettings` in `App.tsx` was fixed to use `setSettings(prev => ...)` instead of closing over the render's `settings` variable, so the sequential `updateSettings` calls in `handleConfirm` (and the live theme-swatch tap landing between them) compose correctly — previously only the last call's change would have survived, silently dropping the rest.

Known gap, not addressed: `SettingsScreen.tsx`'s own "Show Folders" toggle disables itself (`canHideFolders = data.folders.length <= 1`) when more than one folder already exists, to prevent orphaning a multi-folder layout. The onboarding toggle doesn't replicate that guard — it would require loading session/folder data into this modal — so an existing user updating with multiple folders already created could toggle folders off here without the same protection Settings gives them. Low risk in practice (onboarding fires once, typically before multiple folders exist) but worth knowing if this modal outlives v1.

## Wiring in `App.tsx`

- Inside the existing `loadSettings().then(...)` effect, after settings resolve: `setShowOnboarding(resolved.onboardingVersion < CURRENT_ONBOARDING_VERSION)`.
- `<OnboardingModal visible={showOnboarding} onConfirm={showFolders => { setShowOnboarding(false); if (typeof showFolders === 'boolean') setRoute(showFolders ? { name: 'Folders' } : { name: 'Sessions' }); }} />` renders at the top level, as a sibling to the route rendering, inside the existing context providers — so it overlays whichever initial route was chosen (Sessions or Folders) regardless of the `hideFolders`-based route decision that already happens in that same effect.
- This deviates from `PaywallModal`'s per-screen mounting convention (each screen owns its own `showPaywall` state) because onboarding is a launch-scoped concern, not tied to any one screen.
- The `onConfirm` handler re-runs the same `hideFolders → route` rule the launch effect above uses, but reactively: if the user chose "Show Folders" in the modal, it navigates to `Folders`; if they explicitly turned it off, it navigates to `Sessions`; on skip (`showFolders` is `undefined`), it doesn't touch the route at all, since nothing changed.

## i18n

New `onboarding.*` keys added in `src/locales/en.ts`, `es.ts`, `fr.ts`, following the existing nested key convention: `title`, `subtitle`, `whatsNew`, `feature1Title`/`feature1Sub`, `feature2Title`/`feature2Sub`, `feature3Title`/`feature3Sub`, `quickSetup`, `confirm`, `later`.

The two toggle rows reuse the existing `settings.hideFoldersLabel`/`Sub` and `settings.voiceCuesLabel`/`Sub` keys, and the theme subsection reuses `settings.appearance` — rather than duplicating copy, these are the same settings `SettingsScreen.tsx` already exposes.

## Testing

This repo has no test framework configured (per `CLAUDE.md`: "There are no tests or a linter configured yet"). Per explicit decision, no new test infrastructure will be added for this feature. Verification will be manual:

1. Fresh install (no settings file) → modal appears on first launch, theme reflects the resolved default (Daybreak) and both toggles reflect resolved defaults (folders OFF, voice cues OFF).
2. Tap a theme swatch → whole modal (and app underneath) re-themes immediately. Toggle both settings on, confirm → modal closes, `Settings` screen reflects the new theme and folders shown/voice prompts enabled.
3. Relaunch app → modal does not reappear.
4. "Set up later" → modal closes; any theme tap persists (already applied live), but toggle changes are discarded — only `onboardingVersion` plus whatever theme was tapped, if any, changed.
5. Simulate an existing install by manually writing a `settings_v1.json` without `onboardingVersion` (or with `onboardingVersion: 0`) and a non-default theme/`hideFolders`/`voiceCues` combo → modal appears once on next launch with the theme swatches and toggles pre-filled with those actual saved values (not defaults), then not again after confirming or skipping.

## Out of scope

- No test infrastructure changes.
- No sound/haptic/keep-awake toggles in the onboarding modal, despite `WelcomeModal` showing them — narrowed to just `hideFolders`/`voiceCues` (plus theme) per explicit decision.
- No changes to the underlying `theme`/`hideFolders`/`voiceCues` settings behavior elsewhere in the app — this only adds a first-run entry point for setting them.
- No replication of `SettingsScreen.tsx`'s folder-count guard on the "Show Folders" toggle (see Known gap above).
