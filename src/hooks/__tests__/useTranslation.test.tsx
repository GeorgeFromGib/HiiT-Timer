import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useTranslation } from '../useTranslation';
import { SettingsContext } from '../../lib/settingsContext';
import { DEFAULT_SETTINGS } from '../../lib/settings';
import en from '../../locales/en';
import fr from '../../locales/fr';

describe('useTranslation', () => {
  function wrapperFor(language: 'en' | 'es' | 'fr') {
    return ({ children }: { children: React.ReactNode }) => (
      <SettingsContext.Provider
        value={{ settings: { ...DEFAULT_SETTINGS, language }, updateSettings: jest.fn() }}
      >
        {children}
      </SettingsContext.Provider>
    );
  }

  it('exposes the locale read from SettingsContext', async () => {
    const { result } = await renderHook(() => useTranslation(), { wrapper: wrapperFor('es') });
    expect(result.current.locale).toBe('es');
  });

  it('t() translates using the locale from settings, without needing an explicit locale option', async () => {
    const { result } = await renderHook(() => useTranslation(), { wrapper: wrapperFor('fr') });
    expect(result.current.t('speech.complete')).toBe(fr.speech.complete);
  });

  it('t() forwards additional interpolation options', async () => {
    const { result } = await renderHook(() => useTranslation(), { wrapper: wrapperFor('en') });
    expect(result.current.t('sessions.copyOf', { name: 'Leg Day' })).toBe('Copy of Leg Day');
  });

  it('defaults to "en" when rendered without a SettingsContext Provider', async () => {
    const { result } = await renderHook(() => useTranslation());
    expect(result.current.locale).toBe('en');
    expect(result.current.t('speech.complete')).toBe(en.speech.complete);
  });
});
