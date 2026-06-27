import type { Session } from './lib/sessions';

export type Route =
  | { name: 'Sessions' }
  | { name: 'Workout'; session: Session }
  | { name: 'EditSession'; session?: Session; activityType?: 'general' | 'run' | 'circuit' | 'spinning' }
  | { name: 'Settings' }
  | { name: 'PrivacyPolicy' };
