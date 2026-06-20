import { useEffect, useRef } from 'react';
import { startWorkoutActivity, updateWorkoutActivity, endWorkoutActivity } from '../lib/liveActivity';
import type { Phase } from '../lib/workout';
import type { WorkoutStatus } from './useWorkoutSession';

interface Props {
  status: WorkoutStatus;
  phase: Phase;
  phaseColor: string;
  timeRemaining: number; // must be Math.ceil(remainingInSegment) — integer changes once/sec
  sessionName: string;
}

export function useLiveActivity({ status, phase, phaseColor, timeRemaining, sessionName }: Props) {
  const isActiveRef = useRef(false);
  const lastSecRef = useRef(-1);
  const lastPhaseRef = useRef<Phase | null>(null);

  useEffect(() => {
    if (status === 'running') {
      const secChanged = timeRemaining !== lastSecRef.current;
      const phaseChanged = phase !== lastPhaseRef.current;

      if (!isActiveRef.current) {
        isActiveRef.current = true;
        lastPhaseRef.current = phase;
        lastSecRef.current = timeRemaining;
        startWorkoutActivity({ sessionName, phase, timeRemaining, phaseColor }).catch(() => {});
      } else if (phaseChanged || secChanged) {
        lastPhaseRef.current = phase;
        lastSecRef.current = timeRemaining;
        updateWorkoutActivity({ phase, timeRemaining, phaseColor }).catch(() => {});
      }
    } else if (status === 'finished' || status === 'idle') {
      if (isActiveRef.current) {
        isActiveRef.current = false;
        lastSecRef.current = -1;
        lastPhaseRef.current = null;
        endWorkoutActivity().catch(() => {});
      }
    }
  }, [status, phase, phaseColor, timeRemaining, sessionName]);

  // End activity if the component unmounts mid-workout (e.g. back button)
  useEffect(() => {
    return () => {
      if (isActiveRef.current) {
        endWorkoutActivity().catch(() => {});
      }
    };
  }, []);
}
