import { useCallback, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';

const BURST_COUNT = 14;
const BURST_INTERVAL_MS = 150;

export function useHapticBurst() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cancel = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    cancel();
    let count = 0;
    intervalRef.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      count++;
      if (count >= BURST_COUNT) {
        cancel();
      }
    }, BURST_INTERVAL_MS);
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { start, cancel };
}
