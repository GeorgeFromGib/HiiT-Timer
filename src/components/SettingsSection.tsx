import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';

export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    section: { marginBottom: 24 },
    sectionTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      letterSpacing: 11 * 0.12,
      textTransform: 'uppercase',
      color: T.faintText,
      marginBottom: 8,
      paddingLeft: 4,
    },
    sectionCard: {
      backgroundColor: T.card,
      borderWidth: 1,
      borderColor: T.hairline,
      borderRadius: 18,
      overflow: 'hidden',
    },
  });
}
