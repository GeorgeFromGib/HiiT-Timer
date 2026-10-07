import { useCallback, useState } from 'react';
import type { Session } from './lib/sessions';

export type Route =
  | { name: 'Folders' }
  | { name: 'Sessions'; folderId?: string }
  | { name: 'Workout'; session: Session; initialResumeElapsed?: number; initialStatus?: 'running' | 'paused' }
  | { name: 'EditSession'; session?: Session; activityType?: 'general' | 'run' | 'circuit' | 'spinning' | 'tabata'; folderId?: string }
  | { name: 'Settings' }
  | { name: 'History' }
  | { name: 'PrivacyPolicy' };

export interface NavigationStack {
  route:    Route;
  navigate: (next: Route) => void;
  goBack:   () => void;
  resetTo:  (next: Route) => void;
}

// Owns the app's actual back-stack semantics, so screens go through one place for
// "go forward" (navigate) and "go back" (goBack) instead of each caller
// reimplementing history tracking. A real stack — unlike a single "previous route"
// slot — correctly remembers more than one hop: Sessions -> EditSession -> Workout
// -> back -> back lands back on Sessions, not wherever a single slot last pointed.
// resetTo replaces the whole stack — for one-shot initial-screen decisions (e.g.
// "which screen to land on once settings/onboarding finish loading") that aren't
// forward navigation and shouldn't leave the previous root reachable via back.
export function useNavigationStack(initialRoute: Route): NavigationStack {
  const [stack, setStack] = useState<Route[]>([initialRoute]);

  const navigate = useCallback((next: Route) => {
    setStack(s => [...s, next]);
  }, []);

  const goBack = useCallback(() => {
    setStack(s => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const resetTo = useCallback((next: Route) => {
    setStack([next]);
  }, []);

  return { route: stack[stack.length - 1], navigate, goBack, resetTo };
}

export type Tab = 'home' | 'history' | 'settings';

// Which bottom tab a route belongs to; null = detail/full-screen route (bar hidden).
export function tabForRoute(route: Route): Tab | null {
  switch (route.name) {
    case 'Folders':
    case 'Sessions': return 'home';
    case 'History':  return 'history';
    case 'Settings': return 'settings';
    default:         return null;
  }
}

export function routeForTab(tab: Tab, hideFolders: boolean): Route {
  if (tab === 'home') return hideFolders ? { name: 'Sessions' } : { name: 'Folders' };
  return tab === 'history' ? { name: 'History' } : { name: 'Settings' };
}
