import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { withOpacity } from '../theme';
import { BASE_SVG_STROKE } from './svgStroke';
import { type AppAlertKind } from '../lib/appAlert';

const KIND_COLORS: Record<AppAlertKind, string> = {
  warning: '#f59e0b',
  error:   '#ef4444',
  info:    '#3b82f6',
};

interface Props {
  kind: AppAlertKind;
  size?: number;
}

export default function AppAlertIcon({ kind, size = 28 }: Props) {
  const color = KIND_COLORS[kind];
  const badgeSize = size + 24;

  return (
    <View style={[styles.badge, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2, backgroundColor: withOpacity(color, 0x22) }]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <G {...BASE_SVG_STROKE} stroke={color}>
          {kind === 'warning' && (
            <>
              <Path d="M12 3.2 L21.5 20 H2.5 Z" />
              <Path d="M12 9.5v4.6" />
            </>
          )}
          {kind === 'error' && (
            <>
              <Circle cx="12" cy="12" r="8.5" />
              <Path d="M9 9l6 6M15 9l-6 6" />
            </>
          )}
          {kind === 'info' && (
            <>
              <Circle cx="12" cy="12" r="8.5" />
              <Path d="M12 11v5" />
            </>
          )}
        </G>
        {kind === 'warning' && <Circle cx="12" cy="17.3" r="1.1" fill={color} stroke="none" />}
        {kind === 'info' && <Circle cx="12" cy="7.7" r="1.1" fill={color} stroke="none" />}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
