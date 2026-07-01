import { Segment, segmentIndexAt, totalDuration } from './workout';

export interface TimerSnapshot {
  isFinished: boolean;
  index: number;
  remainingInSegment: number;
  remainingTotal: number;
}

export function computeTimerSnapshot(elapsed: number, segments: Segment[]): TimerSnapshot {
  const total = totalDuration(segments);
  if (elapsed >= total) {
    return { isFinished: true, index: -1, remainingInSegment: 0, remainingTotal: 0 };
  }
  const index = segmentIndexAt(segments, elapsed);
  const seg = segments[index];
  return {
    isFinished: false,
    index,
    remainingInSegment: seg ? seg.endAt - elapsed : 0,
    remainingTotal: total - elapsed,
  };
}
