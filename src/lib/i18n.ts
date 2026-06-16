import { useCallback } from 'react';
import { I18n } from 'i18n-js';
import en from '../locales/en';
import es from '../locales/es'; // also used directly in getCongratsMessages
import { useSettings } from './settingsContext';

export type Language = 'en' | 'es';

export const i18n = new I18n(
  { en, es },
  { locale: 'en', defaultLocale: 'en', enableFallback: true },
);

export function detectLanguage(): Language {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    return getLocales()[0]?.languageCode === 'es' ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

export function getCongratsMessages(): string[] {
  return i18n.locale === 'es' ? es.congrats : en.congrats;
}

export function useTranslation() {
  const { settings } = useSettings();
  const locale = settings.language;
  const t = useCallback(
    (scope: string, opts?: object) => i18n.t(scope, { locale, ...opts }),
    [locale],
  );
  return { t, locale };
}
