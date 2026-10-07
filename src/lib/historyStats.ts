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

export interface HeatmapCell {
  daysAgo: number;
  mins:    number;
  level:   0 | 1 | 2 | 3 | 4;  // 0 = no activity
  future:  boolean;            // padding after today in the current week
}

// Active minutes → intensity level. ponytail: fixed thresholds; make relative to the user's own max if they feel off.
export function heatLevel(mins: number): HeatmapCell['level'] {
  if (mins <= 0) return 0;
  if (mins < 10) return 1;
  if (mins < 20) return 2;
  if (mins < 40) return 3;
  return 4;
}

/**
 * GitHub-style grid: `weeks` columns (oldest first), each Mon→Sun, the last column
 * being the current week. Intensity is total active minutes per local day
 * (abandoned runs included — it's effort, not completion).
 */
export function heatmapBuckets(entries: HistoryEntry[], weeks: number, now: number = Date.now()): HeatmapCell[][] {
  const today = localDayNumber(now);
  const mins = new Map<number, number>();
  for (const e of entries) {
    const ago = today - localDayNumber(e.startedAt);
    mins.set(ago, (mins.get(ago) ?? 0) + e.activeSecs / 60);
  }
  const todayDow = (new Date(now).getDay() + 6) % 7; // Mon = 0
  return Array.from({ length: weeks }, (_, col) => {
    const w = weeks - 1 - col;
    return Array.from({ length: 7 }, (_, dow) => {
      const daysAgo = w * 7 + (todayDow - dow);
      const future = daysAgo < 0;
      const m = future ? 0 : mins.get(daysAgo) ?? 0;
      return { daysAgo, mins: m, level: heatLevel(m), future };
    });
  });
}
