import { useEffect, useState } from 'react';
import {
  DEFAULT_SETTINGS, detectSpeedUnit, loadSettings, saveSettings,
  type Settings,
} from '../lib/settings';
import { detectLanguage, i18n } from '../lib/i18n';

export interface SettingsState {
  settings: Settings;
  loading:  boolean;
  updateSettings: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export function useSettingsState(): SettingsState {
  const [settings, setSettings] = useState<Settings>({
    ...DEFAULT_SETTINGS,
    language: detectLanguage(),
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings().then(s => {
      const resolved: Settings = {
        ...s,
        speedUnit: s.speedUnitIsManuallySet ? s.speedUnit : detectSpeedUnit(),
        language:  s.languageIsManuallySet  ? s.language  : detectLanguage(),
      };
      i18n.locale = resolved.language;
      setSettings(resolved);
      setLoading(false);
      if (!s.speedUnitIsManuallySet || !s.languageIsManuallySet) saveSettings(resolved);
    });
  }, []);

  function updateSettings<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (key === ('language' satisfies keyof Settings)) i18n.locale = value as 'en' | 'es';
    setSettings(prev => {
      const next: Settings =
        key === ('speedUnit' satisfies keyof Settings)
          ? { ...prev, speedUnit: value as 'km' | 'miles', speedUnitIsManuallySet: true }
          : key === ('language' satisfies keyof Settings)
            ? { ...prev, language: value as 'en' | 'es', languageIsManuallySet: true }
            : { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }

  return { settings, loading, updateSettings };
}
