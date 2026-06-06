import { File, Paths } from 'expo-file-system';

export type ThemeKey = 'tidal' | 'daybreak';

export interface Settings {
  theme: ThemeKey;
  congratsMessage: boolean;
  finalCountdownBeep: boolean;
  keepScreenAwake: boolean;
  soundCues: boolean;
  hapticFeedback: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'tidal',
  congratsMessage: true,
  finalCountdownBeep: true,
  keepScreenAwake: true,
  soundCues: true,
  hapticFeedback: true,
};

const settingsFile = () => new File(Paths.document, 'settings_v1.json');

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
