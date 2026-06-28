import * as Speech from 'expo-speech';
import type { Phase } from './workout';
import type { Language } from './i18n';
import { i18n } from './i18n';

const LANGUAGE_CODES: Record<Language, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
};

async function speak(text: string, language: Language, onDone?: () => void): Promise<void> {
  await Speech.stop();
  Speech.speak(text, { language: LANGUAGE_CODES[language], onDone });
}

export function speakPhase(phase: Phase, language: Language): void {
  const text = i18n.t(`speech.phases.${phase}`, { locale: language });
  speak(text, language).catch(() => {});
}

export function speakComplete(language: Language, onDone?: () => void): void {
  const text = i18n.t('speech.complete', { locale: language });
  speak(text, language, onDone).catch(() => {});
}
