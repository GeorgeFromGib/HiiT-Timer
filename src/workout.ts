export type Phase = 'warmup' | 'work' | 'rest' | 'cooldown';

export interface Segment {
  phase: Phase;
  label: string;
  duration: number;
  startAt: number;
  endAt: number;
  index: number;
}

export interface Interval {
  type: Phase;
  dur: number; // seconds
}

export interface WorkoutConfig {
  warmup: number;
  high: number;
  low: number;
  rounds: number;
  cooldown: number;
  dropLastRecovery?: boolean;
}

export const PHASE_META: Record<Phase, { color: string; word: string; icon: string }> = {
  warmup:   { color: '#ff8a3d', word: 'WARM UP',    icon: 'sun'   },
  work:     { color: '#ff5a5f', word: 'INTENSITY',  icon: 'flame' },
  rest:     { color: '#5fd38a', word: 'RECOVER',    icon: 'pause' },
  cooldown: { color: '#46a6ff', word: 'COOL DOWN',  icon: 'sun'   },
};

export function intervalsToSegments(intervals: Interval[]): Segment[] {
  let cursor = 0;
  return intervals.map((iv, i) => {
    const seg: Segment = {
      phase: iv.type,
      label: `Interval ${i + 1}`,
      duration: iv.dur,
      startAt: cursor,
      endAt: cursor + iv.dur,
      index: i,
    };
    cursor += iv.dur;
    return seg;
  });
}

export function expandWorkout(cfg: WorkoutConfig): Segment[] {
  const raw: Array<Pick<Segment, 'phase' | 'label' | 'duration'>> = [];

  if (cfg.warmup > 0) {
    raw.push({ phase: 'warmup', label: 'Warm Up', duration: cfg.warmup });
  }

  for (let r = 0; r < cfg.rounds; r++) {
    raw.push({ phase: 'work', label: `Work ${r + 1}/${cfg.rounds}`, duration: cfg.high });

    const isLastRound = r === cfg.rounds - 1;
    if (cfg.low > 0 && !(isLastRound && cfg.dropLastRecovery)) {
      raw.push({ phase: 'rest', label: `Recover ${r + 1}/${cfg.rounds}`, duration: cfg.low });
    }
  }

  if (cfg.cooldown > 0) {
    raw.push({ phase: 'cooldown', label: 'Cool Down', duration: cfg.cooldown });
  }

  let cursor = 0;
  return raw.map((s, i) => {
    const seg: Segment = { ...s, index: i, startAt: cursor, endAt: cursor + s.duration };
    cursor += s.duration;
    return seg;
  });
}

export function totalDuration(segments: Segment[]): number {
  return segments.length ? segments[segments.length - 1].endAt : 0;
}

export function segmentIndexAt(segments: Segment[], elapsed: number): number {
  for (const s of segments) {
    if (elapsed >= s.startAt && elapsed < s.endAt) return s.index;
  }
  return -1;
}
