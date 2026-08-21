import { useCallback, useEffect, useRef, useState } from 'react';
import { configureAudioSession, useWorkoutAudio } from '../lib/audio';
import { useTimerEngine } from './useTimerEngine';
import { usePreStartCountdown } from './usePreStartCountdown';
import { useHapticBurst } from './useHapticBurst';
import { reindexSegments, Segment, totalDuration } from '../lib/workout';
import { DEFAULT_SETTINGS, type Settings } from '../lib/settings';
import { getCongratsMessages } from '../lib/i18n';
import {
  ZERO_STATS, applySkip, applySkipBack, applyExtend, applyAddRound,
  type SessionStats,
} from '../lib/sessionStats';

export type { SessionStats };
export type WorkoutStatus = 'idle' | 'preStart' | 'running' | 'paused' | 'finished';

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
  applyIncomingLiveState: (status: 'running' | 'paused' | 'finished', elapsed: number) => void;
}

export function useWorkoutSession(
  segments: Segment[],
  settings: Settings = DEFAULT_SETTINGS,
  onCountdownBeat?: () => void,
  enableMidpointCue = false,
  initialResume?: { elapsed: number; status: 'running' | 'paused' },
): WorkoutSession {
  const cues = useWorkoutAudio(settings);
  const totalDur = totalDuration(segments);
  const midpointFiredRef = useRef(false);

  const onCountdownBeatRef = useRef(onCountdownBeat);
  onCountdownBeatRef.current = onCountdownBeat;

  const [congratsMsg] = useState(() => {
    const msgs = getCongratsMessages();
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    const useName = settings.name && Math.random() < 0.35;
    return useName ? `${settings.name} — ${msg}` : msg;
  });

  const hapticBurst = useHapticBurst();

  const {
    state, start, pause, resume, reset: engineReset,
    skip: engineSkip, skipBack: engineSkipBack, extend: engineExtend,
    replaceSegments, getSegments, applyRemoteElapsed,
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

  useEffect(() => {
    if (!enableMidpointCue || midpointFiredRef.current) return;
    if (state.status === 'running' && totalDur > 0 && state.elapsed >= totalDur / 2) {
      midpointFiredRef.current = true;
      cues.onMidpoint();
    }
  }, [enableMidpointCue, state.status, state.elapsed, totalDur, cues]);

  const countdown = usePreStartCountdown({
    onTick: () => cues.onPreStartTick(),
    onComplete: () => { cues.startKeepAlive(); start(); },
  });

  const hasAutoResumedRef = useRef(false);
  useEffect(() => {
    if (!initialResume || hasAutoResumedRef.current) return;
    hasAutoResumedRef.current = true;
    cues.startKeepAlive();
    start(initialResume.elapsed);
    if (initialResume.status === 'paused') pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyIncomingLiveState = useCallback((incomingStatus: 'running' | 'paused' | 'finished', incomingElapsed: number) => {
    if (state.status !== 'running' && state.status !== 'paused') return;
    if (incomingStatus === 'finished') {
      // Force this device to the same terminal state regardless of its own
      // elapsed/segments — applyRemoteElapsed clamps to this device's own
      // totalDur, which is enough to trip the engine's isFinished check.
      applyRemoteElapsed(totalDur);
      return;
    }
    if (incomingStatus === 'paused' && state.status === 'running') pause();
    else if (incomingStatus === 'running' && state.status === 'paused') resume();
    if (incomingStatus === 'paused' || Math.abs(state.elapsed - incomingElapsed) > 2) {
      applyRemoteElapsed(incomingElapsed);
    }
  }, [state.status, state.elapsed, pause, resume, applyRemoteElapsed, totalDur]);

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

  const [stats, setStats] = useState<SessionStats>(ZERO_STATS);

  const reset = useCallback(() => {
    hapticBurst.cancel();
    countdown.cancel();
    cues.stopKeepAlive();
    engineReset();
    midpointFiredRef.current = false;
    setStats(ZERO_STATS);
  }, [countdown, cues, engineReset, hapticBurst]);

  const skip = useCallback(() => {
    if (state.status === 'idle' || state.status === 'finished') return;
    const seg = getSegments()[state.currentIndex];
    setStats(s => applySkip(s, seg, state.remainingInSegment));
    engineSkip();
  }, [engineSkip, getSegments, state.remainingInSegment, state.currentIndex, state.status]);

  const skipBack = useCallback(() => {
    const segs = getSegments();
    const seg = segs[state.currentIndex];
    const prevSeg = segs[state.currentIndex - 1];
    const backSecs = Math.ceil(state.elapsed - (prevSeg ? prevSeg.startAt : 0));
    setStats(s => applySkipBack(s, seg, backSecs));
    engineSkipBack();
  }, [engineSkipBack, getSegments, state.currentIndex, state.elapsed]);

  const extend = useCallback((secs: number): Segment[] => {
    setStats(s => applyExtend(s, secs));
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
    setStats(s => applyAddRound(s, segsToInsert.reduce((sum, seg) => sum + seg.duration, 0)));
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
    stats,
    handlePlayPause,
    reset,
    skip,
    skipBack,
    extend,
    addRound,
    applyIncomingLiveState,
  };
}
