import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from '../hooks/useTranslation';
import GhostBtn from './GhostBtn';

const SECONDS_OPTIONS = [5, 10] as const;

interface Props {
  onExtend: (secs: number) => void;
  onAddRound: () => void;
  color: string;
  disabled?: boolean;
  size?: number;
  /** Push the +Ns group and the +1 round button to opposite edges (portrait). */
  spread?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The "+5s / +10s / +1 rnd" trio shown on the running-workout screen. Extends the
 * current segment or appends another round. Shared by the portrait and landscape
 * layouts; text sizing derives from `size` so callers only pass one number.
 */
export default function ExtendControls({
  onExtend, onAddRound, color, disabled, size = 68, spread, style,
}: Props) {
  const { t } = useTranslation();
  const fontSize = Math.round(size * 0.28);
  const gap = Math.round(size * 0.18);
  const labelStyle = {
    fontFamily: 'Inter_700Bold' as const,
    fontSize,
    letterSpacing: fontSize * 0.08,
    color,
  };

  return (
    <View style={[styles.row, spread ? styles.spread : { gap }, style]}>
      <View style={[styles.group, { gap }]}>
        {SECONDS_OPTIONS.map((secs) => (
          <GhostBtn key={secs} onPress={() => onExtend(secs)} disabled={disabled} color={color} size={size}>
            <Text style={labelStyle}>{`+${secs}s`}</Text>
          </GhostBtn>
        ))}
      </View>
      <GhostBtn onPress={onAddRound} disabled={disabled} color={color} size={size}>
        <Text style={labelStyle}>
          {'+1 '}
          <Text style={{ fontSize: Math.round(fontSize * 0.7), letterSpacing: fontSize * 0.08 }}>
            {t('workout.roundAbbr')}
          </Text>
        </Text>
      </GhostBtn>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  spread: { justifyContent: 'space-between', alignSelf: 'stretch' },
  group: { flexDirection: 'row', alignItems: 'center' },
});
