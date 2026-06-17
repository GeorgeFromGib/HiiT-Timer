import { useCallback, useEffect, useRef, useState } from 'react';

export function usePreStartCountdown(callbacks: {
  onTick?: () => void;
  onComplete: () => void;
}) {
  const [count, setCount] = useState<null | 3 | 2 | 1>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const cancel = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setCount(null);
  }, []);

  const begin = useCallback(() => {
    setCount(3);
    callbacksRef.current.onTick?.();
    let c = 3;
    intervalRef.current = setInterval(() => {
      c -= 1;
      if (c > 0) {
        setCount(c as 2 | 1);
        callbacksRef.current.onTick?.();
      } else {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setCount(null);
        callbacksRef.current.onComplete();
      }
    }, 1000);
  }, []);

  // Reads a ref — always returns current value, safe to call inside useCallback
  const isRunning = useCallback(() => intervalRef.current !== null, []);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  return { count, begin, cancel, isRunning };
}
