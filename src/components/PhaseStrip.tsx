import React from 'react';
import { StyleSheet, View } from 'react-native';
import { expandWorkout, PHASE_META, totalDuration } from '../workout';
import type { Session } from '../sessions';

export default function PhaseStrip({ session }: { session: Session }) {
  const segments = expandWorkout(session.config);
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
              backgroundColor: PHASE_META[seg.phase].color + 'd9',
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
