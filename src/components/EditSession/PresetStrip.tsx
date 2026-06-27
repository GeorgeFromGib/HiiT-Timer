import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, selectedBg, type ThemeTokens } from '../../theme';
import { useTranslation } from '../../lib/i18n';
import { type PresetLevel } from '../../lib/presets';

const PRESET_LEVELS: { label: string; level: PresetLevel }[] = [
  { label: '1', level: '1' },
  { label: '2', level: '2' },
  { label: '3', level: '3' },
  { label: '4', level: '4' },
  { label: '5', level: '5' },
  { label: '6', level: '6' },
];

interface Props {
  onApply: (level: PresetLevel) => void;
  activePreset?: PresetLevel | null;
}

export default function PresetStrip({ onApply, activePreset }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  return (
    <View>
      <View style={styles.presetRangeLabels}>
        <Text style={[styles.presetRangeLabelText, { color: T.faintText }]}>{t('edit.presetEasy')}</Text>
        <Text style={[styles.presetRangeLabelText, { color: T.faintText }]}>{t('edit.presetHard')}</Text>
      </View>
      <View style={styles.presetStrip}>
        {PRESET_LEVELS.map(({ label, level }) => {
          const isActive = level === activePreset;
          return (
            <Pressable
              key={level}
              style={({ pressed }) => [
                styles.presetPill,
                (pressed || isActive) && { borderColor: T.accent, backgroundColor: selectedBg(T.accent) },
              ]}
              onPress={() => onApply(level)}
            >
              <Text style={[styles.presetPillText, { color: isActive ? T.accent : T.subText }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    presetRangeLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    presetRangeLabelText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 10,
      letterSpacing: 10 * 0.06,
      textTransform: 'uppercase',
    },
    presetStrip: {
      flexDirection: 'row',
      gap: 8,
    },
    presetPill: {
      flex: 1,
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
