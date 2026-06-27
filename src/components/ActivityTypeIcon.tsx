import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { BASE_SVG_STROKE } from './svgStroke';

interface Props {
  activityType?: 'run' | 'spinning';
  mode: 'easy' | 'advanced' | 'circuit';
  size?: number;
}

export default function ActivityTypeIcon({ activityType, mode, size = 16 }: Props) {
  const { T } = useTheme();

  let color: string;
  if (mode === 'circuit') {
    color = T.phases.warmup;
  } else if (activityType === 'run') {
    color = T.phases.cooldown;
  } else if (activityType === 'spinning') {
    color = T.phases.rest;
  } else {
    color = T.accent;
  }

  const p = { ...BASE_SVG_STROKE, stroke: color };

  if (mode === 'circuit') {
    // Dumbbell
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path {...p} d="M3.2 9.5v5" />
        <Path {...p} d="M6.4 7.2v9.6" />
        <Path {...p} d="M6.4 12h11.2" />
        <Path {...p} d="M17.6 7.2v9.6" />
        <Path {...p} d="M20.8 9.5v5" />
      </Svg>
    );
  }

  if (activityType === 'run') {
    // Running figure
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="15.5" cy="4.6" r="2.1" {...p} />
        <Path {...p} d="M14.2 8.3 10 13.4l3.6 1.9.5 5" />
        <Path {...p} d="M10 13.4 6.2 16.8 4 18.4" />
        <Path {...p} d="M13.6 9.6l3.3 1.7 2.7-.6" />
        <Path {...p} d="M16.9 11.3l-.4 3" />
      </Svg>
    );
  }

  if (activityType === 'spinning') {
    // Bicycle
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="6" cy="16.4" r="3.5" {...p} />
        <Circle cx="18" cy="16.4" r="3.5" {...p} />
        <Path {...p} d="M11 16.4 9 8.2M11 16.4 16 8.2M9 8.2h7M11 16.4H6M16 8.2l2 8.2" />
        <Path {...p} d="M7.9 7.7h2.4" />
        <Path {...p} d="M16 8.2V6.4M14.7 6.4h2.6" />
      </Svg>
    );
  }

  // Standard: stopwatch
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="14" r="7" {...p} />
      <Path {...p} d="M9.7 3.2h4.6" />
      <Path {...p} d="M12 3.4V7" />
      <Path {...p} d="M18.4 7.6l1.3-1.3" />
      <Path {...p} d="M12 14l3 1.8" />
      <Path {...p} d="M12 14V10.2" />
    </Svg>
  );
}
