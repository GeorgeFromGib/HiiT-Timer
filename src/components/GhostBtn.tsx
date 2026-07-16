import React from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  onPress:   () => void;
  disabled?: boolean;
  color?:    string;
  size?:     number;
  children:  React.ReactNode;
}

export default function GhostBtn({ onPress, disabled, color, size = 54, children }: Props) {
  const { T } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: T.ghostBg,
          borderWidth: 1,
          borderColor: color ?? T.hairline,
          alignItems: 'center',
          justifyContent: 'center',
        },
        disabled && { opacity: 0.3 },
      ]}
    >
      {children}
    </Pressable>
  );
}
