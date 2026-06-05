import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { T } from '../theme';

const ITEM_H  = 48;
const VISIBLE = 5;

export const WHEEL_H = ITEM_H * VISIBLE;

interface Props {
  values:   string[];
  selected: number;
  onChange: (i: number) => void;
}

export default function WheelColumn({ values, selected, onChange }: Props) {
  const ref = useRef<ScrollView>(null);

  return (
    <View style={styles.wrap}>
      <View style={styles.band} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        contentOffset={{ x: 0, y: selected * ITEM_H }}
        onMomentumScrollEnd={e => {
          const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          onChange(Math.max(0, Math.min(values.length - 1, i)));
        }}
        onScrollEndDrag={e => {
          const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          onChange(Math.max(0, Math.min(values.length - 1, i)));
        }}
      >
        {values.map((v, i) => (
          <View key={i} style={styles.item}>
            <Text style={[styles.label, i === selected && styles.labelSelected]}>{v}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    height: WHEEL_H,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: ITEM_H * 2,
    left: 8,
    right: 8,
    height: ITEM_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: T.accent,
    borderRadius: 6,
    zIndex: 1,
  },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: 22,
    color: T.subText,
  },
  labelSelected: {
    color: T.text,
    fontSize: 26,
  },
});
