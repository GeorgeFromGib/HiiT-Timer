import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { T } from '../theme';

interface Props {
  onPress:   () => void;
  disabled?: boolean;
  children:  React.ReactNode;
}

export default function GhostBtn({ onPress, disabled, children }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, disabled && { opacity: 0.3 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: T.ghostBg,
    borderWidth: 1,
    borderColor: T.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
