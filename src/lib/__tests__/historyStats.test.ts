import { currentStreak, longestStreak, totals, completionRate, localDayNumber } from '../historyStats';
import type { HistoryEntry } from '../history';

const NOW = new Date(2026, 9, 6, 15, 0).getTime(); // Tue 6 Oct 2026, local
const at = (daysAgo: number, hour = 9) => new Date(2026, 9, 6 - daysAgo, hour).getTime();
const e = (daysAgo: number, over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: `${daysAgo}-${over.completed}-${Math.random()}`, startedAt: at(daysAgo), sessionId: 's', sessionName: 'S',
  activityType: 'general', plannedSecs: 600, activeSecs: 600, rounds: 8, workSecs: 240, completed: true, source: 'phone', ...over,
});

describe('currentStreak', () => {
  it('is 0 for empty history', () => expect(currentStreak([], NOW)).toBe(0));
  it('counts consecutive days ending today', () => {
    expect(currentStreak([e(0), e(1), e(2)], NOW)).toBe(3);
  });
  it('keeps the streak alive when today is not trained yet', () => {
    expect(currentStreak([e(1), e(2)], NOW)).toBe(2);
  });
  it('resets after a gap of a full day', () => {
    expect(currentStreak([e(2), e(3)], NOW)).toBe(0);
  });
  it('counts two runs on one day once', () => {
    expect(currentStreak([e(0, { startedAt: at(0, 7) }), e(0, { startedAt: at(0, 20) }), e(1)], NOW)).toBe(2);
  });
  it('ignores abandoned runs', () => {
    expect(currentStreak([e(0, { completed: false }), e(1)], NOW)).toBe(1);
  });
  it('crosses the end of a month and a DST change', () => {
    const now = new Date(2026, 9, 26, 12).getTime(); // after EU DST end (25 Oct)
    const day = (n: number) => e(0, { startedAt: new Date(2026, 9, 26 - n, 8).getTime() });
    expect(currentStreak([day(0), day(1), day(2), day(3)], now)).toBe(4);
  });
});

describe('longestStreak', () => {
  it('is 0 for empty history', () => expect(longestStreak([])).toBe(0));
  it('finds the longest run across gaps', () => {
    expect(longestStreak([e(0), e(1), e(5), e(6), e(7), e(8), e(20)])).toBe(4);
  });
  it('ignores abandoned runs', () => {
    expect(longestStreak([e(0), e(1, { completed: false }), e(2)])).toBe(1);
  });
});

describe('totals', () => {
  const all = [e(0), e(3, { activeSecs: 300 }), e(10, { activeSecs: 120 }), e(40), e(1, { completed: false, activeSecs: 60 })];
  it('week covers the last 7 days including today', () => {
    expect(totals(all, 'week', NOW)).toEqual({ count: 2, activeSecs: 600 + 300 + 60 });
  });
  it('week excludes day 7', () => {
    expect(totals([e(6), e(7)], 'week', NOW).count).toBe(1);
  });
  it('month covers 30 days', () => {
    expect(totals(all, 'month', NOW).count).toBe(3);
  });
  it('all includes everything', () => {
    expect(totals(all, 'all', NOW)).toEqual({ count: 4, activeSecs: 600 + 300 + 120 + 600 + 60 });
  });
  it('is zero for empty history', () => {
    expect(totals([], 'all', NOW)).toEqual({ count: 0, activeSecs: 0 });
  });
});

describe('completionRate', () => {
  it('is 0 for empty history', () => expect(completionRate([])).toBe(0));
  it('counts abandoned runs against the rate', () => {
    expect(completionRate([e(0), e(1), e(2), e(3, { completed: false })])).toBe(75);
  });
});

describe('localDayNumber', () => {
  it('advances by exactly 1 across a DST day', () => {
    const a = localDayNumber(new Date(2026, 9, 24, 12).getTime());
    const b = localDayNumber(new Date(2026, 9, 25, 23, 30).getTime());
    const c = localDayNumber(new Date(2026, 9, 26, 0, 30).getTime());
    expect([b - a, c - b]).toEqual([1, 1]);
  });
});
