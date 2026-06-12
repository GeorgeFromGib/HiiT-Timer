import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme, type ThemeTokens } from '../theme';

export function VolumeRow({ value, onChange, disabled = false }: {
  value: number; // 0–100
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  return (
    <View style={[styles.row, styles.rowBorder, disabled && { opacity: 0.4 }, { flexDirection: 'column', alignItems: 'stretch', paddingBottom: 8 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.rowLabel}>Volume</Text>
        <Text style={[styles.rowSub, { marginTop: 0 }]}>{value}%</Text>
      </View>
      <Slider
        value={value}
        minimumValue={0}
        maximumValue={100}
        step={1}
        disabled={disabled}
        onValueChange={onChange}
        minimumTrackTintColor={T.accent}
        maximumTrackTintColor={T.hairline}
        thumbTintColor={T.accent}
        style={styles.slider}
      />
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
    slider: {
      marginHorizontal: -8,
    },
  });
}
