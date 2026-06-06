import React from 'react';
import { StyleSheet, View } from 'react-native';
import { totalDuration, type Segment } from '../lib/workout';
import { useTheme } from '../theme';

export default function PhaseStrip({ segments }: { segments: Segment[] }) {
  const { T } = useTheme();
  const total = totalDuration(segments);
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
