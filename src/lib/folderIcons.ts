import type { ThemeTokens } from '../theme';
import type { FolderIconName } from './sessions';

export const DEFAULT_FOLDER_ICON: FolderIconName = 'folder';

type ColorToken = 'accent' | 'warmup' | 'work' | 'rest' | 'cooldown' | 'circuitRest' | 'subText' | 'faintText';

const FOLDER_ICON_COLOR_TOKEN: Record<FolderIconName, ColorToken> = {
  // Folder Classification
  folder: 'accent', folderOpen: 'accent', star: 'warmup', heart: 'work', tag: 'circuitRest',
  bookmark: 'cooldown', flag: 'warmup', target: 'work', calendar: 'cooldown', pin: 'warmup',
  archive: 'faintText', grid: 'subText', list: 'subText', bell: 'warmup', lock: 'faintText',
  share: 'cooldown', home: 'rest',
  // Phase
  sun: 'warmup', flame: 'work', bolt: 'accent', pauseIcon: 'rest', snow: 'cooldown',
  // Session Types (mirrors ActivityTypeIcon's tinting)
  standard: 'accent', run: 'cooldown', circuit: 'warmup', spinning: 'rest',
  // People
  user: 'accent', users: 'cooldown',
};

export function resolveFolderIconColor(T: ThemeTokens, icon: FolderIconName): string {
  const token = FOLDER_ICON_COLOR_TOKEN[icon];
  if (token === 'accent') return T.accent;
  if (token === 'subText') return T.subText;
  if (token === 'faintText') return T.faintText;
  return T.phases[token];
}

export interface FolderIconGroup {
  labelKey: string;
  icons: FolderIconName[];
}

export const FOLDER_ICON_GROUPS: FolderIconGroup[] = [
  {
    labelKey: 'folders.iconGroupClassification',
    icons: ['folder', 'folderOpen', 'star', 'heart', 'tag', 'bookmark', 'flag', 'target', 'calendar', 'pin', 'archive', 'grid', 'list', 'bell', 'lock', 'share', 'home'],
  },
  { labelKey: 'folders.iconGroupPhase', icons: ['sun', 'flame', 'bolt', 'pauseIcon', 'snow'] },
  { labelKey: 'folders.iconGroupSessionTypes', icons: ['standard', 'run', 'circuit', 'spinning'] },
  { labelKey: 'folders.iconGroupPeople', icons: ['user', 'users'] },
];
