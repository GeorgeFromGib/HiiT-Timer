import React from 'react';
import { StyleSheet, View } from 'react-native';
import { totalDuration } from '../workout';
import { getSessionSegments } from '../sessions';
import { useTheme } from '../theme';
import type { Session } from '../sessions';

export default function PhaseStrip({ session }: { session: Session }) {
  const { T }    = useTheme();
  const segments = getSessionSegments(session);
  const total    = totalDuration(segments);
  if (total === 0) return null;
  return (
    <View style={styles.strip}>
      {segments.map((seg, i) => (
        <View
          key={i}
          style={[
            styles.seg,
            {
              flex:            seg.duration / total,
              backgroundColor: T.phases[seg.phase] + 'd9',
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    height: 9,
    borderRadius: 4,
    marginTop: 10,
    gap: 2,
  },
  seg: {
    height: '100%',
    borderRadius: 4,
  },
});
