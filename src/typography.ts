import type { TextStyle } from 'react-native';

export const typography = {
  // Section/header eyebrow label (all-caps small)
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 11 * 0.18,
    textTransform: 'uppercase',
  } as TextStyle,

  // Main screen title
  screenTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 22,
  } as TextStyle,

  // Interactive control labels (toggle, action row)
  controlLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    letterSpacing: 13 * 0.04,
  } as TextStyle,
};
