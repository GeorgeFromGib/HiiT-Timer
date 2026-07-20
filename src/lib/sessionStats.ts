import type { Segment } from './workout';

// Session-summary deltas caused by skip/skipBack/extend/addRound — what
// SessionCompleteScreen needs to recap "what actually happened" vs. the plan.
export interface SessionStats {
  skippedCount:      number;
  skippedSecs:       number;
  skippedWorkSecs:   number;
  extendedSecs:      number;
  addedRoundSecs:    number;
  skipBackSecs:      number;
  skipBackWorkSecs:  number;
  skipBackWorkCount: number;
}

export const ZERO_STATS: SessionStats = {
  skippedCount:      0,
  skippedSecs:       0,
  skippedWorkSecs:   0,
  extendedSecs:      0,
  addedRoundSecs:    0,
  skipBackSecs:      0,
  skipBackWorkSecs:  0,
  skipBackWorkCount: 0,
};

// The single place that owns how each workout-session event affects SessionStats.
// Each function takes the stats so far plus what's needed to derive the delta, and
// returns the next stats — callers just wire these into their event handlers.

export function applySkip(stats: SessionStats, seg: Segment | undefined, remainingInSegment: number): SessionStats {
  const secs = Math.ceil(remainingInSegment);
  return {
    ...stats,
    skippedCount:    stats.skippedCount + 1,
    skippedSecs:     stats.skippedSecs + secs,
    skippedWorkSecs: stats.skippedWorkSecs + (seg?.phase === 'work' ? secs : 0),
  };
}

export function applySkipBack(stats: SessionStats, seg: Segment | undefined, backSecs: number): SessionStats {
  if (!seg) return stats;
  const isWork = seg.phase === 'work';
  return {
    ...stats,
    skipBackSecs:      stats.skipBackSecs + backSecs,
    skipBackWorkSecs:  stats.skipBackWorkSecs + (isWork ? backSecs : 0),
    skipBackWorkCount: stats.skipBackWorkCount + (isWork ? 1 : 0),
  };
}

export function applyExtend(stats: SessionStats, secs: number): SessionStats {
  return { ...stats, extendedSecs: stats.extendedSecs + secs };
}

export function applyAddRound(stats: SessionStats, secs: number): SessionStats {
  return { ...stats, addedRoundSecs: stats.addedRoundSecs + secs };
}
