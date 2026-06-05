import React from 'react';
import type { ThemeKey } from './settings';
import type { Phase } from './workout';

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
    warmup:   '#ff8a3d',
    work:     '#ff5a5f',
    rest:     '#5fd38a',
    cooldown: '#46a6ff',
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
    warmup:   '#e0631a',
    work:     '#e23b40',
    rest:     '#1f9d57',
    cooldown: '#1f7fd6',
  },
};

export const THEME_TOKENS: Record<ThemeKey, ThemeTokens> = { tidal, daybreak };

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
