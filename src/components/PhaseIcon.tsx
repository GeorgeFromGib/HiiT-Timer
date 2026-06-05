import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { Phase } from '../workout';

interface Props {
  phase: Phase;
  color: string;
  size?: number;
}

export default function PhaseIcon({ phase, color, size = 23 }: Props) {
  const p = {
    fill: 'none', stroke: color, strokeWidth: 2.2,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {phase === 'warmup' || phase === 'cooldown' ? (
        <G {...p}>
          <Circle cx="12" cy="12" r="4.2" />
          <Path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
        </G>
      ) : phase === 'work' ? (
        <Path {...p} d="M12 2.5c3 4 6 5.5 6 10a6 6 0 0 1-12 0c0-2 1-3.4 2.4-4.6.2 1.6 1 2.4 2 2.6-1.2-3 .3-6.4 1.6-8z" />
      ) : (
        <G {...p}>
          <Rect x="6" y="5" width="4" height="14" rx="1.5" />
          <Rect x="14" y="5" width="4" height="14" rx="1.5" />
        </G>
      )}
    </Svg>
  );
}
