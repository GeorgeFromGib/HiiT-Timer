// workout.ts
// The data model. A workout config is expanded ONCE into a flat list of
// segments with pre-computed cumulative timestamps. Everything downstream
// (the visual, the audio cues, the notifications backup) reads from this list.
// Pre-computing the whole timeline up front is what makes the timer robust:
// we never rely on a counter that increments tick-by-tick and can drift.

export type Phase = 'warmup' | 'high' | 'low' | 'cooldown';

export interface Segment {
  phase: Phase;
  label: string;     // human label shown on screen, e.g. "High 2/8"
  duration: number;  // seconds
  startAt: number;   // seconds from workout start (cumulative)
  endAt: number;     // seconds from workout start
  index: number;     // position in the flat list
}

export interface WorkoutConfig {
  warmup: number;    // seconds; set 0 to skip
  high: number;      // seconds per high-intensity interval
  low: number;       // seconds of recovery between high intervals
  rounds: number;    // number of high/low cycles
  cooldown: number;  // seconds; set 0 to skip
  dropLastRecovery?: boolean; // if true, no recovery after the final high round
}

export const PHASE_META: Record<Phase, { color: string; word: string }> = {
  warmup:   { color: '#F5A623', word: 'WARM UP' },
  high:     { color: '#E0245E', word: 'GO HARD' },
  low:      { color: '#17BF63', word: 'RECOVER' },
  cooldown: { color: '#1DA1F2', word: 'COOL DOWN' },
};

export function expandWorkout(cfg: WorkoutConfig): Segment[] {
  const raw: Array<Pick<Segment, 'phase' | 'label' | 'duration'>> = [];

  if (cfg.warmup > 0) {
    raw.push({ phase: 'warmup', label: 'Warm Up', duration: cfg.warmup });
  }

  for (let r = 0; r < cfg.rounds; r++) {
    raw.push({ phase: 'high', label: `High ${r + 1}/${cfg.rounds}`, duration: cfg.high });

    const isLastRound = r === cfg.rounds - 1;
    if (cfg.low > 0 && !(isLastRound && cfg.dropLastRecovery)) {
      raw.push({ phase: 'low', label: `Recover ${r + 1}/${cfg.rounds}`, duration: cfg.low });
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

// Given elapsed seconds, which segment are we in? Returns -1 if finished.
export function segmentIndexAt(segments: Segment[], elapsed: number): number {
  for (const s of segments) {
    if (elapsed >= s.startAt && elapsed < s.endAt) return s.index;
  }
  return -1; // before start (shouldn't happen) or finished
}
