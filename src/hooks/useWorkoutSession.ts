import { useCallback, useEffect, useRef, useState } from 'react';
import { configureAudioSession, useWorkoutAudio } from '../lib/audio';
import { useTimerEngine } from './useTimerEngine';
import { usePreStartCountdown } from './usePreStartCountdown';
import { useHapticBurst } from './useHapticBurst';
import { reindexSegments, Segment } from '../lib/workout';
import { DEFAULT_SETTINGS, type Settings } from '../lib/settings';
import { getCongratsMessages } from '../lib/i18n';

export type WorkoutStatus = 'idle' | 'preStart' | 'running' | 'paused' | 'finished';

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

export interface WorkoutSession {
  status: WorkoutStatus;
  preStartCount: 3 | 2 | 1 | null;
  elapsed: number;
  currentIndex: number;
  remainingInSegment: number;
  remainingTotal: number;
  congratsMsg: string;
  stats: SessionStats;
  handlePlayPause: () => void;
  reset: () => void;
  skip: () => void;
  skipBack: () => void;
  extend: (seconds: number) => Segment[];
  addRound: (segsToInsert: Segment[]) => Segment[];
}

export function useWorkoutSession(
  segments: Segment[],
  settings: Settings = DEFAULT_SETTINGS,
  onCountdownBeat?: () => void,
): WorkoutSession {
  const cues = useWorkoutAudio(settings);

  const onCountdownBeatRef = useRef(onCountdownBeat);
  onCountdownBeatRef.current = onCountdownBeat;

  const [congratsMsg] = useState(() => {
    const msgs = getCongratsMessages();
    return msgs[Math.floor(Math.random() * msgs.length)];
  });

  const hapticBurst = useHapticBurst();

  const {
    state, start, pause, resume, reset: engineReset,
    skip: engineSkip, skipBack: engineSkipBack, extend: engineExtend,
    replaceSegments, getSegments,
  } = useTimerEngine(segments, {
    onTransition: (_from, to) => {
      cues.onTransition(to?.phase ?? null);
      if (to !== null && settings.hapticFeedback) {
        hapticBurst.start();
      }
    },
    onCountdown: () => {
      cues.onCountdown();
      onCountdownBeatRef.current?.();
    },
    onPrepare: (nextSeg) => {
      const totalSegments = segments.length;
      const isLastSegment = nextSeg.index === totalSegments - 1;
      const phase = isLastSegment ? 'finish' : nextSeg.phase;
      cues.onPrepare(phase);
    },
    onFinish: () => {
      cues.onFinish();
      if (settings.hapticFeedback) hapticBurst.start();
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
      hapticBurst.cancel();
      pause();
    } else {
      resume();
    }
  }, [countdown, state.status, pause, resume, hapticBurst]);

  const [skippedCount,      setSkippedCount]      = useState(0);
  const [skippedSecs,       setSkippedSecs]       = useState(0);
  const [skippedWorkSecs,   setSkippedWorkSecs]   = useState(0);
  const [extendedSecs,      setExtendedSecs]      = useState(0);
  const [addedRoundSecs,    setAddedRoundSecs]    = useState(0);
  const [skipBackSecs,      setSkipBackSecs]      = useState(0);
  const [skipBackWorkSecs,  setSkipBackWorkSecs]  = useState(0);
  const [skipBackWorkCount, setSkipBackWorkCount] = useState(0);

  const reset = useCallback(() => {
    hapticBurst.cancel();
    countdown.cancel();
    cues.stopKeepAlive();
    engineReset();
    setSkippedCount(0);
    setSkippedSecs(0);
    setSkippedWorkSecs(0);
    setExtendedSecs(0);
    setAddedRoundSecs(0);
    setSkipBackSecs(0);
    setSkipBackWorkSecs(0);
    setSkipBackWorkCount(0);
  }, [countdown, cues, engineReset, hapticBurst]);

  const skip = useCallback(() => {
    setSkippedCount(c => c + 1);
    setSkippedSecs(s => s + Math.ceil(state.remainingInSegment));
    const seg = getSegments()[state.currentIndex];
    if (seg && seg.phase === 'work') {
      setSkippedWorkSecs(s => s + Math.ceil(state.remainingInSegment));
    }
    engineSkip();
  }, [engineSkip, getSegments, state.remainingInSegment, state.currentIndex]);

  const skipBack = useCallback(() => {
    const segs = getSegments();
    const seg = segs[state.currentIndex];
    if (seg) {
      const prevSeg = segs[state.currentIndex - 1];
      const backSecs = Math.ceil(state.elapsed - (prevSeg ? prevSeg.startAt : 0));
      setSkipBackSecs(s => s + backSecs);
      if (seg.phase === 'work') {
        setSkipBackWorkSecs(s => s + backSecs);
        setSkipBackWorkCount(c => c + 1);
      }
    }
    engineSkipBack();
  }, [engineSkipBack, getSegments, state.currentIndex, state.elapsed]);

  const extend = useCallback((secs: number): Segment[] => {
    setExtendedSecs(s => s + secs);
    return engineExtend(secs);
  }, [engineExtend]);

  const addRound = useCallback((segsToInsert: Segment[]): Segment[] => {
    const live = getSegments();
    const insertAt = live.findLastIndex(s => s.phase !== 'cooldown') + 1;
    const before = live.slice(0, insertAt);
    const after  = live.slice(insertAt);
    const insertionCursor = before.length ? before[before.length - 1].endAt : 0;
    const inserted = reindexSegments(segsToInsert, insertionCursor, before.length);
    const afterCursor = inserted.length ? inserted[inserted.length - 1].endAt : insertionCursor;
    const recalcAfter = reindexSegments(after, afterCursor, before.length + inserted.length);
    setAddedRoundSecs(s => s + segsToInsert.reduce((sum, seg) => sum + seg.duration, 0));
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
    stats: {
      skippedCount, skippedSecs, skippedWorkSecs, extendedSecs,
      addedRoundSecs, skipBackSecs, skipBackWorkSecs, skipBackWorkCount,
    },
    handlePlayPause,
    reset,
    skip,
    skipBack,
    extend,
    addRound,
  };
}
