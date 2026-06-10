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

// Returns the countdown beat (3, 2, or 1) if one should fire this tick, or
// null if the beat already fired or the segment has more than 3 seconds left.
// Pass lastKey in and use nextKey to update deduplication state.
export function detectCountdownBeat(
  remainingInSegment: number,
  segmentIndex: number,
  lastKey: string,
): { beat: number | null; nextKey: string } {
  const secsLeft = Math.ceil(remainingInSegment);
  if (secsLeft >= 1 && secsLeft <= 3) {
    const key = `${segmentIndex}:${secsLeft}`;
    if (key !== lastKey) {
      return { beat: secsLeft, nextKey: key };
    }
  }
  return { beat: null, nextKey: lastKey };
}
