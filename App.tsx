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
