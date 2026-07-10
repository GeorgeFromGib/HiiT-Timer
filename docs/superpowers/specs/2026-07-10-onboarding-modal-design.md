# Onboarding Modal Design

## Purpose

Introduce a versioned onboarding modal that surfaces on app launch to explain and let the user set new settings introduced in a given release. Version 1 covers two settings that already exist in the app but have no first-run introduction: whether folders are shown, and whether voice prompts replace chimes.

Unlike a typical "first launch ever" flag, this is **version-based**: it targets both brand-new installs and existing users updating to a version that introduces new settings. Future releases that add settings worth calling out can bump the version and update the modal's content to introduce those, and everyone (new or existing) sees it once.

## Data model

`src/lib/settings.ts`:

- Add `onboardingVersion: number` to the `Settings` interface.
- Add `onboardingVersion: 0` to `DEFAULT_SETTINGS`.
- No changes needed to `loadSettings()` — the existing `{ ...DEFAULT_SETTINGS, ...JSON.parse(raw) }` merge already yields `0` for any settings file saved before this field existed, and for brand-new installs with no file at all.

## Version constant

Exported from the new `OnboardingModal.tsx` component:

```ts
export const CURRENT_ONBOARDING_VERSION = 1;
```

Future onboarding content changes bump this constant and update the modal's copy/toggles in the same commit, keeping the version and its content colocated.

## Component: `src/components/OnboardingModal.tsx`

Modeled on the structure of `PaywallModal.tsx` (`Modal` + overlay `Pressable` + card `Pressable` with `stopPropagation` on the card), with these differences:

- No backdrop-tap dismiss, no `onRequestClose` skip path. The only way to close it is the confirm button — this is a settings-collection step, not a dismissible promo.
- Title: "Welcome to Clear HiiT" (welcome framing, chosen despite also applying to existing users updating).
- Body copy: brief line introducing that a couple of preferences can be set now and changed later in Settings.
- Two rows using the existing `SettingsRow` + `SettingsToggle` components (same ones `SettingsScreen.tsx` already uses for these exact settings), so the modal looks native to the rest of the app:
  - **Show folders** — bound to `!settings.hideFolders` (inverted, matching `SettingsScreen.tsx`'s existing `hideFolders` toggle), defaults OFF (matches `hideFolders: true` default).
  - **Voice prompts instead of chimes** — bound to `settings.voiceCues`, defaults OFF (chimes remain the default; matches `voiceCues: false` default).
- Single confirm button ("Get Started"). On press: writes `hideFolders` (inverted from the toggle state), `voiceCues`, and `onboardingVersion: CURRENT_ONBOARDING_VERSION` via `updateSettings`, then the modal closes as a result of the visibility check flipping to false (no separate `onDismiss` callback needed, unlike `PaywallModal`).

Local component state holds the two toggle values (initialized from `settings.hideFolders`/`settings.voiceCues` when the modal mounts) so the user can flip them before confirming, mirroring how `SettingsScreen` toggles work but batched into one save on confirm rather than saved per-toggle.

## Wiring in `App.tsx`

- Inside the existing `loadSettings().then(...)` effect, after settings resolve: compute `showOnboarding = resolved.onboardingVersion < CURRENT_ONBOARDING_VERSION` and store in state.
- Render `<OnboardingModal visible={showOnboarding} settings={settings} updateSettings={updateSettings} onConfirm={() => setShowOnboarding(false)} />` at the top level, as a sibling to the route rendering, inside the existing context providers — so it overlays whichever initial route was chosen (Sessions or Folders) regardless of the `hideFolders`-based route decision that already happens in that same effect.
- This deviates from `PaywallModal`'s per-screen mounting convention (each screen owns its own `showPaywall` state) because onboarding is a launch-scoped concern, not tied to any one screen.

## i18n

New keys in `src/locales/en.ts`, `es.ts`, `fr.ts`, following the existing nested key convention (e.g. `paywall.*`, `settings.*`):

- `onboarding.title`
- `onboarding.body`
- `onboarding.showFolders`
- `onboarding.voicePrompts`
- `onboarding.confirm`

Toggle row labels can reuse copy consistent with `settings.hideFoldersLabel` / `settings.voiceCuesLabel` phrasing where it makes sense, but worded for a first-run introduction rather than an ongoing settings screen.

## Testing

This repo has no test framework configured (per `CLAUDE.md`: "There are no tests or a linter configured yet"). Per explicit decision, no new test infrastructure will be added for this feature. Verification will be manual:

1. Fresh install (no settings file) → modal appears on first launch with both toggles OFF.
2. Toggle both on, confirm → modal closes, `Settings` screen reflects folders shown and voice prompts enabled.
3. Relaunch app → modal does not reappear.
4. Simulate an existing install by manually writing a `settings_v1.json` without `onboardingVersion` (or with `onboardingVersion: 0`) → modal appears once on next launch, then not again after confirming.

## Out of scope

- No "skip" or partial-dismiss path.
- No test infrastructure changes.
- No changes to the underlying `hideFolders`/`voiceCues` settings behavior elsewhere in the app — this only adds a first-run entry point for setting them.
