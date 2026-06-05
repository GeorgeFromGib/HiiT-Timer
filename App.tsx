import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_700Bold_Italic,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch';
import React, { useState } from 'react';
import SessionsListScreen from './src/SessionsListScreen';
import WorkoutScreen from './src/WorkoutScreen';
import EditSessionScreen from './src/EditSessionScreen';
import type { Route } from './src/navigation';

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

  if (!fontsLoaded) return null;

  const goBack = () => setRoute({ name: 'Sessions' });

  if (route.name === 'Workout') {
    return (
      <>
        <WorkoutScreen session={route.session} onBack={goBack} />
        <StatusBar style="light" />
      </>
    );
  }

  if (route.name === 'EditSession') {
    return (
      <>
        <EditSessionScreen session={route.session} onBack={goBack} />
        <StatusBar style="light" />
      </>
    );
  }

  return (
    <>
      <SessionsListScreen onNavigate={setRoute} />
      <StatusBar style="light" />
    </>
  );
}
