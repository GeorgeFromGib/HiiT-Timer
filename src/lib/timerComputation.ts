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

export interface BeatSchedule {
  prepareDelayMs: number | null;
  beats: { beat: 3 | 2 | 1; delayMs: number }[];
}

// Given the seconds remaining in the current segment, compute when (relative delay
// in ms) the prepare cue and each 3-2-1 countdown beat should fire. Pure so the
// scheduling math is reviewable on its own, separate from the setTimeout
// orchestration and live segment refs that surround it in useTimerEngine.
export function computeBeatSchedule(remainingSeconds: number): BeatSchedule {
  const prepareDelayMs = remainingSeconds >= 5 ? (remainingSeconds - 5) * 1000 : null;
  const beats = ([3, 2, 1] as const)
    .map(beat => ({ beat, delayMs: (remainingSeconds - beat) * 1000 }))
    .filter(b => b.delayMs >= 0);
  return { prepareDelayMs, beats };
}
