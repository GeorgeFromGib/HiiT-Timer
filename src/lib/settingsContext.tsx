import { createContext, useContext } from 'react';
import { DEFAULT_SETTINGS, type Settings } from './settings';

type SettingsContextValue = {
  settings: Settings;
  updateSettings: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

export const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}
