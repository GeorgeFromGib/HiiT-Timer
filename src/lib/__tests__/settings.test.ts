import { getLocales } from 'expo-localization';
import { DEFAULT_SETTINGS, detectSpeedUnit, loadSettings, saveSettings, type Settings } from '../settings';

describe('detectSpeedUnit', () => {
  it('returns km for a metric locale', () => {
    (getLocales as jest.Mock).mockReturnValueOnce([{ measurementSystem: 'metric' }]);
    expect(detectSpeedUnit()).toBe('km');
  });

  it('returns miles for a us locale', () => {
    (getLocales as jest.Mock).mockReturnValueOnce([{ measurementSystem: 'us' }]);
    expect(detectSpeedUnit()).toBe('miles');
  });

  it('returns miles for a uk locale', () => {
    (getLocales as jest.Mock).mockReturnValueOnce([{ measurementSystem: 'uk' }]);
    expect(detectSpeedUnit()).toBe('miles');
  });

  it('falls back to km when there are no locales', () => {
    (getLocales as jest.Mock).mockReturnValueOnce([]);
    expect(detectSpeedUnit()).toBe('km');
  });

  it('falls back to km when getLocales throws', () => {
    (getLocales as jest.Mock).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(detectSpeedUnit()).toBe('km');
  });
});

describe('loadSettings / saveSettings', () => {
  beforeEach(() => {
    jest.requireMock('expo-file-system').__files.clear();
  });

  it('returns DEFAULT_SETTINGS when no file has been saved', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns DEFAULT_SETTINGS when the saved file is corrupt', async () => {
    jest.requireMock('expo-file-system').__files.set('document/settings_v1.json', '{not json');
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips a full settings object through save/load', async () => {
    const custom: Settings = { ...DEFAULT_SETTINGS, theme: 'tidal', soundVolume: 42, language: 'fr' };
    await saveSettings(custom);
    expect(await loadSettings()).toEqual(custom);
  });

  it('merges a partial saved file onto the defaults (forward-compat with new fields)', async () => {
    jest.requireMock('expo-file-system').__files.set(
      'document/settings_v1.json',
      JSON.stringify({ theme: 'tidal' }),
    );
    expect(await loadSettings()).toEqual({ ...DEFAULT_SETTINGS, theme: 'tidal' });
  });
});
