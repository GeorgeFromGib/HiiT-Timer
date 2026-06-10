# Splash Screen Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the native splash screen visible until fonts and the audio session are both initialised, eliminating the blank screen flash on startup.

**Architecture:** `expo-splash-screen` holds the native splash open from the first JS tick (via `preventAutoHideAsync()` in `index.ts`). `App.tsx` tracks two parallel signals — `fontsLoaded` from `useFonts` and `audioReady` from `configureAudioSession()` — and calls `SplashScreen.hideAsync()` once both are true.

**Tech Stack:** expo-splash-screen (new install), expo-audio (existing), @expo-google-fonts (existing)

---

> **Note:** This project has no test suite configured. Each task includes a manual verification step instead of automated tests.

---

### Task 1: Install expo-splash-screen

**Files:**
- Modify: `package.json` (via install command)

- [ ] **Step 1: Install the package**

```bash
npx expo install expo-splash-screen
```

Expected output: package added to `package.json` dependencies, no errors.

- [ ] **Step 2: Verify install**

```bash
grep expo-splash-screen package.json
```

Expected: a line like `"expo-splash-screen": "~X.X.X"`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install expo-splash-screen"
```

---

### Task 2: Hold the splash open from the first JS tick

**Files:**
- Modify: `index.ts`

The call must be at module level — before `registerRootComponent` — so it runs synchronously before any component mounts.

- [ ] **Step 1: Update index.ts**

Replace the full contents of `index.ts` with:

```ts
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';

import App from './App';

SplashScreen.preventAutoHideAsync();

registerRootComponent(App);
```

- [ ] **Step 2: Commit**

```bash
git add index.ts
git commit -m "feat: prevent splash auto-hide at boot"
```

---

### Task 3: Hide the splash once fonts and audio are ready

**Files:**
- Modify: `App.tsx`

Two `useEffect` hooks run independently on mount:
- one triggers font loading (already handled by `useFonts`)
- one calls `configureAudioSession()` and sets `audioReady`

A third `useEffect` watches both and calls `SplashScreen.hideAsync()` when both are `true`. Errors from `configureAudioSession()` are caught so a failure never freezes the splash.

- [ ] **Step 1: Update App.tsx**

Replace the full contents of `App.tsx` with:

```tsx
import { LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_700Bold_Italic,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch';
import { useEffect, useState, type ReactNode } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import SessionsListScreen from './src/screens/SessionsListScreen';

LogBox.ignoreLogs(['ref.measureLayout must be called with a ref to a native component']);
import WorkoutScreen from './src/screens/WorkoutScreen';
import EditSessionScreen from './src/screens/EditSessionScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import type { Route } from './src/navigation';
import { ThemeContext, THEME_TOKENS, useTheme } from './src/theme';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings, type ThemeKey } from './src/lib/settings';
import { SettingsContext } from './src/lib/settingsContext';
import { configureAudioSession } from './src/lib/audio';

function RouteScreen({ children }: { children: ReactNode }) {
  const { themeKey } = useTheme();
  return (
    <>
      {children}
      <StatusBar style={themeKey === 'daybreak' ? 'dark' : 'light'} />
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_700Bold_Italic,
    Inter_800ExtraBold,
    Inter_900Black,
    ChakraPetch_700Bold,
  });

  const [audioReady, setAudioReady] = useState(false);
  const [route, setRoute] = useState<Route>({ name: 'Sessions' });
  const [themeKey, setThemeKey] = useState<ThemeKey>('tidal');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    configureAudioSession().catch(() => {}).finally(() => setAudioReady(true));
  }, []);

  useEffect(() => {
    loadSettings().then(s => {
      setSettings(s);
      setThemeKey(s.theme);
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded && audioReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, audioReady]);

  function updateSettings<K extends keyof Settings>(key: K, value: Settings[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
    if (key === 'theme') setThemeKey(value as ThemeKey);
  }

  const setTheme = (key: ThemeKey) => setThemeKey(key);

  if (!fontsLoaded || !audioReady) return null;

  const goBack = () => setRoute({ name: 'Sessions' });
  const T = THEME_TOKENS[themeKey];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SettingsContext.Provider value={{ settings, updateSettings }}>
    <ThemeContext.Provider value={{ T, themeKey, setTheme }}>
      {route.name === 'Workout' && (
        <RouteScreen><WorkoutScreen session={route.session} onBack={goBack} /></RouteScreen>
      )}
      {route.name === 'EditSession' && (
        <RouteScreen><EditSessionScreen session={route.session} onBack={goBack} /></RouteScreen>
      )}
      {route.name === 'Settings' && (
        <RouteScreen><SettingsScreen onBack={goBack} /></RouteScreen>
      )}
      {route.name === 'Sessions' && (
        <RouteScreen><SessionsListScreen onNavigate={setRoute} /></RouteScreen>
      )}
    </ThemeContext.Provider>
    </SettingsContext.Provider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual verification on device/simulator**

Start the app on an iOS simulator with a dev build:
```bash
npx expo start --ios
```

Observe:
- The splash screen (`hiit-splash.png`) stays visible while fonts and audio init
- No blank white flash between splash and first screen
- App loads normally into the Sessions screen

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: hold splash until fonts and audio session are ready"
```
