import React from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  onPress:   () => void;
  disabled?: boolean;
  children:  React.ReactNode;
}

export default function GhostBtn({ onPress, disabled, children }: Props) {
  const { T } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: T.ghostBg,
          borderWidth: 1,
          borderColor: T.hairline,
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
