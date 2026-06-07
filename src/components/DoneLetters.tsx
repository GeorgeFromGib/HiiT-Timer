import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const SPRING_CONFIG = { mass: 0.7, damping: 11, stiffness: 140 };
const STAGGER = 110;

const LETTER_CONFIG = [
  { char: 'D', tx: -280, ty: -220, rot: -200, delay: 0           },
  { char: 'O', tx:  260, ty: -280, rot:  180, delay: STAGGER     },
  { char: 'N', tx:  300, ty:  200, rot: -160, delay: STAGGER * 2 },
  { char: 'E', tx: -240, ty:  260, rot:  220, delay: STAGGER * 3 },
] as const;

interface LetterProps {
  char: string;
  tx: number;
  ty: number;
  rot: number;
  delay: number;
  style?: StyleProp<TextStyle>;
}

function AnimatedLetter({ char, tx, ty, rot, delay, style }: LetterProps) {
  const translateX = useSharedValue(tx);
  const translateY = useSharedValue(ty);
  const rotate = useSharedValue(rot);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withDelay(delay, withSpring(0, SPRING_CONFIG));
    translateY.value = withDelay(delay, withSpring(0, SPRING_CONFIG));
    rotate.value = withDelay(delay, withSpring(0, SPRING_CONFIG));
    opacity.value = withDelay(delay, withTiming(1, { duration: 120 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return <Animated.Text style={[style, animStyle]}>{char}</Animated.Text>;
}

interface Props {
  style?: StyleProp<TextStyle>;
}

export default function DoneLetters({ style }: Props) {
  return (
    <View style={styles.row}>
      {LETTER_CONFIG.map(cfg => (
        <AnimatedLetter key={cfg.char} {...cfg} style={style} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
});
