import { I18n } from 'i18n-js';
import en from '../locales/en';
import es from '../locales/es'; // also used directly in getCongratsMessages
import fr from '../locales/fr'; // also used directly in getCongratsMessages
import de from '../locales/de'; // also used directly in getCongratsMessages

export type Language = 'en' | 'es' | 'fr' | 'de';

export const i18n = new I18n(
  { en, es, fr, de },
  { locale: 'en', defaultLocale: 'en', enableFallback: true },
);

export function detectLanguage(): Language {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    const code = getLocales()[0]?.languageCode;
    if (code === 'es') return 'es';
    if (code === 'fr') return 'fr';
    if (code === 'de') return 'de';
    return 'en';
  } catch {
    return 'en';
  }
}

export function getCongratsMessages(): string[] {
  if (i18n.locale === 'es') return es.congrats;
  if (i18n.locale === 'fr') return fr.congrats;
  if (i18n.locale === 'de') return de.congrats;
  return en.congrats;
}
