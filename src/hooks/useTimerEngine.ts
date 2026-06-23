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
import { computeTimerSnapshot } from '../lib/timerComputation';

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

  // De-dupe ref so transitions fire exactly once per segment crossing.
  const lastIndexRef = useRef<number>(-1);
  // Precisely-scheduled countdown beat timeouts (replaces polling-based detection).
  const beatTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cbRef = useRef(cb);
  cbRef.current = cb;

  const computeElapsed = () => {
    if (statusRef.current === 'running') {
      return accumulatedRef.current + (Date.now() - resumeEpochRef.current) / 1000;
    }
    return accumulatedRef.current;
  };

  const clearBeats = () => {
    beatTimeoutsRef.current.forEach(clearTimeout);
    beatTimeoutsRef.current = [];
  };

  // Schedule precise setTimeout for each countdown beat (3, 2, 1) still in the
  // future. Using setTimeout instead of polling eliminates the ±200ms jitter
  // that comes from detecting beats inside the 200ms tick interval.
  const scheduleBeats = (segIndex: number, remainingSeconds: number) => {
    clearBeats();
    [3, 2, 1].forEach((beat) => {
      const delayMs = (remainingSeconds - beat) * 1000;
      if (delayMs >= 0) {
        beatTimeoutsRef.current.push(
          setTimeout(() => {
            if (statusRef.current === 'running') {
              const seg = segmentsRef.current[segIndex];
              if (seg) cbRef.current.onCountdown?.(beat, seg);
            }
          }, delayMs),
        );
      }
    });
  };

  const tick = useCallback(() => {
    const segs = segmentsRef.current;
    const elapsed = Math.min(computeElapsed(), totalDuration(segs));
    const { isFinished, index, remainingInSegment, remainingTotal } = computeTimerSnapshot(elapsed, segs);

    if (isFinished) {
      const prev = lastIndexRef.current >= 0 ? segs[lastIndexRef.current] : null;
      if (statusRef.current !== 'finished') {
        statusRef.current = 'finished';
        clearBeats();
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
      scheduleBeats(index, remainingInSegment);
    } else if (remainingInSegment <= 4 && beatTimeoutsRef.current.length === 0) {
      // Re-schedule after a resume (beats were cleared on pause).
      scheduleBeats(index, remainingInSegment);
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
    clearBeats();
    startLoop();
  }, [startLoop]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'running') return;
    accumulatedRef.current = computeElapsed();
    statusRef.current = 'paused';
    clearBeats();
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
    clearBeats();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    accumulatedRef.current = 0;
    statusRef.current = 'idle';
    lastIndexRef.current = -1;
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
    clearBeats();
    const elapsed = computeElapsed();
    const idx = segmentIndexAt(segmentsRef.current, elapsed);
    const seg = segmentsRef.current[idx];
    if (!seg) return;
    accumulatedRef.current = seg.endAt; // land exactly on the boundary
    resumeEpochRef.current = Date.now();
    tick();
  }, [tick]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      beatTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

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
    if (statusRef.current === 'running') {
      scheduleBeats(idx, newSegments[idx].endAt - elapsed);
    }
    return newSegments;
  }, []);

  const replaceSegments = useCallback((newSegs: Segment[]): Segment[] => {
    segmentsRef.current = newSegs;
    return newSegs;
  }, []);

  const getSegments = useCallback((): Segment[] => segmentsRef.current, []);

  return { state, start, pause, resume, reset, skip, extend, replaceSegments, getSegments, sync: tick };
}
