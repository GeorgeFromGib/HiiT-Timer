import { File, Paths } from 'expo-file-system';
import type { Interval, Segment, WorkoutConfig, Phase } from './workout';
import { expandWorkout, intervalsToSegments, expandCircuit } from './workout';
import { i18n, type Language } from './i18n';

export interface RunSpeeds {
  warmupSpeed: number;
  workSpeed: number;
  restSpeed: number;
  cooldownSpeed: number;
}

export const DEFAULT_RUN_SPEEDS: RunSpeeds = {
  warmupSpeed: 5,
  workSpeed: 8,
  restSpeed: 5,
  cooldownSpeed: 4.5,
};

export interface SpinValues {
  warmupResistance:   number;
  warmupPower:        number;
  workResistance:     number;
  workPower:          number;
  restResistance:     number;
  restPower:          number;
  cooldownResistance: number;
  cooldownPower:      number;
}

export const DEFAULT_SPIN_VALUES: SpinValues = {
  warmupResistance:   3,  warmupPower:   100,
  workResistance:     7,  workPower:     200,
  restResistance:     3,  restPower:     100,
  cooldownResistance: 2,  cooldownPower: 80,
};

export function spinValueForPhase(phase: Phase, values: SpinValues): { resistance: number; power: number } {
  const map: Record<Phase, { resistance: number; power: number }> = {
    warmup:      { resistance: values.warmupResistance,   power: values.warmupPower   },
    work:        { resistance: values.workResistance,     power: values.workPower     },
    rest:        { resistance: values.restResistance,     power: values.restPower     },
    cooldown:    { resistance: values.cooldownResistance, power: values.cooldownPower },
    circuitRest: { resistance: values.restResistance,     power: values.restPower     },
  };
  return map[phase];
}

export type Session =
  | { id: string; name: string; activityType?: 'run' | 'spinning'; runSpeeds?: RunSpeeds; spinValues?: SpinValues; mode: 'easy'; config: WorkoutConfig }
  | { id: string; name: string; activityType?: 'run' | 'spinning'; runSpeeds?: RunSpeeds; spinValues?: SpinValues; mode: 'advanced'; intervals: Interval[] }
  | { id: string; name: string; mode: 'circuit'; intervals: Interval[]; circuits: number; warmup: number; cooldown: number; circuitRest: number };

export function speedForPhase(phase: Phase, speeds: RunSpeeds): number {
  const map: Record<Phase, number> = {
    warmup:      speeds.warmupSpeed,
    work:        speeds.workSpeed,
    rest:        speeds.restSpeed,
    cooldown:    speeds.cooldownSpeed,
    circuitRest: speeds.restSpeed,
  };
  return map[phase];
}

export function getSessionSegments(session: Session): Segment[] {
  if (session.mode === 'circuit') {
    return expandCircuit(session.intervals, session.circuits, session.warmup, session.cooldown, session.circuitRest);
  }
  const base = session.mode === 'advanced'
    ? intervalsToSegments(session.intervals)
    : expandWorkout(session.config);
  if (session.activityType === 'run' && session.runSpeeds) {
    if (session.mode === 'advanced') {
      return base.map((seg, i) => ({
        ...seg,
        speed: session.intervals[i].speed ?? speedForPhase(seg.phase, session.runSpeeds!),
      }));
    }
    return base.map(seg => ({ ...seg, speed: speedForPhase(seg.phase, session.runSpeeds!) }));
  }
  if (session.activityType === 'spinning') {
    const sv = session.spinValues ?? DEFAULT_SPIN_VALUES;
    if (session.mode === 'advanced') {
      return base.map((seg, i) => {
        const defaults = spinValueForPhase(seg.phase, sv);
        return {
          ...seg,
          resistance: session.intervals[i].resistance ?? defaults.resistance,
          power:      session.intervals[i].power      ?? defaults.power,
        };
      });
    }
    return base.map(seg => {
      const { resistance, power } = spinValueForPhase(seg.phase, sv);
      return { ...seg, resistance, power };
    });
  }
  return base;
}

const sessionsFile = () => new File(Paths.document, 'sessions_v2.json');

export function getDefaultSessions(language: Language = 'en'): Session[] {
  const locale = language;
  return [
    {
      id: 'default-1',
      name: i18n.t('defaultSessions.example1', { locale }),
      mode: 'easy',
      config: { warmup: 45, high: 20, low: 10, rounds: 8, cooldown: 60 },
    },
    {
      id: 'default-2',
      name: i18n.t('defaultSessions.example2', { locale }),
      mode: 'advanced',
      intervals: [
        { type: 'warmup',   dur: 20 },
        { type: 'work',     dur: 20 },
        { type: 'rest',     dur: 10 },
        { type: 'work',     dur: 30 },
        { type: 'rest',     dur: 15 },
        { type: 'work',     dur: 20 },
        { type: 'rest',     dur: 10 },
        { type: 'cooldown', dur: 30 },
      ],
    },
    {
      id: 'default-run-2',
      name: i18n.t('defaultSessions.example3', { locale }),
      mode: 'easy',
      activityType: 'run',
      config: { warmup: 300, high: 30, low: 90, rounds: 6, cooldown: 300 },
      runSpeeds: { warmupSpeed: 7, workSpeed: 11, restSpeed: 6, cooldownSpeed: 5.5 },
    },
    {
      id: 'default-circuit-1',
      name: i18n.t('defaultSessions.circuit1', { locale }),
      mode: 'circuit',
      circuits: 3,
      warmup: 60,
      cooldown: 60,
      circuitRest: 30,
      intervals: [
        { type: 'work', dur: 40, activityLabel: 'Push-ups' },
        { type: 'rest', dur: 20 },
        { type: 'work', dur: 40, activityLabel: 'Squats' },
        { type: 'rest', dur: 20 },
        { type: 'work', dur: 40, activityLabel: 'Plank' },
        { type: 'rest', dur: 20 },
      ],
    },
    {
      id: 'default-spinning-1',
      name: i18n.t('defaultSessions.spinning1', { locale }),
      mode: 'easy',
      activityType: 'spinning',
      config: { warmup: 60, high: 30, low: 20, rounds: 6, cooldown: 60 },
      spinValues: DEFAULT_SPIN_VALUES,
    },
  ];
}

export async function loadSessions(language: Language = 'en'): Promise<Session[]> {
  try {
    const f = sessionsFile();
    if (!f.exists) return getDefaultSessions(language);
    const raw = await f.text();
    return JSON.parse(raw) as Session[];
  } catch {
    return getDefaultSessions(language);
  }
}

export async function saveSessions(sessions: Session[]): Promise<void> {
  try {
    sessionsFile().write(JSON.stringify(sessions));
  } catch {}
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function deleteSessionById(id: string): Promise<Session[]> {
  const sessions = await loadSessions();
  const next = sessions.filter(s => s.id !== id);
  await saveSessions(next);
  return next;
}
