import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { BASE_SVG_STROKE } from './svgStroke';
import { ACTIVITY_ICON_SHAPES } from './activityIconShapes';

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
    const shape = ACTIVITY_ICON_SHAPES.circuit;
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {shape.paths.map(d => <Path key={d} {...p} d={d} />)}
      </Svg>
    );
  }

  if (activityType === 'run') {
    // Running figure
    const shape = ACTIVITY_ICON_SHAPES.run;
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {shape.circles!.map(c => <Circle key={`${c.cx},${c.cy}`} {...c} {...p} />)}
        {shape.paths.map(d => <Path key={d} {...p} d={d} />)}
      </Svg>
    );
  }

  if (activityType === 'spinning') {
    // Bicycle
    const shape = ACTIVITY_ICON_SHAPES.spinning;
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {shape.circles!.map(c => <Circle key={`${c.cx},${c.cy}`} {...c} {...p} />)}
        {shape.paths.map(d => <Path key={d} {...p} d={d} />)}
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
