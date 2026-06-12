import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';

export function SettingsToggle({ value, onChange, disabled = false }: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const left = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 21] });

  return (
    <Pressable
      onPress={() => { if (!disabled) onChange(!value); }}
      style={[
        styles.toggleTrack,
        {
          backgroundColor: (value && !disabled) ? T.accent : T.ghostBg,
          borderColor: (value && !disabled) ? T.accent : T.hairline,
          shadowColor: (value && !disabled) ? T.accent : 'transparent',
          shadowOpacity: (value && !disabled) ? 0.33 : 0,
          shadowOffset: { width: 0, height: 3 },
          shadowRadius: 5,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.toggleThumb,
          {
            left,
            backgroundColor: (value && !disabled) ? T.btnGlyph : T.subText,
          },
        ]}
      />
    </Pressable>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    toggleTrack: {
      width: 46,
      height: 27,
      borderRadius: 999,
      borderWidth: 1.5,
      justifyContent: 'center',
    },
    toggleThumb: {
      position: 'absolute',
      top: 2,
      width: 19,
      height: 19,
      borderRadius: 9.5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 2,
      elevation: 2,
    },
  });
}
