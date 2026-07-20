// Wall-clock countdown, same principle as timerEngine.ts: never trust a counter
// decremented once per tick. Instead read Date.now() every tick and derive which
// beat (3/2/1) we're on from actual elapsed time, so a stalled JS thread lands on
// the correct beat on the next tick instead of drifting or skipping silently.

import { useCallback, useEffect, useRef, useState } from 'react';

const TICK_MS = 100;
const COUNTDOWN_SECONDS = 3;

export function usePreStartCountdown(callbacks: {
  onTick?: () => void;
  onComplete: () => void;
}) {
  const [count, setCount] = useState<null | 3 | 2 | 1>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startEpochRef = useRef(0);
  // De-dupe ref so onTick fires exactly once per beat, even though tick() runs every TICK_MS.
  const lastCountRef = useRef<3 | 2 | 1 | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const clear = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const cancel = useCallback(() => {
    clear();
    lastCountRef.current = null;
    setCount(null);
  }, []);

  const tick = useCallback(() => {
    const elapsedSec = (Date.now() - startEpochRef.current) / 1000;
    if (elapsedSec >= COUNTDOWN_SECONDS) {
      clear();
      lastCountRef.current = null;
      setCount(null);
      callbacksRef.current.onComplete();
      return;
    }
    const c = (COUNTDOWN_SECONDS - Math.floor(elapsedSec)) as 3 | 2 | 1;
    if (c !== lastCountRef.current) {
      lastCountRef.current = c;
      setCount(c);
      callbacksRef.current.onTick?.();
    }
  }, []);

  const begin = useCallback(() => {
    startEpochRef.current = Date.now();
    lastCountRef.current = null;
    clear();
    intervalRef.current = setInterval(tick, TICK_MS);
    tick(); // immediate update, don't wait one tick
  }, [tick]);

  // Reads a ref — always returns current value, safe to call inside useCallback
  const isRunning = useCallback(() => intervalRef.current !== null, []);

  useEffect(() => () => clear(), []);

  return { count, begin, cancel, isRunning };
}
