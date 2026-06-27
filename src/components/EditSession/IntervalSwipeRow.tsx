import React, { useRef, useImperativeHandle } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useTranslation } from '../../lib/i18n';
import { typography } from '../../typography';
import IntervalRow from '../IntervalRow';
import { type LocalInterval } from '../../hooks/useEditSession';

interface Props {
  interval:                LocalInterval;
  isActive:                boolean;
  drag:                    () => void;
  onDuplicate:             () => void;
  onRemove:                () => void;
  onCyclePhase:            () => void;
  onOpenPicker:            () => void;
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
}

const IntervalSwipeDuplicateAction = React.forwardRef<
  { reset: () => void },
  { onDuplicate: () => void; swipeable: { close: () => void } }
>(function IntervalSwipeDuplicateAction({ onDuplicate, swipeable }, ref) {
  const { t } = useTranslation();
  const opacity = useRef(new Animated.Value(1)).current;

  useImperativeHandle(ref, () => ({ reset: () => opacity.setValue(1) }));

  const handlePress = () => {
    onDuplicate();
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(
      () => swipeable.close(),
    );
  };

  return (
    <Animated.View style={{ opacity, alignSelf: 'stretch' }}>
      <Pressable onPress={handlePress} style={[styles.swipeDuplicateAction, { flex: 1 }]}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M10 2h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={styles.swipeDuplicateText}>{t('common.duplicate')}</Text>
      </Pressable>
    </Animated.View>
  );
});

export default function IntervalSwipeRow({
  interval, isActive, drag,
  onDuplicate, onRemove, onCyclePhase, onOpenPicker,
  displaySpeed, onOpenSpeedPicker, onClearSpeed,
  activityLabel, onLabelChange,
  displayResistance, onOpenResistancePicker, onClearResistance,
  displayPower, onOpenPowerPicker, onClearPower,
}: Props) {
  const { t } = useTranslation();
  const duplicateRef = useRef<{ reset: () => void } | null>(null);

  return (
    <ScaleDecorator>
      <ReanimatedSwipeable
        containerStyle={styles.intervalSwipeContainer}
        onSwipeableClose={() => duplicateRef.current?.reset()}
        renderLeftActions={(_p, _d, swipeable) => (
          <IntervalSwipeDuplicateAction
            ref={duplicateRef}
            onDuplicate={onDuplicate}
            swipeable={swipeable}
          />
        )}
        renderRightActions={(_p, _d, swipeable) => (
          <Pressable
            onPress={() => { swipeable.close(); onRemove(); }}
            style={styles.swipeDeleteAction}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M10 11v6M14 11v6" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
            </Svg>
            <Text style={styles.swipeDeleteText}>{t('common.delete')}</Text>
          </Pressable>
        )}
      >
        <IntervalRow
          interval={interval}
          isActive={isActive}
          onCyclePhase={onCyclePhase}
          onOpenPicker={onOpenPicker}
          onDrag={drag}
          displaySpeed={displaySpeed}
          onOpenSpeedPicker={onOpenSpeedPicker}
          onClearSpeed={onClearSpeed}
          activityLabel={activityLabel}
          onLabelChange={onLabelChange}
          displayResistance={displayResistance}
          onOpenResistancePicker={onOpenResistancePicker}
          onClearResistance={onClearResistance}
          displayPower={displayPower}
          onOpenPowerPicker={onOpenPowerPicker}
          onClearPower={onClearPower}
        />
      </ReanimatedSwipeable>
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  intervalSwipeContainer: { marginBottom: 6 },
  swipeDuplicateAction: {
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    width: 80,
    borderRadius: 12,
    marginRight: 6,
  },
  swipeDuplicateText: {
    ...typography.controlLabel,
    color: '#fff',
  },
  swipeDeleteAction: {
    backgroundColor: '#ff5a5f',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    width: 80,
    borderRadius: 12,
  },
  swipeDeleteText: {
    ...typography.controlLabel,
    color: '#fff',
  },
});
