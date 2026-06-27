import { newId, type Session, type RunSpeeds, type SpinValues } from './sessions';
import { type Interval } from './workout';

export function serializeDraft(
  name: string,
  mode: 'easy' | 'advanced' | 'circuit',
  warmup: number, work: number, rest: number, cooldown: number, rounds: number,
  intervals: Array<Omit<Interval, never>>,
  activityType: 'run' | 'spinning' | undefined,
  runSpeeds: RunSpeeds,
  circuitData?: { warmup: number; cooldown: number; circuits: number; circuitRest: number },
): string {
  return JSON.stringify({ name, mode, warmup, work, rest, cooldown, rounds, intervals, activityType, runSpeeds, circuitData });
}

export function buildSessionFromDraft(
  mode: 'easy' | 'advanced' | 'circuit',
  name: string,
  easyConfig: { warmup: number; high: number; low: number; rounds: number; cooldown: number },
  intervals: Interval[],
  activityType: 'run' | 'spinning' | undefined,
  runSpeeds: RunSpeeds,
  existingId: string | undefined,
  circuitData?: { warmup: number; cooldown: number; circuits: number; circuitRest: number },
  spinValues?: SpinValues,
): Session {
  const base = { id: existingId ?? newId(), name };
  if (mode === 'circuit') {
    return {
      ...base,
      mode: 'circuit',
      intervals,
      circuits: circuitData!.circuits,
      warmup: circuitData!.warmup,
      cooldown: circuitData!.cooldown,
      circuitRest: circuitData!.circuitRest,
    };
  }
  const activityProps =
    activityType === 'run'      ? { activityType: 'run'      as const, runSpeeds } :
    activityType === 'spinning' ? { activityType: 'spinning' as const, spinValues } :
    {};
  if (mode === 'easy') {
    return { ...base, ...activityProps, mode: 'easy', config: easyConfig };
  }
  return { ...base, ...activityProps, mode: 'advanced', intervals };
}

export function validateDraft(
  name: string,
  mode: 'easy' | 'advanced' | 'circuit',
  intervals: { length: number },
  hasWorkInterval = true,
): { ok: true } | { ok: false; titleKey: string; messageKey: string } {
  if (!name.trim()) {
    return { ok: false, titleKey: 'alerts.nameRequiredTitle', messageKey: 'alerts.nameRequiredMessage' };
  }
  if (mode === 'advanced' && intervals.length === 0) {
    return { ok: false, titleKey: 'alerts.noIntervalsTitle', messageKey: 'alerts.noIntervalsMessage' };
  }
  if (mode === 'circuit' && !hasWorkInterval) {
    return { ok: false, titleKey: 'alerts.noWorkIntervalsTitle', messageKey: 'alerts.noWorkIntervalsMessage' };
  }
  return { ok: true };
}
