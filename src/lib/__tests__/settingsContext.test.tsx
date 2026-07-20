import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { SettingsContext, useSettings } from '../settingsContext';
import { DEFAULT_SETTINGS } from '../settings';

describe('useSettings', () => {
  it('returns the default context value when no Provider is present', async () => {
    const { result } = await renderHook(() => useSettings());
    expect(result.current.settings).toBe(DEFAULT_SETTINGS);
  });

  it('default updateSettings is a no-op that does not throw', async () => {
    const { result } = await renderHook(() => useSettings());
    expect(() => result.current.updateSettings('theme', 'tidal')).not.toThrow();
  });

  it('reads the value provided by SettingsContext.Provider', async () => {
    const customSettings = { ...DEFAULT_SETTINGS, theme: 'tidal' as const, soundOff: true };
    const updateSettings = jest.fn();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsContext.Provider value={{ settings: customSettings, updateSettings }}>
        {children}
      </SettingsContext.Provider>
    );
    const { result } = await renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings).toBe(customSettings);
    expect(result.current.settings.theme).toBe('tidal');

    result.current.updateSettings('hapticFeedback', false);
    expect(updateSettings).toHaveBeenCalledWith('hapticFeedback', false);
  });
});
