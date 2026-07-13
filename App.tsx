import { LogBox } from 'react-native';

// RN new-arch bug: ScrollView's keyboard-scroll calls measureLayout with a non-native ref.
// LogBox suppresses the in-app overlay; console.error override suppresses Metro terminal output.
if (__DEV__) {
  const _origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('ref.measureLayout must be called')) return;
    _origError(...args);
  };
}
LogBox.ignoreLogs(['ref.measureLayout must be called with a ref to a native component']);

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
import FoldersScreen from './src/screens/FoldersScreen';
import SessionsListScreen from './src/screens/SessionsListScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import EditSessionScreen from './src/screens/EditSessionScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import OnboardingModal, { CURRENT_ONBOARDING_VERSION } from './src/components/OnboardingModal';
import AppAlertModal from './src/components/AppAlertModal';
import type { Route } from './src/navigation';
import { ThemeContext, THEME_TOKENS, useTheme } from './src/theme';
import { type ThemeKey } from './src/lib/settings';
import { SettingsContext } from './src/lib/settingsContext';
import { PremiumContext } from './src/lib/premiumContext';
import { usePremiumState } from './src/hooks/usePremiumState';
import { useSettingsState } from './src/hooks/useSettingsState';
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [route, setRouteState] = useState<Route>({ name: 'Sessions' });
  const [previousRoute, setPreviousRoute] = useState<Route>({ name: 'Sessions' });
  const { settings, loading: settingsLoading, updateSettings } = useSettingsState();
  const premiumState = usePremiumState();

  const setRoute = (newRoute: Route) => {
    // Don't update previous route when navigating back to it
    if (newRoute.name !== previousRoute.name) {
      setPreviousRoute(route);
    }
    setRouteState(newRoute);
  };

  useEffect(() => {
    configureAudioSession().catch(() => {}).finally(() => setAudioReady(true));
  }, []);

  useEffect(() => {
    if (settingsLoading) return;
    setShowOnboarding(settings.onboardingVersion < CURRENT_ONBOARDING_VERSION);
    // Set initial route based on folder settings — a one-shot decision made when
    // settings finish loading, not a reactive response to later settings changes.
    if (!settings.hideFolders) {
      setRouteState({ name: 'Folders' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoading]);

  useEffect(() => {
    if (fontsLoaded && audioReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, audioReady]);

  const setTheme = (key: ThemeKey) => updateSettings('theme', key);

  if (!fontsLoaded || !audioReady) return null;

  const goBack = () => setRoute(previousRoute);
  const themeKey = settings.theme;
  const T = THEME_TOKENS[themeKey];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <PremiumContext.Provider value={premiumState}>
    <SettingsContext.Provider value={{ settings, updateSettings }}>
    <ThemeContext.Provider value={{ T, themeKey, setTheme }}>
      {route.name === 'Workout' && (
        <RouteScreen><WorkoutScreen session={route.session} onBack={goBack} /></RouteScreen>
      )}
      {route.name === 'EditSession' && (
        <RouteScreen>
          <EditSessionScreen
            session={route.session}
            activityType={route.activityType}
            folderId={route.folderId}
            onBack={goBack}
          />
        </RouteScreen>
      )}
      {route.name === 'Settings' && (
        <RouteScreen>
          <SettingsScreen
            onBack={() => setRoute(settings.hideFolders ? { name: 'Sessions' } : { name: 'Folders' })}
            onPrivacyPolicy={() => setRoute({ name: 'PrivacyPolicy' })}
          />
        </RouteScreen>
      )}
      {route.name === 'PrivacyPolicy' && (
        <RouteScreen>
          <PrivacyPolicyScreen onBack={() => setRoute({ name: 'Settings' })} />
        </RouteScreen>
      )}
      {route.name === 'Folders' && (
        <RouteScreen><FoldersScreen onNavigate={setRoute} /></RouteScreen>
      )}
      {route.name === 'Sessions' && (
        <RouteScreen><SessionsListScreen folderId={route.folderId} onNavigate={setRoute} /></RouteScreen>
      )}
      <OnboardingModal
        visible={showOnboarding}
        onConfirm={showFolders => {
          setShowOnboarding(false);
          if (typeof showFolders === 'boolean') {
            setRoute(showFolders ? { name: 'Folders' } : { name: 'Sessions' });
          }
        }}
      />
      <AppAlertModal />
    </ThemeContext.Provider>
    </SettingsContext.Provider>
    </PremiumContext.Provider>
    </GestureHandlerRootView>
  );
}
