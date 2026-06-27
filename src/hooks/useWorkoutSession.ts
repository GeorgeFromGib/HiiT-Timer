import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { configureAudioSession, useWorkoutAudio } from '../lib/audio';
import { useTimerEngine } from './useTimerEngine';
import { usePreStartCountdown } from './usePreStartCountdown';
import { Segment } from '../lib/workout';
import { DEFAULT_SETTINGS, type Settings } from '../lib/settings';
import { getCongratsMessages } from '../lib/i18n';

export type WorkoutStatus = 'idle' | 'preStart' | 'running' | 'paused' | 'finished';

export interface WorkoutSession {
  status: WorkoutStatus;
  preStartCount: 3 | 2 | 1 | null;
  elapsed: number;
  currentIndex: number;
  remainingInSegment: number;
  remainingTotal: number;
  congratsMsg: string;
  handlePlayPause: () => void;
  reset: () => void;
  skip: () => void;
  extend: (seconds: number) => Segment[];
  addRound: (segsToInsert: Segment[]) => Segment[];
}

function reindexFrom(segs: Segment[], startCursor: number, startIdx: number): Segment[] {
  let cursor = startCursor;
  let idx = startIdx;
  return segs.map(s => {
    const seg = { ...s, startAt: cursor, endAt: cursor + s.duration, index: idx };
    cursor += s.duration;
    idx++;
    return seg;
  });
}

export function useWorkoutSession(
  segments: Segment[],
  settings: Settings = DEFAULT_SETTINGS,
  onCountdownBeat?: () => void,
): WorkoutSession {
  const cues = useWorkoutAudio(settings);

  const onCountdownBeatRef = useRef(onCountdownBeat);
  onCountdownBeatRef.current = onCountdownBeat;

  const hapticBurstRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [congratsMsg] = useState(() => {
    const msgs = getCongratsMessages();
    return msgs[Math.floor(Math.random() * msgs.length)];
  });

  function startHapticBurst() {
    if (hapticBurstRef.current) clearInterval(hapticBurstRef.current);
    let count = 0;
    hapticBurstRef.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      count++;
      if (count >= 14) {
        clearInterval(hapticBurstRef.current!);
        hapticBurstRef.current = null;
      }
    }, 150);
  }

  const { state, start, pause, resume, reset: engineReset, skip, extend, replaceSegments, getSegments } = useTimerEngine(segments, {
    onTransition: (_from, to) => {
      cues.onTransition(to?.phase ?? null);
      if (to !== null && settings.hapticFeedback) {
        startHapticBurst();
      }
    },
    onCountdown: () => {
      cues.onCountdown();
      onCountdownBeatRef.current?.();
    },
    onFinish: () => {
      cues.onFinish();
    },
  });

  useEffect(() => { configureAudioSession(); }, []);

  const countdown = usePreStartCountdown({
    onTick: () => cues.onPreStartTick(),
    onComplete: () => { cues.startKeepAlive(); start(); },
  });

  const handlePlayPause = useCallback(() => {
    if (countdown.isRunning()) {
      countdown.cancel();
      return;
    }
    if (state.status === 'idle' || state.status === 'finished') {
      countdown.begin();
    } else if (state.status === 'running') {
      pause();
    } else {
      resume();
    }
  }, [countdown, state.status, pause, resume]);

  const reset = useCallback(() => {
    if (hapticBurstRef.current) {
      clearInterval(hapticBurstRef.current);
      hapticBurstRef.current = null;
    }
    countdown.cancel();
    cues.stopKeepAlive();
    engineReset();
  }, [countdown, cues, engineReset]);

  const addRound = useCallback((segsToInsert: Segment[]): Segment[] => {
    const live = getSegments();
    const insertAt = live.findLastIndex(s => s.phase !== 'cooldown') + 1;
    const before = live.slice(0, insertAt);
    const after  = live.slice(insertAt);
    const insertionCursor = before.length ? before[before.length - 1].endAt : 0;
    const inserted = reindexFrom(segsToInsert, insertionCursor, before.length);
    const afterCursor = inserted.length ? inserted[inserted.length - 1].endAt : insertionCursor;
    const recalcAfter = reindexFrom(after, afterCursor, before.length + inserted.length);
    return replaceSegments([...before, ...inserted, ...recalcAfter]);
  }, [getSegments, replaceSegments]);

  return {
    status: countdown.count !== null ? 'preStart' : state.status,
    preStartCount: countdown.count,
    elapsed: state.elapsed,
    currentIndex: state.currentIndex,
    remainingInSegment: state.remainingInSegment,
    remainingTotal: state.remainingTotal,
    congratsMsg,
    handlePlayPause,
    reset,
    skip,
    extend,
    addRound,
  };
}
