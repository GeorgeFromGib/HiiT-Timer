import * as Speech from 'expo-speech';
import type { Phase } from './workout';
import type { Language } from './i18n';
import { i18n } from './i18n';

const LANGUAGE_CODES: Record<Language, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
};

function speak(text: string, language: Language): void {
  Speech.stop();
  Speech.speak(text, { language: LANGUAGE_CODES[language] });
}

export function speakPhase(phase: Phase, language: Language): void {
  const text = i18n.t(`phases.${phase}`, { locale: language });
  speak(text, language);
}

export function speakComplete(language: Language): void {
  const text = i18n.t('speech.complete', { locale: language });
  speak(text, language);
}
