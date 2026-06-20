import { useEffect, useRef } from 'react';
import { startWorkoutActivity, updateWorkoutActivity, endWorkoutActivity } from '../lib/liveActivity';
import type { Phase } from '../lib/workout';
import type { WorkoutStatus } from './useWorkoutSession';

interface Props {
  status: WorkoutStatus;
  phase: Phase;
  phaseColor: string;
  timeRemaining: number; // seconds left in this segment — used to calculate endTime
  sessionName: string;
}

export function useLiveActivity({ status, phase, phaseColor, timeRemaining, sessionName }: Props) {
  const isActiveRef = useRef(false);
  const lastPhaseRef = useRef<Phase | null>(null);
  // timeRemaining is captured via closure at effect-run time, intentionally not in deps.
  // We only want to fire on phase/status change, not every second.
  const timeRemainingRef = useRef(timeRemaining);
  timeRemainingRef.current = timeRemaining;

  useEffect(() => {
    if (status === 'running') {
      const endTime = Date.now() / 1000 + timeRemainingRef.current;
      const phaseChanged = phase !== lastPhaseRef.current;

      if (!isActiveRef.current) {
        isActiveRef.current = true;
        lastPhaseRef.current = phase;
        startWorkoutActivity({ sessionName, phase, endTime, phaseColor }).catch(() => {});
      } else if (phaseChanged) {
        lastPhaseRef.current = phase;
        updateWorkoutActivity({ phase, endTime, phaseColor }).catch(() => {});
      }
    } else if (status === 'finished' || status === 'idle') {
      if (isActiveRef.current) {
        isActiveRef.current = false;
        lastPhaseRef.current = null;
        endWorkoutActivity().catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, phase, phaseColor, sessionName]);

  useEffect(() => {
    return () => {
      if (isActiveRef.current) {
        endWorkoutActivity().catch(() => {});
      }
    };
  }, []);
}
