import { StatusBar } from 'expo-status-bar';
import WorkoutScreen from './src/WorkoutScreen';

export default function App() {
  return (
    <>
      <WorkoutScreen />
      <StatusBar style="light" />
    </>
  );
}
