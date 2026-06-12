import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';

export function SettingsRow({
  label,
  sub,
  right,
  last,
  disabled,
}: {
  label: string;
  sub?: string;
  right: React.ReactNode;
  last?: boolean;
  disabled?: boolean;
}) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  return (
    <View style={[styles.row, !last && styles.rowBorder, disabled && { opacity: 0.4 }]}>
      <View style={styles.rowLabels}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
      paddingHorizontal: 16,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: T.hairline,
    },
    rowLabels: { flex: 1, marginRight: 12 },
    rowLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: T.text,
      lineHeight: 20,
    },
    rowSub: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: T.faintText,
      marginTop: 2,
    },
  });
}
