import type { Session } from './sessions';

export type Route =
  | { name: 'Sessions' }
  | { name: 'Workout'; session: Session }
  | { name: 'EditSession'; session?: Session }
  | { name: 'Settings' };
