import { act, renderHook } from '@testing-library/react-native';
import { useSettingsState } from '../useSettingsState';
import { DEFAULT_SETTINGS, type Settings } from '../../lib/settings';
import { i18n } from '../../lib/i18n';

const filesMock = jest.requireMock('expo-file-system').__files as Map<string, string>;
const SETTINGS_PATH = 'document/settings_v1.json';

function readPersisted(): Settings | undefined {
  const raw = filesMock.get(SETTINGS_PATH);
  return raw ? JSON.parse(raw) : undefined;
}

beforeEach(() => {
  filesMock.clear();
});

describe('useSettingsState', () => {
  it('loads DEFAULT_SETTINGS (with auto-detected speedUnit/language) when no settings file exists', async () => {
    const { result } = await renderHook(() => useSettingsState());
    expect(result.current.loading).toBe(false);
    expect(result.current.settings).toEqual({
      ...DEFAULT_SETTINGS,
      speedUnit: 'km', // detectSpeedUnit() mock: measurementSystem 'metric'
      language: 'en',  // detectLanguage() mock: languageCode 'en'
    });
  });

  it('persists the auto-detected settings back to disk on first load (no manual flags set yet)', async () => {
    await renderHook(() => useSettingsState());
    const persisted = readPersisted();
    expect(persisted?.speedUnit).toBe('km');
    expect(persisted?.language).toBe('en');
  });

  it('loads persisted settings from disk and merges them over the defaults', async () => {
    filesMock.set(SETTINGS_PATH, JSON.stringify({
      theme: 'tidal', hapticFeedback: false,
      speedUnit: 'miles', speedUnitIsManuallySet: true,
      language: 'fr', languageIsManuallySet: true,
    }));
    const { result } = await renderHook(() => useSettingsState());
    expect(result.current.settings.theme).toBe('tidal');
    expect(result.current.settings.hapticFeedback).toBe(false);
    expect(result.current.settings.speedUnit).toBe('miles');
    expect(result.current.settings.language).toBe('fr');
    // Fields absent from the persisted file fall back to DEFAULT_SETTINGS
    expect(result.current.settings.soundCues).toBe(DEFAULT_SETTINGS.soundCues);
  });

  it('does not overwrite manually-set speedUnit/language with auto-detected values', async () => {
    filesMock.set(SETTINGS_PATH, JSON.stringify({
      speedUnit: 'miles', speedUnitIsManuallySet: true,
      language: 'fr', languageIsManuallySet: true,
    }));
    const { result } = await renderHook(() => useSettingsState());
    expect(result.current.settings.speedUnit).toBe('miles');
    expect(result.current.settings.language).toBe('fr');
  });

  it('does not re-save to disk when both speedUnit and language were already manually set', async () => {
    const original = JSON.stringify({
      speedUnit: 'miles', speedUnitIsManuallySet: true,
      language: 'fr', languageIsManuallySet: true,
    });
    filesMock.set(SETTINGS_PATH, original);
    await renderHook(() => useSettingsState());
    expect(filesMock.get(SETTINGS_PATH)).toBe(original);
  });

  it('auto-detects speedUnit only (leaving manually-set language untouched) when only speedUnit is unset', async () => {
    filesMock.set(SETTINGS_PATH, JSON.stringify({
      language: 'es', languageIsManuallySet: true,
      speedUnitIsManuallySet: false,
    }));
    const { result } = await renderHook(() => useSettingsState());
    expect(result.current.settings.language).toBe('es');
    expect(result.current.settings.speedUnit).toBe('km'); // auto-detected
  });

  it('syncs i18n.locale to settings.language after load', async () => {
    filesMock.set(SETTINGS_PATH, JSON.stringify({ language: 'es', languageIsManuallySet: true }));
    await renderHook(() => useSettingsState());
    expect(i18n.locale).toBe('es');
  });

  it('updateSettings updates a plain field and persists the full settings object', async () => {
    const { result } = await renderHook(() => useSettingsState());
    await act(async () => result.current.updateSettings('theme', 'tidal'));
    expect(result.current.settings.theme).toBe('tidal');
    expect(readPersisted()?.theme).toBe('tidal');
  });

  it('updateSettings("speedUnit", ...) sets the value and marks speedUnitIsManuallySet', async () => {
    const { result } = await renderHook(() => useSettingsState());
    await act(async () => result.current.updateSettings('speedUnit', 'miles'));
    expect(result.current.settings.speedUnit).toBe('miles');
    expect(result.current.settings.speedUnitIsManuallySet).toBe(true);
    expect(readPersisted()?.speedUnitIsManuallySet).toBe(true);
  });

  it('updateSettings("language", ...) sets the value, marks languageIsManuallySet, and re-syncs i18n.locale', async () => {
    const { result } = await renderHook(() => useSettingsState());
    await act(async () => result.current.updateSettings('language', 'fr'));
    expect(result.current.settings.language).toBe('fr');
    expect(result.current.settings.languageIsManuallySet).toBe(true);
    expect(i18n.locale).toBe('fr');
  });

  it('updateSettings preserves unrelated fields', async () => {
    const { result } = await renderHook(() => useSettingsState());
    await act(async () => result.current.updateSettings('soundVolume', 42));
    expect(result.current.settings.soundVolume).toBe(42);
    expect(result.current.settings.hapticFeedback).toBe(DEFAULT_SETTINGS.hapticFeedback);
    expect(result.current.settings.theme).toBe(DEFAULT_SETTINGS.theme);
  });
});
