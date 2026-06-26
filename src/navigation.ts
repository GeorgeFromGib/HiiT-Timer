import type { Session } from './lib/sessions';

export type Route =
  | { name: 'Sessions' }
  | { name: 'Workout'; session: Session }
  | { name: 'EditSession'; session?: Session; newMode?: 'circuit' }
  | { name: 'Settings' }
  | { name: 'PrivacyPolicy' };
