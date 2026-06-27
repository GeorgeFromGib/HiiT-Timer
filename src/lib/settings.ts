import { File, Paths } from 'expo-file-system';

export type ThemeKey = 'tidal' | 'daybreak';

export interface Settings {
  theme: ThemeKey;
  congratsMessage: boolean;
  finalCountdownBeep: boolean;
  keepScreenAwake: boolean;
  hapticFeedback: boolean;
  soundCues: boolean;
  soundOff: boolean;
  countdownFlash: boolean;
  soundVolume: number; // 0–100
  speedUnit: 'km' | 'miles';
  speedUnitIsManuallySet: boolean;
  language: 'en' | 'es' | 'fr';
  languageIsManuallySet: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'daybreak',
  congratsMessage: true,
  finalCountdownBeep: true,
  keepScreenAwake: true,
  hapticFeedback: true,
  soundCues: true,
  soundOff: false,
  countdownFlash: true,
  soundVolume: 100,
  speedUnit: 'km',
  speedUnitIsManuallySet: false,
  language: 'en',
  languageIsManuallySet: false,
};

const settingsFile = () => new File(Paths.document, 'settings_v1.json');

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
  try {
    const f = settingsFile();
    if (!f.exists) return DEFAULT_SETTINGS;
    const raw = await f.text();
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    settingsFile().write(JSON.stringify(settings));
  } catch {}
}
