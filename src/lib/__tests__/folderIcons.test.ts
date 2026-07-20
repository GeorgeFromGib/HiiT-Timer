import {
  DEFAULT_FOLDER_ICON,
  resolveFolderIconColor,
  folderIconTint,
  FOLDER_ICON_GROUPS,
} from '../folderIcons';
import type { ThemeTokens } from '../../theme';
import type { FolderIconName } from '../sessions';

const T: ThemeTokens = {
  bgGradient: ['#000000', '#111111'],
  text: '#eef6f7',
  subText: 'rgba(255,255,255,0.72)',
  faintText: 'rgba(255,255,255,0.44)',
  hairline: 'rgba(255,255,255,0.10)',
  ghostBg: 'rgba(255,255,255,0.05)',
  card: 'rgba(255,255,255,0.05)',
  accent: '#3ad6c6',
  btnGlyph: '#06131a',
  sheetBg: '#0e2832',
  onBg: '#ffffff',
  phases: {
    warmup: '#ff8a3d',
    work: '#ff5a5f',
    rest: '#5fd38a',
    cooldown: '#46a6ff',
    circuitRest: '#b06af0',
    finish: '#5a7a80',
  },
};

describe('DEFAULT_FOLDER_ICON', () => {
  it('is "folder"', () => {
    expect(DEFAULT_FOLDER_ICON).toBe('folder');
  });
});

describe('resolveFolderIconColor', () => {
  it('resolves an accent-mapped icon to T.accent', () => {
    expect(resolveFolderIconColor(T, 'folder')).toBe(T.accent);
    expect(resolveFolderIconColor(T, 'bolt')).toBe(T.accent);
  });

  it('resolves a subText-mapped icon to T.subText', () => {
    expect(resolveFolderIconColor(T, 'grid')).toBe(T.subText);
  });

  it('resolves a faintText-mapped icon to T.faintText', () => {
    expect(resolveFolderIconColor(T, 'archive')).toBe(T.faintText);
  });

  it('resolves a phase-mapped icon to the corresponding T.phases entry', () => {
    expect(resolveFolderIconColor(T, 'star')).toBe(T.phases.warmup);
    expect(resolveFolderIconColor(T, 'heart')).toBe(T.phases.work);
    expect(resolveFolderIconColor(T, 'home')).toBe(T.phases.rest);
    expect(resolveFolderIconColor(T, 'bookmark')).toBe(T.phases.cooldown);
    expect(resolveFolderIconColor(T, 'tag')).toBe(T.phases.circuitRest);
  });

  it('resolves every icon referenced in FOLDER_ICON_GROUPS without throwing', () => {
    const allIcons = FOLDER_ICON_GROUPS.flatMap(g => g.icons);
    for (const icon of allIcons) {
      expect(() => resolveFolderIconColor(T, icon)).not.toThrow();
    }
  });
});

describe('folderIconTint', () => {
  it('appends a low-alpha hex suffix to a hex color', () => {
    expect(folderIconTint('#3ad6c6')).toBe('#3ad6c61e');
  });

  it('rewrites an rgba() color to use 0.12 alpha', () => {
    expect(folderIconTint('rgba(255, 255, 255, 0.72)')).toBe('rgba(255, 255, 255, 0.12)');
  });

  it('rewrites an rgba() color with integer alpha', () => {
    expect(folderIconTint('rgba(20,32,38,1)')).toBe('rgba(20,32,38, 0.12)');
  });
});

describe('FOLDER_ICON_GROUPS', () => {
  it('covers every FolderIconName exactly once', () => {
    const allIcons = FOLDER_ICON_GROUPS.flatMap(g => g.icons);
    const expected: FolderIconName[] = [
      'folder', 'folderOpen', 'star', 'heart', 'tag', 'bookmark', 'flag', 'target',
      'calendar', 'pin', 'archive', 'grid', 'list', 'bell', 'lock', 'share', 'home',
      'sun', 'flame', 'bolt', 'pauseIcon', 'snow',
      'standard', 'run', 'walk', 'circuit', 'spinning',
      'user', 'users',
    ];
    expect(new Set(allIcons)).toEqual(new Set(expected));
    expect(allIcons).toHaveLength(new Set(allIcons).size);
  });

  it('gives each group a labelKey', () => {
    for (const group of FOLDER_ICON_GROUPS) {
      expect(typeof group.labelKey).toBe('string');
      expect(group.labelKey.length).toBeGreaterThan(0);
    }
  });
});
