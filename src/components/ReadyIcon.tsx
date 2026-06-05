import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

interface Props {
  color: string;
  size?: number;
}

export default function ReadyIcon({ color, size = 23 }: Props) {
  const p = {
    fill: 'none', stroke: color, strokeWidth: 2.2,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G {...p}>
        <Circle cx="12" cy="13.5" r="7" />
        <Path d="M10 5h4" />
        <Path d="M12 5v1.5" />
        <Path d="M12 13.5V10" />
      </G>
    </Svg>
  );
}
