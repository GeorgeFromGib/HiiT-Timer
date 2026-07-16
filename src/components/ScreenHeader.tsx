import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, ghostBtnStyle } from '../theme';

interface Props {
  title:       string;
  subtitle?:   string;
  onBack?:     () => void;
  left?:       ReactNode;
  right?:      ReactNode;
  style?:      ViewStyle;
  titleStyle?: TextStyle;
}

export default function ScreenHeader({ title, subtitle, onBack, left, right, style, titleStyle }: Props) {
  const { T } = useTheme();

  const leftSlot = left ?? (onBack ? (
    <Pressable style={ghostBtnStyle(T)} onPress={onBack}>
      <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
        <Path d="M10 13L5 8l5-5" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  ) : <View style={{ width: 36 }} />);

  return (
    <View style={[styles.container, style]}>
      {leftSlot}
      <View style={styles.center}>
        {subtitle && (
          <Text style={[styles.subtitle, { color: T.faintText }]}>{subtitle}</Text>
        )}
        <Text style={[styles.title, { color: T.text }, titleStyle]}>{title}</Text>
      </View>
      {right ?? <View style={{ width: 36 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 11 * 0.18,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 20,
    letterSpacing: -0.2,
  },
});
