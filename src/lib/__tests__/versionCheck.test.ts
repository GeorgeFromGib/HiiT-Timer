import { Linking, Platform } from 'react-native';
import { appAlert } from '../appAlert';
import { checkForUpdate } from '../versionCheck';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Linking: { openURL: jest.fn() },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.2.0' } },
}));

jest.mock('../appAlert', () => ({
  appAlert: jest.fn(),
}));

const FILE_KEY = 'document/version_check_v1.json';

function seedState(state: { lastCheckedAt: number }) {
  jest.requireMock('expo-file-system').__files.set(FILE_KEY, JSON.stringify(state));
}

function readSavedState() {
  const raw = jest.requireMock('expo-file-system').__files.get(FILE_KEY);
  return raw ? JSON.parse(raw) : undefined;
}

function mockLookupResponse(result: { version: string; trackViewUrl: string } | null) {
  (global.fetch as jest.Mock).mockResolvedValue({
    json: async () => ({ results: result ? [result] : [] }),
  });
}

describe('checkForUpdate', () => {
  beforeEach(() => {
    jest.requireMock('expo-file-system').__files.clear();
    (appAlert as jest.Mock).mockClear();
    (Linking.openURL as jest.Mock).mockClear();
    Platform.OS = 'ios';
    global.fetch = jest.fn();
  });

  it('does nothing on non-iOS platforms', async () => {
    Platform.OS = 'android';
    await checkForUpdate();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(appAlert).not.toHaveBeenCalled();
  });

  it('skips the check when throttled (checked less than 24h ago)', async () => {
    seedState({ lastCheckedAt: Date.now() - 1000 });
    await checkForUpdate();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('runs the check when the cache is stale (checked more than 24h ago)', async () => {
    seedState({ lastCheckedAt: Date.now() - 25 * 60 * 60 * 1000 });
    mockLookupResponse({ version: '1.2.0', trackViewUrl: 'https://apps.apple.com/app/id123' });
    await checkForUpdate();
    expect(global.fetch).toHaveBeenCalledWith('https://itunes.apple.com/lookup?bundleId=com.georgefromgib.hiittimer');
  });

  it('runs the check when there is no cache file', async () => {
    mockLookupResponse({ version: '1.2.0', trackViewUrl: 'https://apps.apple.com/app/id123' });
    await checkForUpdate();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('saves lastCheckedAt after a completed check', async () => {
    mockLookupResponse({ version: '1.2.0', trackViewUrl: 'https://apps.apple.com/app/id123' });
    const before = Date.now();
    await checkForUpdate();
    expect(readSavedState().lastCheckedAt).toBeGreaterThanOrEqual(before);
  });

  it('shows the update alert when a newer version is available', async () => {
    mockLookupResponse({ version: '1.3.0', trackViewUrl: 'https://apps.apple.com/app/id123' });
    await checkForUpdate();
    expect(appAlert).toHaveBeenCalledTimes(1);
    const [kind, title, message, buttons] = (appAlert as jest.Mock).mock.calls[0];
    expect(kind).toBe('info');
    expect(title).toBe('Update available');
    expect(message).toBe('A new version (1.3.0) of Clear HiiT is available.');
    expect(buttons).toEqual([
      { text: 'Later', style: 'cancel' },
      { text: 'Update Now', onPress: expect.any(Function) },
    ]);
  });

  it('opens the App Store link when "Update Now" is pressed', async () => {
    mockLookupResponse({ version: '1.3.0', trackViewUrl: 'https://apps.apple.com/app/id123' });
    await checkForUpdate();
    const buttons = (appAlert as jest.Mock).mock.calls[0][3];
    buttons[1].onPress();
    expect(Linking.openURL).toHaveBeenCalledWith('https://apps.apple.com/app/id123');
  });

  it('does not show the alert when the installed version is current', async () => {
    mockLookupResponse({ version: '1.2.0', trackViewUrl: 'https://apps.apple.com/app/id123' });
    await checkForUpdate();
    expect(appAlert).not.toHaveBeenCalled();
  });

  it('does not show the alert when the remote version is older', async () => {
    mockLookupResponse({ version: '1.1.9', trackViewUrl: 'https://apps.apple.com/app/id123' });
    await checkForUpdate();
    expect(appAlert).not.toHaveBeenCalled();
  });

  it('compares version parts numerically, not lexicographically', async () => {
    mockLookupResponse({ version: '1.10.0', trackViewUrl: 'https://apps.apple.com/app/id123' });
    await checkForUpdate();
    expect(appAlert).toHaveBeenCalledTimes(1);
  });

  it('treats missing trailing parts as newer if a real segment is newer', async () => {
    mockLookupResponse({ version: '2.0', trackViewUrl: 'https://apps.apple.com/app/id123' });
    await checkForUpdate();
    expect(appAlert).toHaveBeenCalledTimes(1);
  });

  it('does not alert when the response has no results', async () => {
    mockLookupResponse(null);
    await checkForUpdate();
    expect(appAlert).not.toHaveBeenCalled();
    expect(readSavedState().lastCheckedAt).toBeDefined();
  });

  it('fails silently on a network error but still records the check', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
    await expect(checkForUpdate()).resolves.toBeUndefined();
    expect(appAlert).not.toHaveBeenCalled();
    expect(readSavedState().lastCheckedAt).toBeDefined();
  });

  describe('force = true', () => {
    it('bypasses the throttle even when checked recently', async () => {
      seedState({ lastCheckedAt: Date.now() - 1000 });
      mockLookupResponse({ version: '1.2.0', trackViewUrl: 'https://apps.apple.com/app/id123' });
      await checkForUpdate(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('shows the alert even when the installed version is current', async () => {
      mockLookupResponse({ version: '1.2.0', trackViewUrl: 'https://apps.apple.com/app/id123' });
      await checkForUpdate(true);
      expect(appAlert).toHaveBeenCalledTimes(1);
    });

    it('does not persist lastCheckedAt', async () => {
      mockLookupResponse({ version: '1.2.0', trackViewUrl: 'https://apps.apple.com/app/id123' });
      await checkForUpdate(true);
      expect(readSavedState()).toBeUndefined();
    });
  });
});
