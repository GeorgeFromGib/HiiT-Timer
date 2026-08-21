import { i18n, detectLanguage, getCongratsMessages } from '../i18n';
import en from '../../locales/en';
import es from '../../locales/es';
import fr from '../../locales/fr';

describe('i18n', () => {
  it('translates a known key in the default (en) locale', () => {
    expect(i18n.t('speech.complete', { locale: 'en' })).toBe(en.speech.complete);
  });

  it('translates a known key in the es locale', () => {
    expect(i18n.t('speech.complete', { locale: 'es' })).toBe(es.speech.complete);
  });

  it('translates a known key in the fr locale', () => {
    expect(i18n.t('speech.complete', { locale: 'fr' })).toBe(fr.speech.complete);
  });
});

describe('detectLanguage', () => {
  it('returns "en" when expo-localization reports an English locale', () => {
    const { getLocales } = jest.requireMock('expo-localization');
    getLocales.mockReturnValueOnce([{ languageCode: 'en', measurementSystem: 'metric' }]);
    expect(detectLanguage()).toBe('en');
  });

  it('returns "es" when expo-localization reports a Spanish locale', () => {
    const { getLocales } = jest.requireMock('expo-localization');
    getLocales.mockReturnValueOnce([{ languageCode: 'es', measurementSystem: 'metric' }]);
    expect(detectLanguage()).toBe('es');
  });

  it('returns "fr" when expo-localization reports a French locale', () => {
    const { getLocales } = jest.requireMock('expo-localization');
    getLocales.mockReturnValueOnce([{ languageCode: 'fr', measurementSystem: 'metric' }]);
    expect(detectLanguage()).toBe('fr');
  });

  it('falls back to "en" for an unsupported language code', () => {
    const { getLocales } = jest.requireMock('expo-localization');
    getLocales.mockReturnValueOnce([{ languageCode: 'de', measurementSystem: 'metric' }]);
    expect(detectLanguage()).toBe('en');
  });

  it('falls back to "en" when getLocales() returns an empty array', () => {
    const { getLocales } = jest.requireMock('expo-localization');
    getLocales.mockReturnValueOnce([]);
    expect(detectLanguage()).toBe('en');
  });

  it('falls back to "en" when getLocales throws', () => {
    const { getLocales } = jest.requireMock('expo-localization');
    getLocales.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(detectLanguage()).toBe('en');
  });
});

describe('getCongratsMessages', () => {
  const originalLocale = i18n.locale;

  afterEach(() => {
    i18n.locale = originalLocale;
  });

  it('returns the English congrats list when i18n.locale is "en"', () => {
    i18n.locale = 'en';
    expect(getCongratsMessages()).toBe(en.congrats);
  });

  it('returns the Spanish congrats list when i18n.locale is "es"', () => {
    i18n.locale = 'es';
    expect(getCongratsMessages()).toBe(es.congrats);
  });

  it('returns the French congrats list when i18n.locale is "fr"', () => {
    i18n.locale = 'fr';
    expect(getCongratsMessages()).toBe(fr.congrats);
  });

  it('defaults to the English congrats list for an unrecognized locale', () => {
    i18n.locale = 'de';
    expect(getCongratsMessages()).toBe(en.congrats);
  });
});
