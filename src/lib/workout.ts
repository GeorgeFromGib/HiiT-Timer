export type Phase = 'warmup' | 'work' | 'rest' | 'cooldown';

export interface Segment {
  phase: Phase;
  label: string;
  duration: number;
  startAt: number;
  endAt: number;
  index: number;
  speed?: number; // km/h — only present for run sessions
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

export const PHASE_META: Record<Phase, { word: string; icon: string }> = {
  warmup:   { word: 'WARM UP',   icon: 'sun'   },
  work:     { word: 'WORK',      icon: 'flame' },
  rest:     { word: 'RECOVER',   icon: 'pause' },
  cooldown: { word: 'COOL DOWN', icon: 'sun'   },
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

export type ConvertToEasyResult =
  | { ok: true; warmup: number; work: number; rest: number; rounds: number; cooldown: number }
  | { ok: false; reason: string };

export function buildIntervalsFromEasy(cfg: WorkoutConfig): Interval[] {
  const intervals: Interval[] = [];
  if (cfg.warmup > 0)   intervals.push({ type: 'warmup', dur: cfg.warmup });
  for (let r = 0; r < cfg.rounds; r++) {
    intervals.push({ type: 'work', dur: cfg.high });
    if (cfg.low > 0) intervals.push({ type: 'rest', dur: cfg.low });
  }
  if (cfg.cooldown > 0) intervals.push({ type: 'cooldown', dur: cfg.cooldown });
  return intervals;
}

export function tryConvertToEasy(ivs: Interval[]): ConvertToEasyResult {
  let list = [...ivs];
  let easyWarmup = 0;
  let easyCooldown = 0;

  if (list.length > 0 && list[0].type === 'warmup') {
    easyWarmup = list[0].dur;
    list = list.slice(1);
  }
  if (list.length > 0 && list[list.length - 1].type === 'cooldown') {
    easyCooldown = list[list.length - 1].dur;
    list = list.slice(0, -1);
  }
  if (list.length === 0) return { ok: false, reason: 'No work intervals found.' };

  for (const iv of list) {
    if (iv.type !== 'work' && iv.type !== 'rest')
      return { ok: false, reason: `"${PHASE_META[iv.type].word}" phase cannot appear between work intervals in easy mode.` };
  }
  if (list[0].type !== 'work') return { ok: false, reason: 'Intervals must start with a Work phase.' };

  const hasRest = list.some(iv => iv.type === 'rest');
  if (hasRest) {
    if (list.length % 2 !== 0)
      return { ok: false, reason: 'Each Work interval must be paired with a Rest interval.' };
    for (let i = 0; i < list.length; i += 2) {
      if (list[i].type !== 'work')     return { ok: false, reason: 'Expected Work at position ' + (i + 1) + '.' };
      if (list[i + 1].type !== 'rest') return { ok: false, reason: 'Expected Rest after Work at position ' + (i + 1) + '.' };
    }
    const workDur = list[0].dur;
    const restDur = list[1].dur;
    for (let i = 0; i < list.length; i += 2) {
      if (list[i].dur !== workDur)     return { ok: false, reason: 'All Work intervals must have the same duration.' };
      if (list[i + 1].dur !== restDur) return { ok: false, reason: 'All Rest intervals must have the same duration.' };
    }
    return { ok: true, warmup: easyWarmup, work: workDur, rest: restDur, rounds: list.length / 2, cooldown: easyCooldown };
  } else {
    const workDur = list[0].dur;
    for (const iv of list) {
      if (iv.dur !== workDur) return { ok: false, reason: 'All Work intervals must have the same duration.' };
    }
    return { ok: true, warmup: easyWarmup, work: workDur, rest: 0, rounds: list.length, cooldown: easyCooldown };
  }
}

export function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m}m`;
  return `${m}m ${sec}s`;
}

/** Clock-style format for the live timer display: "45", "1:30", "2:05:30". */
export function fmtTimer(s: number): string {
  s = Math.max(0, Math.ceil(s));
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  if (s < 60) return `${s}`;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
