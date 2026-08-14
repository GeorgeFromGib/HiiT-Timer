import { AppState, LogBox } from 'react-native';

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
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import FoldersScreen from './src/screens/FoldersScreen';
import SessionsListScreen from './src/screens/SessionsListScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import EditSessionScreen from './src/screens/EditSessionScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import OnboardingModal, { CURRENT_ONBOARDING_VERSION } from './src/components/OnboardingModal';
import AppAlertModal from './src/components/AppAlertModal';
import { useNavigationStack } from './src/navigation';
import { ThemeContext, THEME_TOKENS, useTheme } from './src/theme';
import { type ThemeKey } from './src/lib/settings';
import { SettingsContext } from './src/lib/settingsContext';
import { PremiumContext } from './src/lib/premiumContext';
import { usePremiumState } from './src/hooks/usePremiumState';
import { useSettingsState } from './src/hooks/useSettingsState';
import { configureAudioSession } from './src/lib/audio';
import { checkForUpdate } from './src/lib/versionCheck';
import { loadSessions } from './src/lib/sessions';
import { subscribeToLiveSessionUpdates, nextLiveSessionAction, refreshLiveSession, type LiveSessionState } from './src/lib/liveSessionSync';

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
  const { route, navigate, goBack, resetTo } = useNavigationStack({ name: 'Sessions' });
  const { settings, loading: settingsLoading, updateSettings } = useSettingsState();
  const premiumState = usePremiumState();

  const [liveSessionState, setLiveSessionState] = useState<LiveSessionState | null>(null);
  const lastAppliedLiveUpdatedAtRef = useRef<number | null>(null);
  const mutedSessionIdRef = useRef<string | null>(null);
  const launchInFlightRef = useRef(false);

  useEffect(() => subscribeToLiveSessionUpdates(setLiveSessionState), []);

  // Catches up on a session the watch started while this device was
  // asleep/locked/backgrounded — the native side only pushes updates while
  // the app is alive to receive them (see refreshLiveSession's doc comment).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshLiveSession();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!liveSessionState) { mutedSessionIdRef.current = null; return; }
    if (launchInFlightRef.current) return;
    if (liveSessionState.status === 'finished' || liveSessionState.status === 'terminated') return; // never auto-launch a session that's already over
    const currentSessionId = route.name === 'Workout' ? route.session.id : null;
    if (currentSessionId === liveSessionState.sessionId) return; // WorkoutScreen applies this directly
    // Stay muted for this sessionId no matter how new the incoming updatedAt gets —
    // the peer's heartbeat keeps advancing updatedAt every ~2s, which would otherwise
    // immediately defeat a dismiss. The mute only lifts once this broadcast clears
    // (handled above) or a different session starts broadcasting.
    if (liveSessionState.sessionId === mutedSessionIdRef.current) return;
    const action = nextLiveSessionAction(currentSessionId, lastAppliedLiveUpdatedAtRef.current, liveSessionState, Date.now());
    if (action.type !== 'launchNew') return;
    const initialStatus = liveSessionState.status; // narrowed to 'running' | 'paused' here; capture before the async closure below
    lastAppliedLiveUpdatedAtRef.current = liveSessionState.updatedAt;
    launchInFlightRef.current = true;
    loadSessions().then(({ sessions }) => {
      const session = sessions.find(s => s.id === action.sessionId);
      if (session) navigate({ name: 'Workout', session, initialResumeElapsed: action.resumeElapsed, initialStatus });
    }).finally(() => { launchInFlightRef.current = false; });
  }, [liveSessionState, route, navigate]);

  const handleLiveSessionDismiss = useCallback((sessionId: string) => {
    mutedSessionIdRef.current = sessionId;
  }, []);

  useEffect(() => {
    configureAudioSession().catch(() => {}).finally(() => setAudioReady(true));
  }, []);

  useEffect(() => {
    checkForUpdate();
  }, []);

  useEffect(() => {
    if (settingsLoading) return;
    setShowOnboarding(settings.onboardingVersion < CURRENT_ONBOARDING_VERSION);
    // Set initial route based on folder settings — a one-shot decision made when
    // settings finish loading, not a reactive response to later settings changes.
    if (!settings.hideFolders) {
      resetTo({ name: 'Folders' });
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

  const themeKey = settings.theme;
  const T = THEME_TOKENS[themeKey];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <PremiumContext.Provider value={premiumState}>
    <SettingsContext.Provider value={{ settings, updateSettings }}>
    <ThemeContext.Provider value={{ T, themeKey, setTheme }}>
      {route.name === 'Workout' && (
        <RouteScreen>
          <WorkoutScreen
            session={route.session}
            onBack={goBack}
            initialResumeElapsed={route.initialResumeElapsed}
            initialStatus={route.initialStatus}
            incomingLiveSession={liveSessionState?.sessionId === route.session.id ? liveSessionState : null}
            onLiveSessionDismiss={handleLiveSessionDismiss}
          />
        </RouteScreen>
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
            onBack={() => navigate(settings.hideFolders ? { name: 'Sessions' } : { name: 'Folders' })}
            onPrivacyPolicy={() => navigate({ name: 'PrivacyPolicy' })}
          />
        </RouteScreen>
      )}
      {route.name === 'PrivacyPolicy' && (
        <RouteScreen>
          <PrivacyPolicyScreen onBack={goBack} />
        </RouteScreen>
      )}
      {route.name === 'Folders' && (
        <RouteScreen><FoldersScreen onNavigate={navigate} /></RouteScreen>
      )}
      {route.name === 'Sessions' && (
        <RouteScreen><SessionsListScreen folderId={route.folderId} onNavigate={navigate} /></RouteScreen>
      )}
      <OnboardingModal
        visible={showOnboarding}
        onConfirm={showFolders => {
          setShowOnboarding(false);
          resetTo(showFolders ? { name: 'Folders' } : { name: 'Sessions' });
        }}
      />
      <AppAlertModal />
    </ThemeContext.Provider>
    </SettingsContext.Provider>
    </PremiumContext.Provider>
    </GestureHandlerRootView>
  );
}
