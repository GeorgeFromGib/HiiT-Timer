import { newId, type Session, type RunSpeeds } from './sessions';
import { type Interval } from './workout';

export function serializeDraft(
  name: string,
  mode: 'easy' | 'advanced',
  warmup: number, work: number, rest: number, cooldown: number, rounds: number,
  intervals: Array<Omit<Interval, never>>,
  activityType: 'run' | undefined,
  runSpeeds: RunSpeeds,
): string {
  return JSON.stringify({ name, mode, warmup, work, rest, cooldown, rounds, intervals, activityType, runSpeeds });
}

export function buildSessionFromDraft(
  mode: 'easy' | 'advanced',
  name: string,
  easyConfig: { warmup: number; high: number; low: number; rounds: number; cooldown: number },
  intervals: Interval[],
  activityType: 'run' | undefined,
  runSpeeds: RunSpeeds,
  existingId: string | undefined,
): Session {
  const base = { id: existingId ?? newId(), name };
  const speedProps = activityType === 'run'
    ? { activityType: 'run' as const, runSpeeds }
    : {};
  if (mode === 'easy') {
    return { ...base, ...speedProps, mode: 'easy', config: easyConfig };
  }
  return { ...base, ...speedProps, mode: 'advanced', intervals };
}

export function validateDraft(
  name: string,
  mode: 'easy' | 'advanced',
  intervals: { length: number },
): { ok: true } | { ok: false; titleKey: string; messageKey: string } {
  if (!name.trim()) {
    return { ok: false, titleKey: 'alerts.nameRequiredTitle', messageKey: 'alerts.nameRequiredMessage' };
  }
  if (mode === 'advanced' && intervals.length === 0) {
    return { ok: false, titleKey: 'alerts.noIntervalsTitle', messageKey: 'alerts.noIntervalsMessage' };
  }
  return { ok: true };
}
