// timerEngine.ts
// The heart of the reliability story.
//
// KEY IDEA: never trust a counter that you increment every tick. Instead, on
// every tick we read the WALL CLOCK (Date.now) and compute how much time has
// actually elapsed. If iOS throttled or briefly suspended our JS thread, the
// very next tick still computes the correct elapsed time and the correct
// segment. The on-screen number is therefore always truthful, never drifting.
//
// Transitions and the 3-2-1 countdown are fired from inside this loop so the
// audio cues stay tied to the single source of truth (the wall clock), not to
// a separate timer that could drift away from the display.
//
// This loop only needs to keep running in the background. That is what the
// keep-alive audio session in audio.ts buys us: as long as audio is active,
// iOS lets this interval keep firing with the screen locked.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Segment, segmentIndexAt, totalDuration } from '../lib/workout';
import { computeTimerSnapshot, detectCountdownBeat } from '../lib/timerComputation';

export interface TimerState {
  status: 'idle' | 'running' | 'paused' | 'finished';
  elapsed: number;             // seconds since start (wall-clock based)
  currentIndex: number;        // -1 when idle/finished
  remainingInSegment: number;  // seconds left in current segment
  remainingTotal: number;      // seconds left in whole workout
}

interface Callbacks {
  // Fired once when crossing a boundary. `to` is null on the final finish.
  onTransition?: (from: Segment | null, to: Segment | null) => void;
  // Fired once per second for the last 3 seconds of each segment (3, 2, 1).
  onCountdown?: (secondsLeft: number, segment: Segment) => void;
  // Fired once when the whole workout completes.
  onFinish?: () => void;
}

const TICK_MS = 200; // 5x/sec: smooth display, cheap battery

export function useTimerEngine(segments: Segment[], cb: Callbacks) {
  const total = totalDuration(segments);

  // Mutable ref so tick always reads current segment data without needing
  // to be recreated mid-run (supports extend() updating boundaries live).
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const [state, setState] = useState<TimerState>({
    status: 'idle',
    elapsed: 0,
    currentIndex: -1,
    remainingInSegment: 0,
    remainingTotal: total,
  });

  // Wall-clock bookkeeping. accumulated = confirmed elapsed at last pause;
  // resumeEpoch = Date.now() at the moment we (re)started running.
  const accumulatedRef = useRef(0);
  const resumeEpochRef = useRef(0);
  const statusRef = useRef<TimerState['status']>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // De-dupe refs so each event fires exactly once.
  const lastIndexRef = useRef<number>(-1);
  const lastCountdownKeyRef = useRef<string>('');

  const cbRef = useRef(cb);
  cbRef.current = cb;

  const computeElapsed = () => {
    if (statusRef.current === 'running') {
      return accumulatedRef.current + (Date.now() - resumeEpochRef.current) / 1000;
    }
    return accumulatedRef.current;
  };

  const tick = useCallback(() => {
    const segs = segmentsRef.current;
    const elapsed = Math.min(computeElapsed(), totalDuration(segs));
    const { isFinished, index, remainingInSegment, remainingTotal } = computeTimerSnapshot(elapsed, segs);

    if (isFinished) {
      const prev = lastIndexRef.current >= 0 ? segs[lastIndexRef.current] : null;
      if (statusRef.current !== 'finished') {
        statusRef.current = 'finished';
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        cbRef.current.onTransition?.(prev, null);
        cbRef.current.onFinish?.();
      }
      setState({ status: 'finished', elapsed, currentIndex: -1, remainingInSegment: 0, remainingTotal: 0 });
      lastIndexRef.current = -1;
      return;
    }

    // Transition crossing (covers normal advance AND a catch-up after the JS
    // thread was suspended, where index may jump by more than one).
    if (index !== lastIndexRef.current) {
      const from = lastIndexRef.current >= 0 ? segs[lastIndexRef.current] : null;
      cbRef.current.onTransition?.(from, segs[index] ?? null);
      lastIndexRef.current = index;
    }

    const { beat, nextKey } = detectCountdownBeat(remainingInSegment, index, lastCountdownKeyRef.current);
    if (beat !== null) {
      lastCountdownKeyRef.current = nextKey;
      cbRef.current.onCountdown?.(beat, segs[index]);
    }

    setState({ status: statusRef.current, elapsed, currentIndex: index, remainingInSegment, remainingTotal });
  }, []);

  const startLoop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, TICK_MS);
    tick(); // immediate update, don't wait one tick
  }, [tick]);

  const start = useCallback(() => {
    accumulatedRef.current = 0;
    resumeEpochRef.current = Date.now();
    statusRef.current = 'running';
    lastIndexRef.current = -1;
    lastCountdownKeyRef.current = '';
    startLoop();
  }, [startLoop]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'running') return;
    accumulatedRef.current = computeElapsed();
    statusRef.current = 'paused';
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setState((s) => ({ ...s, status: 'paused' }));
  }, []);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    resumeEpochRef.current = Date.now();
    statusRef.current = 'running';
    startLoop();
  }, [startLoop]);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    accumulatedRef.current = 0;
    statusRef.current = 'idle';
    lastIndexRef.current = -1;
    lastCountdownKeyRef.current = '';
    setState({
      status: 'idle',
      elapsed: 0,
      currentIndex: -1,
      remainingInSegment: 0,
      remainingTotal: totalDuration(segmentsRef.current),
    });
  }, []);

  // Jump to the start of the next segment.
  const skip = useCallback(() => {
    if (statusRef.current === 'idle' || statusRef.current === 'finished') return;
    const elapsed = computeElapsed();
    const idx = segmentIndexAt(segmentsRef.current, elapsed);
    const seg = segmentsRef.current[idx];
    if (!seg) return;
    accumulatedRef.current = seg.endAt; // land exactly on the boundary
    resumeEpochRef.current = Date.now();
    tick();
  }, [tick]);

  // Extend the current segment by the given number of seconds.
  const extend = useCallback((seconds: number): Segment[] => {
    const elapsed = computeElapsed();
    const idx = segmentIndexAt(segmentsRef.current, elapsed);
    if (idx < 0) return segmentsRef.current;
    const newSegments = segmentsRef.current.map((s, i) => {
      if (i < idx) return s;
      if (i === idx) return { ...s, duration: s.duration + seconds, endAt: s.endAt + seconds };
      return { ...s, startAt: s.startAt + seconds, endAt: s.endAt + seconds };
    });
    segmentsRef.current = newSegments;
    return newSegments;
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { state, start, pause, resume, reset, skip, extend, sync: tick };
}
