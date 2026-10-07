import type { HistoryEntry } from './history';

export type StatsRange = 'week' | 'month' | 'all';

const RANGE_DAYS: Record<StatsRange, number> = { week: 7, month: 30, all: Infinity };

/** Whole local calendar days since the epoch — DST-safe, unlike dividing ms by 86.4M. */
export function localDayNumber(ms: number): number {
  const d = new Date(ms);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

function completedDays(entries: HistoryEntry[]): Set<number> {
  return new Set(entries.filter(e => e.completed).map(e => localDayNumber(e.startedAt)));
}

/** Consecutive local days with a completed run, ending today — or yesterday if today isn't trained yet. */
export function currentStreak(entries: HistoryEntry[], now: number = Date.now()): number {
  const days = completedDays(entries);
  const today = localDayNumber(now);
  let d = days.has(today) ? today : today - 1;
  let n = 0;
  while (days.has(d)) { n++; d--; }
  return n;
}

export function longestStreak(entries: HistoryEntry[]): number {
  const days = [...completedDays(entries)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && d === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

export function entriesInRange(entries: HistoryEntry[], range: StatsRange, now: number = Date.now()): HistoryEntry[] {
  const today = localDayNumber(now);
  return entries.filter(e => today - localDayNumber(e.startedAt) < RANGE_DAYS[range]);
}

/** Completed-workout count and active time (abandoned runs count toward time, not workouts). */
export function totals(entries: HistoryEntry[], range: StatsRange, now: number = Date.now()): { count: number; activeSecs: number } {
  const es = entriesInRange(entries, range, now);
  return {
    count: es.filter(e => e.completed).length,
    activeSecs: es.reduce((sum, e) => sum + e.activeSecs, 0),
  };
}

/** Whole-number % of logged runs that were completed; 0 when there are none. */
export function completionRate(entries: HistoryEntry[]): number {
  if (!entries.length) return 0;
  return Math.round((entries.filter(e => e.completed).length / entries.length) * 100);
}
