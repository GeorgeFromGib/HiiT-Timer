import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fmtDuration, type Interval } from '../lib/workout';
import { useTheme, withOpacity, glowShadow, type ThemeTokens } from '../theme';
import DragHandle from './DragHandle';
import { useTranslation } from '../lib/i18n';

export interface IntervalRowProps {
  interval:           Interval;
  isActive:           boolean;
  onCyclePhase:       () => void;
  onOpenPicker:       () => void;
  onDrag:             () => void;
  displaySpeed?:      { value: string; unit: string };
  onOpenSpeedPicker?: () => void;
  onClearSpeed?:      () => void;
  activityLabel?:     string;
  onLabelChange?:     (text: string) => void;
}

export default function IntervalRow({
  interval, isActive,
  onCyclePhase, onOpenPicker, onDrag,
  displaySpeed, onOpenSpeedPicker, onClearSpeed,
  activityLabel, onLabelChange,
}: IntervalRowProps) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(T);
  const phaseColor = T.phases[interval.type];

  return (
    <View style={[styles.intervalRow, isActive && styles.intervalRowActive]}>
      <Pressable onLongPress={onDrag} delayLongPress={150} style={styles.dragHandle} hitSlop={8}>
        <DragHandle color={T.subText} />
      </Pressable>

      <Pressable onPress={onCyclePhase} style={[styles.phasePill, { backgroundColor: withOpacity(phaseColor, 0x22), borderColor: phaseColor }]}>
        <Text style={[styles.phasePillText, { color: phaseColor }]}>{t('phasesAbbr.' + interval.type)}</Text>
      </Pressable>

      {onLabelChange !== undefined && interval.type === 'work' && (
        <TextInput
          style={[styles.labelInput, { color: T.text, borderColor: T.hairline }]}
          value={activityLabel ?? ''}
          onChangeText={onLabelChange}
          placeholder={t('edit.exercisePlaceholder')}
          placeholderTextColor={T.faintText}
          returnKeyType="done"
        />
      )}

      {displaySpeed !== undefined && onOpenSpeedPicker && (
        <Pressable onPress={onOpenSpeedPicker} onLongPress={onClearSpeed} delayLongPress={500} hitSlop={8} style={styles.intervalSpeed}>
          <Text style={styles.intervalDurationText}>
            {displaySpeed.value}
            <Text style={styles.intervalSpeedUnit}>{' '}{displaySpeed.unit}</Text>
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={onOpenPicker}
        style={[
          styles.intervalDuration,
          (displaySpeed !== undefined || (onLabelChange !== undefined && interval.type === 'work')) && { flex: 0 },
        ]}
      >
        <Text style={styles.intervalDurationText}>{fmtDuration(interval.dur)}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    intervalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: T.ghostBg,
      borderWidth: 1.5,
      borderColor: T.hairline,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    intervalRowActive: {
      borderColor: T.accent,
      backgroundColor: withOpacity(T.accent, 0x14),
      ...glowShadow(T),
      shadowRadius: 8,
    },
    dragHandle: {
      alignSelf: 'stretch',
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    phasePill: {
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 999,
      borderWidth: 1.5,
      minWidth: 56,
      alignItems: 'center',
    },
    phasePillText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      letterSpacing: 11 * 0.06,
    },
    labelInput: {
      flex: 1,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 16,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: 'transparent',
    },
    intervalSpeed: {
      flex: 1,
      alignItems: 'center',
    },
    intervalSpeedUnit: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
    },
    intervalDuration: {
      flex: 1,
      alignItems: 'flex-end',
      paddingRight: 4,
    },
    intervalDurationText: {
      fontFamily: 'ChakraPetch_700Bold',
      fontSize: 18,
      color: T.text,
    },
  });
}
