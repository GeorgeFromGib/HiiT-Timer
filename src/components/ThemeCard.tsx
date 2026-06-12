import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useTheme, type ThemeTokens, type ThemePreview } from '../theme';

export function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: ThemePreview;
  selected: boolean;
  onSelect: () => void;
}) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.themeCard,
        {
          borderColor: selected ? T.accent : T.hairline,
          shadowColor: selected ? T.accent : 'transparent',
          shadowOpacity: selected ? 0.2 : 0,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 9,
        },
      ]}
    >
      {/* gradient preview */}
      <LinearGradient
        colors={[theme.bg[1], theme.bg[0]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.themePreview}
      >
        <View style={[styles.themeAccentDot, { backgroundColor: theme.accent, shadowColor: theme.accent }]} />
        {theme.phases.map((c, i) => (
          <View key={i} style={[styles.themePhaseDot, { backgroundColor: c }]} />
        ))}
      </LinearGradient>

      {/* label row */}
      <View style={[styles.themeLabel, { borderTopColor: T.hairline, backgroundColor: T.card }]}>
        <View>
          <Text style={styles.themeName}>{theme.name}</Text>
          <Text style={styles.themeNote}>{theme.note}</Text>
        </View>
        <View
          style={[
            styles.themeCheck,
            {
              backgroundColor: selected ? T.accent : 'transparent',
              borderColor: selected ? T.accent : T.hairline,
            },
          ]}
        >
          {selected && (
            <Svg width={10} height={10} viewBox="0 0 10 10">
              <Path
                d="M2 5.5l2.2 2.2L8 3"
                stroke={T.btnGlyph}
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    themeCard: {
      flex: 1,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 2,
    },
    themePreview: {
      height: 64,
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 12,
      paddingBottom: 10,
      gap: 5,
    },
    themeAccentDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 4,
    },
    themePhaseDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      opacity: 0.7,
    },
    themeLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
    },
    themeName: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: T.text,
    },
    themeNote: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      color: T.faintText,
      marginTop: 1,
    },
    themeCheck: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
