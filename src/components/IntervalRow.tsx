import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fmtDuration, type Interval } from '../lib/workout';
import { useTheme, withOpacity, glowShadow, type ThemeTokens } from '../theme';
import DragHandle from './DragHandle';
import { useTranslation } from '../hooks/useTranslation';

export interface IntervalRowProps {
  interval:                Interval;
  isActive:                boolean;
  // Tabata mode: only the exercise-name field stays interactive; everything else is inert.
  locked?:                 boolean;
  onCyclePhase:            () => void;
  onOpenPicker:            () => void;
  onDrag:                  () => void;
  displaySpeed?:           { value: string; unit: string };
  onOpenSpeedPicker?:      () => void;
  onClearSpeed?:           () => void;
  activityLabel?:          string;
  onLabelChange?:          (text: string) => void;
  displayResistance?:      number;
  onOpenResistancePicker?: () => void;
  onClearResistance?:      () => void;
  displayPower?:           number;
  onOpenPowerPicker?:      () => void;
  onClearPower?:           () => void;
  displayIncline?:         number;
  onOpenInclinePicker?:    () => void;
  onClearIncline?:         () => void;
  cooldownTaperOn?:        boolean;
  onToggleCooldownTaper?:  () => void;
}

export default function IntervalRow({
  interval, isActive, locked,
  onCyclePhase, onOpenPicker, onDrag,
  displaySpeed, onOpenSpeedPicker, onClearSpeed,
  activityLabel, onLabelChange,
  displayResistance, onOpenResistancePicker, onClearResistance,
  displayPower, onOpenPowerPicker, onClearPower,
  displayIncline, onOpenInclinePicker, onClearIncline,
  cooldownTaperOn, onToggleCooldownTaper,
}: IntervalRowProps) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(T);
  const phaseColor = T.phases[interval.type];

  return (
    <View style={[styles.intervalRow, isActive && styles.intervalRowActive]}>
      <Pressable onLongPress={onDrag} delayLongPress={150} style={styles.dragHandle} hitSlop={8} disabled={locked}>
        <DragHandle color={T.subText} />
      </Pressable>

      <Pressable onPress={onCyclePhase} disabled={locked} style={[styles.phasePill, { backgroundColor: withOpacity(phaseColor, 0x22), borderColor: phaseColor }, locked && { opacity: 0.5 }]}>
        <Text style={[styles.phasePillText, { color: phaseColor }]}>{t('phasesAbbr.' + interval.type)}</Text>
      </Pressable>

      {onToggleCooldownTaper && (
        <Pressable
          onPress={onToggleCooldownTaper}
          disabled={locked}
          hitSlop={8}
          accessibilityRole="switch"
          accessibilityState={{ checked: !!cooldownTaperOn }}
          accessibilityLabel={t('edit.cooldownTaperChip')}
        >
          <View style={[
            styles.taperChip,
            { borderColor: cooldownTaperOn ? phaseColor : T.hairline },
            cooldownTaperOn && { backgroundColor: withOpacity(phaseColor, 0x22) },
          ]}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M3 5h5v5h5v5h5v5"
                stroke={cooldownTaperOn ? phaseColor : T.faintText}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </Pressable>
      )}

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
          <View style={[styles.settingChip, { borderColor: T.hairline }]}>
            <Text style={styles.intervalDurationText} numberOfLines={1}>
              {displaySpeed.value}
              <Text style={styles.intervalSpeedUnit}>{' '}{displaySpeed.unit}</Text>
            </Text>
          </View>
        </Pressable>
      )}

      {displayResistance !== undefined && onOpenResistancePicker && (
        <Pressable
          onPress={onOpenResistancePicker}
          onLongPress={onClearResistance}
          delayLongPress={500}
          hitSlop={8}
          style={styles.spinChip}
        >
          <View style={[styles.settingChip, { borderColor: T.hairline }]}>
            <Text style={styles.intervalDurationText} numberOfLines={1}>{displayResistance}<Text style={styles.spinChipUnit}>R</Text></Text>
          </View>
        </Pressable>
      )}

      {displayPower !== undefined && onOpenPowerPicker && (
        <Pressable
          onPress={onOpenPowerPicker}
          onLongPress={onClearPower}
          delayLongPress={500}
          hitSlop={8}
          style={styles.spinChip}
        >
          <View style={[styles.settingChip, { borderColor: T.hairline }]}>
            <Text style={styles.intervalDurationText} numberOfLines={1}>
              {displayPower}<Text style={styles.spinChipUnit}>W</Text>
            </Text>
          </View>
        </Pressable>
      )}

      {displayIncline !== undefined && onOpenInclinePicker && (
        <Pressable
          onPress={onOpenInclinePicker}
          onLongPress={onClearIncline}
          delayLongPress={500}
          hitSlop={8}
          style={styles.spinChip}
        >
          <View style={[styles.settingChip, { borderColor: T.hairline }]}>
            <Text style={styles.intervalDurationText} numberOfLines={1}>
              {displayIncline}<Text style={styles.spinChipUnit}>%</Text>
            </Text>
          </View>
        </Pressable>
      )}

      <Pressable
        onPress={onOpenPicker}
        disabled={locked}
        style={[
          styles.intervalDuration,
          (displaySpeed !== undefined
            || (onLabelChange !== undefined && interval.type === 'work')
          ) && { flex: 0 },
          (displayResistance !== undefined || displayIncline !== undefined) && { flex: 1, alignItems: 'center', paddingRight: 0 },
          locked && { opacity: 0.5 },
        ]}
      >
        <View style={[styles.settingChip, { borderColor: T.hairline }]}>
          <Text style={styles.intervalDurationText} numberOfLines={1}>{fmtDuration(interval.dur)}</Text>
        </View>
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
    settingChip: {
      borderWidth: 1.5,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      flexShrink: 0,
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
    spinChip: {
      flex: 1,
      alignItems: 'center',
    },
    spinChipUnit: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: T.subText,
    },
    taperChip: {
      borderWidth: 1.5,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
  });
}
