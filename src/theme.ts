import React from 'react';
import type { ViewStyle } from 'react-native';
import type { ThemeKey } from './lib/settings';
import type { Phase } from './lib/workout';

export interface ThemeTokens {
  bgGradient: readonly [string, string];
  text:       string;
  subText:    string;
  faintText:  string;
  hairline:   string;
  ghostBg:    string;
  card:       string;
  accent:     string;
  btnGlyph:   string;
  sheetBg:    string;
  /** High-contrast text/elements on the bg gradient — white on dark, dark gray on light. */
  onBg:       string;
  phases:     Record<Phase, string>;
}

const tidal: ThemeTokens = {
  bgGradient: ['#0b1d26', '#0e2832'],
  text:      '#eef6f7',
  subText:   'rgba(255,255,255,0.72)',
  faintText: 'rgba(255,255,255,0.44)',
  hairline:  'rgba(255,255,255,0.10)',
  ghostBg:   'rgba(255,255,255,0.05)',
  card:      'rgba(255,255,255,0.05)',
  accent:    '#3ad6c6',
  btnGlyph:  '#06131a',
  sheetBg:   '#0e2832',
  onBg:      '#ffffff',
  phases: {
    warmup:      '#ff8a3d',
    work:        '#ff5a5f',
    rest:        '#5fd38a',
    cooldown:    '#46a6ff',
    circuitRest: '#00FFFF',
  },
};

const daybreak: ThemeTokens = {
  bgGradient: ['#f3efe6', '#e7e1d4'],
  text:      '#16242b',
  subText:   'rgba(20,32,38,0.62)',
  faintText: 'rgba(20,32,38,0.45)',
  hairline:  'rgba(20,32,38,0.13)',
  ghostBg:   'rgba(20,32,38,0.05)',
  card:      'rgba(255,255,255,0.66)',
  accent:    '#ff5a3d',
  btnGlyph:  '#ffffff',
  sheetBg:   '#e7e1d4',
  onBg:      '#2a2218',
  phases: {
    warmup:      '#e0631a',
    work:        '#e23b40',
    rest:        '#1f9d57',
    cooldown:    '#1f7fd6',
    circuitRest: '#00FFFF',
  },
};

export const THEME_TOKENS: Record<ThemeKey, ThemeTokens> = { tidal, daybreak };

export interface ThemePreview {
  key:    ThemeKey;
  name:   string;
  note:   string;
  bg:     readonly [string, string];
  accent: string;
  phases: string[];
}

export const THEME_PREVIEWS: ThemePreview[] = [
  {
    key:    'daybreak',
    name:   'Daybreak',
    note:   'Light · warm paper',
    bg:     THEME_TOKENS.daybreak.bgGradient,
    accent: THEME_TOKENS.daybreak.accent,
    phases: [
      THEME_TOKENS.daybreak.phases.rest,
      THEME_TOKENS.daybreak.phases.warmup,
      THEME_TOKENS.daybreak.phases.work,
      THEME_TOKENS.daybreak.phases.cooldown,
    ],
  },
  {
    key:    'tidal',
    name:   'Tidal',
    note:   'Deep teal · calm',
    bg:     THEME_TOKENS.tidal.bgGradient,
    accent: THEME_TOKENS.tidal.accent,
    phases: [
      THEME_TOKENS.tidal.phases.rest,
      THEME_TOKENS.tidal.phases.warmup,
      THEME_TOKENS.tidal.phases.work,
      THEME_TOKENS.tidal.phases.cooldown,
    ],
  },
];

interface ThemeContextValue {
  T:        ThemeTokens;
  themeKey: ThemeKey;
  setTheme: (key: ThemeKey) => void;
}

export const ThemeContext = React.createContext<ThemeContextValue>({
  T:        tidal,
  themeKey: 'tidal',
  setTheme: () => {},
});

export function useTheme() {
  return React.useContext(ThemeContext);
}

export function withOpacity(color: string, alpha: number): string {
  return color + Math.round(alpha).toString(16).padStart(2, '0');
}

export const selectedBg = (color: string): string => withOpacity(color, 0x14);
export const selectedBorder = (color: string): string => withOpacity(color, 0x55);

export function ghostBtnStyle(T: ThemeTokens): ViewStyle {
  return {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.ghostBg,
    borderWidth: 1,
    borderColor: T.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  };
}

/** Accent-coloured drop shadow for action buttons (CTA, FAB, play button). */
export function buttonShadow(T: ThemeTokens): ViewStyle {
  return {
    shadowColor:   T.accent,
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.33,
    shadowRadius:  14,
    elevation:     6,
  };
}

/** Accent-coloured glow shadow for selected/active cards and rows (no offset). */
export function glowShadow(T: ThemeTokens): ViewStyle {
  return {
    shadowColor:   T.accent,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius:  10,
    elevation:     4,
  };
}
