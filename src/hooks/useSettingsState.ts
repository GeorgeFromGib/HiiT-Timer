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

// The single place that owns "use the saved value if the user manually set it,
// otherwise fall back to the device's auto-detected default" for speedUnit/language.
function resolveAutoDetected(saved: Settings): Settings {
  return {
    ...saved,
    speedUnit: saved.speedUnitIsManuallySet ? saved.speedUnit : detectSpeedUnit(),
    language:  saved.languageIsManuallySet  ? saved.language  : detectLanguage(),
  };
}

// The single place that records "the user explicitly picked this" for the two
// fields that carry a manual-override flag alongside their value.
function withManualOverride<K extends keyof Settings>(prev: Settings, key: K, value: Settings[K]): Settings {
  if (key === ('speedUnit' satisfies keyof Settings)) {
    return { ...prev, speedUnit: value as Settings['speedUnit'], speedUnitIsManuallySet: true };
  }
  if (key === ('language' satisfies keyof Settings)) {
    return { ...prev, language: value as Settings['language'], languageIsManuallySet: true };
  }
  return { ...prev, [key]: value };
}

export function useSettingsState(): SettingsState {
  const [settings, setSettings] = useState<Settings>({
    ...DEFAULT_SETTINGS,
    language: detectLanguage(),
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings().then(s => {
      const resolved = resolveAutoDetected(s);
      setSettings(resolved);
      setLoading(false);
      if (!s.speedUnitIsManuallySet || !s.languageIsManuallySet) saveSettings(resolved);
    });
  }, []);

  // Single place the i18n locale global gets synced from settings — replaces two
  // separate imperative `i18n.locale = ...` writes that could drift out of step.
  useEffect(() => {
    i18n.locale = settings.language;
  }, [settings.language]);

  function updateSettings<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(prev => {
      const next = withManualOverride(prev, key, value);
      saveSettings(next);
      return next;
    });
  }

  return { settings, loading, updateSettings };
}
