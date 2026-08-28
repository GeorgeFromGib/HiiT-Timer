import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useTranslation } from '../hooks/useTranslation';
import type { Session } from '../lib/sessions';
import type { Segment } from '../lib/workout';

interface Props {
  session: Session;
  seg: Segment;
  nextSeg?: Segment;
  style?: StyleProp<TextStyle>;
}

/**
 * "SET 2 / 5" during a circuit, or "NEXT SET 3 / 5" on a circuit break. Renders
 * nothing for Tabata (the counter would always read 1 / 1) or non-circuit modes.
 */
export default function CircuitSetCounter({ session, seg, nextSeg, style }: Props) {
  const { t } = useTranslation();
  if (session.mode !== 'circuit' || session.tabata) return null;

  if (seg.circuitNumber !== undefined) {
    return <Text style={style}>{t('workout.circuit')} {seg.circuitNumber} / {session.circuits}</Text>;
  }
  if (seg.phase === 'circuitRest' && nextSeg?.circuitNumber !== undefined) {
    return <Text style={style}>{t('workout.nextCircuit')} {nextSeg.circuitNumber} / {session.circuits}</Text>;
  }
  return null;
}
