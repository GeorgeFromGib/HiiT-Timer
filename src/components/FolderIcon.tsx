import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { FolderIconName } from '../lib/sessions';
import { BASE_SVG_STROKE } from './svgStroke';
import { ACTIVITY_ICON_SHAPES } from './activityIconShapes';

interface Props {
  name: FolderIconName;
  color: string;
  size?: number;
}

export default function FolderIcon({ name, color, size = 20 }: Props) {
  const p = { ...BASE_SVG_STROKE, stroke: color };

  switch (name) {
    case 'sun':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Circle cx="12" cy="12" r="4.2" />
            <Path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
          </G>
        </Svg>
      );
    case 'flame':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M12 2.5c3 4 6 5.5 6 10a6 6 0 0 1-12 0c0-2 1-3.4 2.4-4.6.2 1.6 1 2.4 2 2.6-1.2-3 .3-6.4 1.6-8z" />
        </Svg>
      );
    case 'bolt':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M13 2 4 13h6l-1 9 9-12h-6l1-8z" />
        </Svg>
      );
    case 'pauseIcon':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Rect x="6" y="5" width="4" height="14" rx="1.5" />
            <Rect x="14" y="5" width="4" height="14" rx="1.5" />
          </G>
        </Svg>
      );
    case 'snow':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10" />
            <Path d="M12 6l-2.5-2.5M12 6l2.5-2.5M12 18l-2.5 2.5M12 18l2.5 2.5" />
          </G>
        </Svg>
      );
    case 'standard':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Circle cx="12" cy="14" r="7" />
            <Path d="M9.7 3.2h4.6" />
            <Path d="M12 3.4V7" />
            <Path d="M18.4 7.6l1.3-1.3" />
            <Path d="M12 14l3 1.8" />
            <Path d="M12 14V10.2" />
          </G>
        </Svg>
      );
    case 'run':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            {ACTIVITY_ICON_SHAPES.run.circles!.map(c => <Circle key={`${c.cx},${c.cy}`} {...c} />)}
            {ACTIVITY_ICON_SHAPES.run.paths.map(d => <Path key={d} d={d} />)}
          </G>
        </Svg>
      );
    case 'circuit':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            {ACTIVITY_ICON_SHAPES.circuit.paths.map(d => <Path key={d} d={d} />)}
          </G>
        </Svg>
      );
    case 'spinning':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            {ACTIVITY_ICON_SHAPES.spinning.circles!.map(c => <Circle key={`${c.cx},${c.cy}`} {...c} />)}
            {ACTIVITY_ICON_SHAPES.spinning.paths.map(d => <Path key={d} d={d} />)}
          </G>
        </Svg>
      );
    case 'folder':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </Svg>
      );
    case 'folderOpen':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M3 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 1.95 2.45l-1.2 5.5a2 2 0 0 1-1.95 1.55H6a2 2 0 0 1-2-2v-7.5z" />
        </Svg>
      );
    case 'star':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M12 3.2l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7z" />
        </Svg>
      );
    case 'heart':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M12 20.5s-7.6-4.6-10-9.1C.5 8 2.3 4.5 5.8 4c2-.3 3.9.6 5 2.2C11.9 4.6 13.8 3.7 15.8 4c3.5.5 5.3 4 3.8 7.4-2.4 4.5-10 9.1-10 9.1z" />
        </Svg>
      );
    case 'tag':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M3 11.5V5a2 2 0 0 1 2-2h6.5L21 11.5 12.5 20 3 11.5z" />
          <Circle cx="8" cy="8" r="1.4" fill={color} stroke="none" />
        </Svg>
      );
    case 'bookmark':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M6 3.5h12v17l-6-4-6 4v-17z" />
        </Svg>
      );
    case 'flag':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Path d="M6 21V3.8" />
            <Path d="M6 4.2c2-1.4 4.2-1.4 6.2 0 2.2 1.5 4.4 1.5 6.4 0v8.5c-2 1.5-4.2 1.5-6.4 0-2-1.4-4.2-1.4-6.2 0z" />
          </G>
        </Svg>
      );
    case 'target':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Circle cx="12" cy="12" r="8.5" />
            <Circle cx="12" cy="12" r="4.8" />
          </G>
          <Circle cx="12" cy="12" r="1.2" fill={color} stroke="none" />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Rect x="3.5" y="5" width="17" height="16" rx="2.4" />
            <Path d="M8 3v4M16 3v4M3.5 10h17" />
          </G>
        </Svg>
      );
    case 'pin':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Path d="M12 21.5s-6.5-6.1-6.5-11.3a6.5 6.5 0 1 1 13 0c0 5.2-6.5 11.3-6.5 11.3z" />
            <Circle cx="12" cy="10.2" r="2.3" />
          </G>
        </Svg>
      );
    case 'archive':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Rect x="3.5" y="4.5" width="17" height="4.5" rx="1.2" />
            <Path d="M4.7 9v9.3a2 2 0 0 0 2 2h10.6a2 2 0 0 0 2-2V9" />
            <Path d="M10 13.3h4" />
          </G>
        </Svg>
      );
    case 'grid':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Rect x="3.5" y="3.5" width="7.2" height="7.2" rx="1.4" />
            <Rect x="13.3" y="3.5" width="7.2" height="7.2" rx="1.4" />
            <Rect x="3.5" y="13.3" width="7.2" height="7.2" rx="1.4" />
            <Rect x="13.3" y="13.3" width="7.2" height="7.2" rx="1.4" />
          </G>
        </Svg>
      );
    case 'list':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...p} d="M8.5 6h12M8.5 12h12M8.5 18h12" />
          <Circle cx="4" cy="6" r="1.1" fill={color} stroke="none" />
          <Circle cx="4" cy="12" r="1.1" fill={color} stroke="none" />
          <Circle cx="4" cy="18" r="1.1" fill={color} stroke="none" />
        </Svg>
      );
    case 'bell':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Path d="M6 17V10.5a6 6 0 0 1 12 0V17l1.8 2.5H4.2z" />
            <Path d="M10 21a2.2 2.2 0 0 0 4 0" />
          </G>
        </Svg>
      );
    case 'lock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Rect x="5" y="10.5" width="14" height="10" rx="2.2" />
            <Path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
          </G>
        </Svg>
      );
    case 'share':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Circle cx="18" cy="5.5" r="2.4" />
            <Circle cx="6" cy="12" r="2.4" />
            <Circle cx="18" cy="18.5" r="2.4" />
            <Path d="M8.1 10.8l7.8-4.3M8.1 13.2l7.8 4.3" />
          </G>
        </Svg>
      );
    case 'home':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Path d="M4 11.5L12 4l8 7.5" />
            <Path d="M6 10v9.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10" />
            <Path d="M10 20.5V14h4v6.5" />
          </G>
        </Svg>
      );
    case 'user':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Circle cx="12" cy="8" r="3.6" />
            <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
          </G>
        </Svg>
      );
    case 'users':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G {...p}>
            <Circle cx="9" cy="8.2" r="3.2" />
            <Path d="M3 20.2a6 6 0 0 1 12 0" />
            <Path d="M15.5 5.4a3.2 3.2 0 0 1 0 6.2" />
            <Path d="M17.5 14.5a6 6 0 0 1 3.5 5.7" />
          </G>
        </Svg>
      );
  }
}
