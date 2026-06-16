import { Pressable, StyleSheet, Text, View } from 'react-native';
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
}

export default function IntervalRow({
  interval, isActive,
  onCyclePhase, onOpenPicker, onDrag,
  displaySpeed, onOpenSpeedPicker, onClearSpeed,
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
        <Text style={[styles.phasePillText, { color: phaseColor }]}>{t('phases.' + interval.type)}</Text>
      </Pressable>

      {displaySpeed !== undefined && onOpenSpeedPicker && (
        <Pressable onPress={onOpenSpeedPicker} onLongPress={onClearSpeed} delayLongPress={500} hitSlop={8} style={styles.intervalSpeed}>
          <Text style={styles.intervalDurationText}>
            {displaySpeed.value}
            <Text style={styles.intervalSpeedUnit}>{' '}{displaySpeed.unit}</Text>
          </Text>
        </Pressable>
      )}

      <Pressable onPress={onOpenPicker} style={[styles.intervalDuration, displaySpeed !== undefined && { flex: 0 }]}>
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
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1.5,
      minWidth: 84,
      alignItems: 'center',
    },
    phasePillText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      letterSpacing: 11 * 0.06,
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
