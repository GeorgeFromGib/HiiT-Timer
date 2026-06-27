import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { BASE_SVG_STROKE } from './svgStroke';

interface Props {
  activityType?: 'run' | 'spinning';
  mode: 'easy' | 'advanced' | 'circuit';
  size?: number;
  color: string;
}

export default function ActivityTypeIcon({ activityType, mode, size = 16, color }: Props) {
  const p = { ...BASE_SVG_STROKE, stroke: color };

  if (mode === 'circuit') {
    // Repeat/loop arrows
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path {...p} d="M17 1l4 4-4 4" />
        <Path {...p} d="M3 11V9a4 4 0 0 1 4-4h14" />
        <Path {...p} d="M7 23l-4-4 4-4" />
        <Path {...p} d="M21 13v2a4 4 0 0 1-4 4H3" />
      </Svg>
    );
  }

  if (activityType === 'run') {
    // Simplified running figure: head + body in motion
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="14" cy="4" r="1.5" {...p} />
        <Path {...p} d="M12 6.5l-3 5 3.5 2-3 5" />
        <Path {...p} d="M12 6.5l2.5 3.5-3.5 1.5" />
      </Svg>
    );
  }

  if (activityType === 'spinning') {
    // Bicycle wheel: outer rim, hub, 4 spokes (N/S/E/W)
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="9" stroke={color} fill="none" strokeWidth={2.2} />
        <Circle cx="12" cy="12" r="2" stroke={color} fill="none" strokeWidth={2.2} />
        <Path {...p} d="M12 3v7M12 14v7M3 12h7M14 12h7" />
      </Svg>
    );
  }

  // General HIIT: lightning bolt / zap
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...p} d="M13 2L3 14h9l-1 8 10-12h-9z" />
    </Svg>
  );
}
