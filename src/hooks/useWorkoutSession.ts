import { useCallback, useEffect, useRef, useState } from 'react';
import { configureAudioSession, useWorkoutAudio } from '../lib/audio';
import { useTimerEngine } from './useTimerEngine';
import { Segment } from '../lib/workout';
import { DEFAULT_SETTINGS, type Settings } from '../lib/settings';

const CONGRATS = [
  "You crushed it.",
  "That's what you're made of.",
  "Every rep counted.",
  "Nothing left in the tank. Perfect.",
  "Earned.",
  "That's the streak. Keep it.",
  "One more session in the bank.",
  "Progress doesn't lie.",
  "You showed up. That's everything.",
  "Tomorrow you'll be glad you did this.",
  "Your future self says thanks.",
  "Sweat well spent.",
  "Rest. You've earned it.",
  "Not bad at all.",
  "The couch wasn't this good anyway.",
  "Done. Well done.",
  "Work complete.",
  "That happened.",
  "Check.",
  "Session closed.",
] as const;

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
  const audio = useWorkoutAudio();
  // Stable ref so interval callbacks always reach the latest audio methods
  // without appearing in useCallback dep arrays.
  const audioRef = useRef(audio);
  audioRef.current = audio;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const onCountdownBeatRef = useRef(onCountdownBeat);
  onCountdownBeatRef.current = onCountdownBeat;

  const [preStartCount, setPreStartCount] = useState<null | 3 | 2 | 1>(null);
  const preStartIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [congratsMsg] = useState(
    () => CONGRATS[Math.floor(Math.random() * CONGRATS.length)]
  );

  const { state, start, pause, resume, reset: engineReset, skip, extend } = useTimerEngine(segments, {
    onTransition: (_from, to) => {
      const { soundOff, soundCues, soundVolume } = settingsRef.current;
      if (to && !soundOff && soundCues) audioRef.current.playChime(soundVolume / 100);
    },
    onCountdown: () => {
      const { soundOff, finalCountdownBeep, soundVolume } = settingsRef.current;
      if (!soundOff && finalCountdownBeep) audioRef.current.playTick(soundVolume / 100);
      onCountdownBeatRef.current?.();
    },
    onFinish: () => {
      const { soundOff, soundCues, soundVolume } = settingsRef.current;
      if (!soundOff && soundCues) audioRef.current.playFinish(soundVolume / 100);
      audioRef.current.stopKeepAlive();
    },
  });

  useEffect(() => { configureAudioSession(); }, []);

  useEffect(() => () => {
    if (preStartIntervalRef.current) clearInterval(preStartIntervalRef.current);
  }, []);

  const beginPreStart = useCallback(() => {
    setPreStartCount(3);
    const { soundOff, soundCues, soundVolume } = settingsRef.current;
    if (!soundOff && soundCues) audioRef.current.playTick(soundVolume / 100);
    let count = 3;
    preStartIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setPreStartCount(count as 2 | 1);
        const { soundOff, soundCues, soundVolume } = settingsRef.current;
        if (!soundOff && soundCues) audioRef.current.playTick(soundVolume / 100);
      } else {
        clearInterval(preStartIntervalRef.current!);
        preStartIntervalRef.current = null;
        setPreStartCount(null);
        audioRef.current.startKeepAlive();
        start();
      }
    }, 1000);
  }, [start]);

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
