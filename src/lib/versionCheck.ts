import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { appAlert } from './appAlert';
import { i18n } from './i18n';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const BUNDLE_ID = 'com.georgefromgib.hiittimer';

interface VersionCheckState {
  lastCheckedAt: number;
}

const DEFAULT: VersionCheckState = { lastCheckedAt: 0 };

const stateFile = () => new File(Paths.document, 'version_check_v1.json');

async function loadState(): Promise<VersionCheckState> {
  try {
    const f = stateFile();
    if (!f.exists) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(await f.text()) };
  } catch {
    return DEFAULT;
  }
}

async function saveState(state: VersionCheckState): Promise<void> {
  try {
    stateFile().write(JSON.stringify(state));
  } catch {}
}

function isNewerVersion(remote: string, local: string): boolean {
  const remoteParts = remote.split('.').map(Number);
  const localParts = local.split('.').map(Number);
  for (let i = 0; i < Math.max(remoteParts.length, localParts.length); i++) {
    const r = remoteParts[i] ?? 0;
    const l = localParts[i] ?? 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

interface ITunesLookupResult {
  version: string;
  trackViewUrl: string;
}

export async function checkForUpdate(force = false): Promise<void> {
  if (Platform.OS !== 'ios') return;

  if (!force) {
    const state = await loadState();
    if (Date.now() - state.lastCheckedAt < CHECK_INTERVAL_MS) return;
  }

  try {
    const res = await fetch(`https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}`);
    const json = await res.json();
    const result: ITunesLookupResult | undefined = json?.results?.[0];
    if (!force) await saveState({ lastCheckedAt: Date.now() });
    if (!result) return;

    const currentVersion = Constants.expoConfig?.version ?? '0';
    if (force || isNewerVersion(result.version, currentVersion)) {
      appAlert(
        'info',
        i18n.t('alerts.updateAvailableTitle'),
        i18n.t('alerts.updateAvailableMessage', { version: result.version }),
        [
          { text: i18n.t('alerts.later'), style: 'cancel' },
          { text: i18n.t('alerts.updateNow'), onPress: () => Linking.openURL(result.trackViewUrl) },
        ],
      );
    }
  } catch {
    if (!force) await saveState({ lastCheckedAt: Date.now() });
  }
}
