import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme, selectedBg, type ThemeTokens } from '../../theme';
import { fmtDuration } from '../../lib/workout';

interface Props {
  minutes: number;
  onCustom: () => void;
}

export default function TimePresetStrip({ minutes, onCustom }: Props) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  return (
    <Pressable
      style={({ pressed }) => [styles.presetPill, pressed && { borderColor: T.accent, backgroundColor: selectedBg(T.accent) }]}
      onPress={onCustom}
    >
      <Text style={[styles.presetPillText, { color: T.subText }]}>{fmtDuration(minutes * 60)}</Text>
    </Pressable>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    presetPill: {
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: T.hairline,
      backgroundColor: T.ghostBg,
    },
    presetPillText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      letterSpacing: 12 * 0.04,
    },
  });
}
