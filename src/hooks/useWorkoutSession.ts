import { useCallback, useEffect, useRef, useState } from 'react';
import { configureAudioSession, useWorkoutAudioCues } from '../lib/audio';
import { useTimerEngine } from './useTimerEngine';
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
}

export function useWorkoutSession(
  segments: Segment[],
  settings: Settings = DEFAULT_SETTINGS,
  onCountdownBeat?: () => void,
): WorkoutSession {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const cues = useWorkoutAudioCues(() => settingsRef.current);

  const onCountdownBeatRef = useRef(onCountdownBeat);
  onCountdownBeatRef.current = onCountdownBeat;

  const [preStartCount, setPreStartCount] = useState<null | 3 | 2 | 1>(null);
  const preStartIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [congratsMsg] = useState(() => {
    const msgs = getCongratsMessages();
    return msgs[Math.floor(Math.random() * msgs.length)];
  });

  const { state, start, pause, resume, reset: engineReset, skip, extend } = useTimerEngine(segments, {
    onTransition: (_from, to) => {
      cues.onTransition(to?.phase ?? null);
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

  useEffect(() => () => {
    if (preStartIntervalRef.current) clearInterval(preStartIntervalRef.current);
  }, []);

  const beginPreStart = useCallback(() => {
    setPreStartCount(3);
    cues.onPreStartTick();
    let count = 3;
    preStartIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setPreStartCount(count as 2 | 1);
        cues.onPreStartTick();
      } else {
        clearInterval(preStartIntervalRef.current!);
        preStartIntervalRef.current = null;
        setPreStartCount(null);
        cues.startKeepAlive();
        start();
      }
    }, 1000);
  }, [start, cues]);

  const handlePlayPause = useCallback(() => {
    // Use the ref as the pre-start check so this callback doesn't need
    // preStartCount in its dep array (avoids stale-closure issues).
    if (preStartIntervalRef.current !== null) {
      clearInterval(preStartIntervalRef.current);
      preStartIntervalRef.current = null;
      setPreStartCount(null);
      return;
    }
    if (state.status === 'idle' || state.status === 'finished') {
      beginPreStart();
    } else if (state.status === 'running') {
      pause();
    } else {
      resume();
    }
  }, [state.status, beginPreStart, pause, resume]);

  const reset = useCallback(() => {
    if (preStartIntervalRef.current) {
      clearInterval(preStartIntervalRef.current);
      preStartIntervalRef.current = null;
      setPreStartCount(null);
    }
    engineReset();
  }, [engineReset]);

  return {
    status: preStartCount !== null ? 'preStart' : state.status,
    preStartCount,
    elapsed: state.elapsed,
    currentIndex: state.currentIndex,
    remainingInSegment: state.remainingInSegment,
    remainingTotal: state.remainingTotal,
    congratsMsg,
    handlePlayPause,
    reset,
    skip,
    extend,
  };
}
