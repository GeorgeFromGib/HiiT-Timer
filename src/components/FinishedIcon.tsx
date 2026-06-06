import React from 'react';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { BASE_SVG_STROKE } from './svgStroke';

interface Props {
  color: string;
  size?: number;
}

export default function FinishedIcon({ color, size = 23 }: Props) {
  const p = { ...BASE_SVG_STROKE, stroke: color };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G {...p}>
        <Circle cx="12" cy="12" r="9" />
        <Path d="M8 12.5l2.5 2.5 5.5-5.5" />
      </G>
    </Svg>
  );
}
