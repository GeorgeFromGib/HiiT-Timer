import { readJsonFile, writeJsonFile } from './jsonFile';

export type ThemeKey = 'tidal' | 'daybreak';

export interface Settings {
  theme: ThemeKey;
  congratsMessage: boolean;
  finalCountdownBeep: boolean;
  keepScreenAwake: boolean;
  hapticFeedback: boolean;
  voiceCues: boolean;
  minimalVoicePrompts: boolean;
  soundCues: boolean;
  soundOff: boolean;
  countdownFlash: boolean;
  soundVolume: number; // 0–100
  speedUnit: 'km' | 'miles';
  speedUnitIsManuallySet: boolean;
  language: 'en' | 'es' | 'fr';
  languageIsManuallySet: boolean;
  hideFolders: boolean;
  onboardingVersion: number;
  name: string;
  // Set once the "What is a Tabata workout?" writeup has been auto-shown on the first
  // Tabata session the user creates.
  tabataIntroSeen: boolean;
  // One-time feature tips, auto-shown once each then never again — see
  // EditSessionScreen (incline) and SettingsScreen (watch, minimal voice prompts).
  inclineTipSeen: boolean;
  watchTipSeen: boolean;
  minimalVoiceTipSeen: boolean;
  // One-time nudge pointing at the + button, shown the first time a session
  // already exists (almost always right after onboarding).
  addSessionTipSeen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'daybreak',
  congratsMessage: true,
  finalCountdownBeep: true,
  keepScreenAwake: true,
  hapticFeedback: true,
  voiceCues: false,
  minimalVoicePrompts: false,
  soundCues: true,
  soundOff: false,
  countdownFlash: true,
  soundVolume: 100,
  speedUnit: 'km',
  speedUnitIsManuallySet: false,
  language: 'en',
  languageIsManuallySet: false,
  hideFolders: true,
  onboardingVersion: 0,
  name: '',
  tabataIntroSeen: false,
  inclineTipSeen: false,
  watchTipSeen: false,
  minimalVoiceTipSeen: false,
  addSessionTipSeen: false,
};

const SETTINGS_FILE = 'settings_v1.json';

export function detectSpeedUnit(): 'km' | 'miles' {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    const system = getLocales()[0]?.measurementSystem;
    return system === 'us' || system === 'uk' ? 'miles' : 'km';
  } catch {
    return 'km';
  }
}

export async function loadSettings(): Promise<Settings> {
  const parsed = await readJsonFile<Partial<Settings>>(SETTINGS_FILE);
  return parsed ? { ...DEFAULT_SETTINGS, ...parsed } : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  writeJsonFile(SETTINGS_FILE, settings);
}
