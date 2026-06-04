import { File, Paths } from 'expo-file-system';
import type { WorkoutConfig } from './workout';

export type Category = 'HIIT' | 'Express' | 'Steady';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Session {
  id: string;
  name: string;
  category: Category;
  difficulty: Difficulty;
  config: WorkoutConfig;
}

const sessionsFile = () => new File(Paths.document, 'sessions_v1.json');

export const DEFAULT_SESSIONS: Session[] = [
  {
    id: 'default-1',
    name: 'Tabata Burnout',
    category: 'HIIT',
    difficulty: 'Hard',
    config: { warmup: 45, high: 30, low: 15, rounds: 4, cooldown: 60 },
  },
  {
    id: 'default-2',
    name: 'Quick Express',
    category: 'Express',
    difficulty: 'Medium',
    config: { warmup: 20, high: 20, low: 10, rounds: 3, cooldown: 30 },
  },
  {
    id: 'default-3',
    name: 'Steady Burn',
    category: 'Steady',
    difficulty: 'Easy',
    config: { warmup: 60, high: 45, low: 30, rounds: 3, cooldown: 60 },
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
