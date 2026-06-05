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
import React, { useEffect, useState } from 'react';
import SessionsListScreen from './src/SessionsListScreen';
import WorkoutScreen from './src/WorkoutScreen';
import EditSessionScreen from './src/EditSessionScreen';
import SettingsScreen from './src/SettingsScreen';
import type { Route } from './src/navigation';
import { ThemeContext, THEME_TOKENS } from './src/theme';
import { loadSettings, type ThemeKey } from './src/settings';

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_700Bold_Italic,
    Inter_800ExtraBold,
    Inter_900Black,
    ChakraPetch_700Bold,
  });

  const [route, setRoute] = useState<Route>({ name: 'Sessions' });
  const [themeKey, setThemeKey] = useState<ThemeKey>('tidal');

  useEffect(() => {
    loadSettings().then(s => setThemeKey(s.theme));
  }, []);

  const setTheme = (key: ThemeKey) => setThemeKey(key);

  if (!fontsLoaded) return null;

  const goBack = () => setRoute({ name: 'Sessions' });
  const T = THEME_TOKENS[themeKey];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeContext.Provider value={{ T, themeKey, setTheme }}>
      {route.name === 'Workout' && (
        <>
          <WorkoutScreen session={route.session} onBack={goBack} />
          <StatusBar style={themeKey === 'daybreak' ? 'dark' : 'light'} />
        </>
      )}
      {route.name === 'EditSession' && (
        <>
          <EditSessionScreen session={route.session} onBack={goBack} />
          <StatusBar style={themeKey === 'daybreak' ? 'dark' : 'light'} />
        </>
      )}
      {route.name === 'Settings' && (
        <>
          <SettingsScreen onBack={goBack} />
          <StatusBar style={themeKey === 'daybreak' ? 'dark' : 'light'} />
        </>
      )}
      {route.name === 'Sessions' && (
        <>
          <SessionsListScreen onNavigate={setRoute} />
          <StatusBar style={themeKey === 'daybreak' ? 'dark' : 'light'} />
        </>
      )}
    </ThemeContext.Provider>
    </GestureHandlerRootView>
  );
}
