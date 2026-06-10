export const FREE_SESSION_LIMIT = 5;

export function canCreateSession(count: number, isPremium: boolean): boolean {
  if (isPremium) return true;
  return count < FREE_SESSION_LIMIT;
}
