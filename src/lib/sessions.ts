import { File, Paths } from 'expo-file-system';
import type { Interval, Segment, WorkoutConfig } from './workout';
import { expandWorkout, intervalsToSegments } from './workout';

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

export type Session = {
  id: string;
  name: string;
  activityType?: 'run';
  runSpeeds?: RunSpeeds;
} & (
  | { mode: 'easy'; config: WorkoutConfig }
  | { mode: 'advanced'; intervals: Interval[] }
);

export function getSessionSegments(session: Session): Segment[] {
  if (session.mode === 'advanced') return intervalsToSegments(session.intervals);
  return expandWorkout(session.config);
}

const sessionsFile = () => new File(Paths.document, 'sessions_v2.json');

export const DEFAULT_SESSIONS: Session[] = [
  {
    id: 'default-1',
    name: 'Tabata Burnout',
    mode: 'easy',
    config: { warmup: 45, high: 20, low: 10, rounds: 8, cooldown: 60 },
  },
  {
    id: 'default-2',
    name: 'Quick HiiT',
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
];

export async function loadSessions(): Promise<Session[]> {
  try {
    const f = sessionsFile();
    if (!f.exists) return DEFAULT_SESSIONS;
    const raw = await f.text();
    return JSON.parse(raw) as Session[];
  } catch {
    return DEFAULT_SESSIONS;
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
