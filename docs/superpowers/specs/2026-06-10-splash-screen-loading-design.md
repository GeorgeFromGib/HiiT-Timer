# Splash Screen Loading Design

**Date:** 2026-06-10  
**Status:** Approved

## Problem

The native Expo splash screen (`hiit-splash.png`) disappears as soon as the JS bundle loads, before fonts or audio are ready. This causes a blank white screen flash before the app becomes usable.

## Goal

Keep the native splash screen visible until both fonts and the audio session are initialised, then reveal the app in one step — no blank flash, no custom JS splash component needed.

## Approach

Use `expo-splash-screen` to hold the native splash open programmatically, then release it once all async startup work is complete.

## Changes

### `package.json`
Install `expo-splash-screen` via `npx expo install expo-splash-screen`. No plugin entry needed in `app.json` for SDK 56.

### `index.ts`
Call `SplashScreen.preventAutoHideAsync()` at module level (before `registerRootComponent`). This must run synchronously during boot — not inside a component — so the splash is held from the first JS tick.

### `App.tsx`
Replace the current `if (!fontsLoaded) return null` guard with a two-signal loading model:

- **`fontsLoaded`** — already provided by `useFonts`
- **`audioReady`** — new `useState(false)`, set to `true` once `configureAudioSession()` resolves in a `useEffect` (runs once on mount, errors are caught so a failure doesn't freeze the splash)

A second `useEffect` watches both signals; when `fontsLoaded && audioReady` it calls `SplashScreen.hideAsync()`. The component still returns `null` while loading — the native splash covers it.

Both `useFonts` and `configureAudioSession()` start simultaneously (font loading is triggered by `useFonts` on mount; audio init fires in its own `useEffect` on mount), so startup is parallel, not sequential.

### `audio.ts`
No changes. `configureAudioSession()` is already exported and correct.

## What is not changing

- `loadSettings()` is left as-is — it's a fast local file read and doesn't cause a visible flash.
- The splash image and `app.json` splash config are unchanged.
- Audio player instances are not pre-created at startup — `configureAudioSession()` is sufficient to eliminate first-sound latency on iOS.

## Success criteria

- No blank screen flash between native splash and app render on a dev build.
- `configureAudioSession()` completes before the first screen is shown.
- If `configureAudioSession()` throws, the splash still hides and the app loads normally.
