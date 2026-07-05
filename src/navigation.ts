import type { Session } from './lib/sessions';

export type Route =
  | { name: 'Sessions' }
  | { name: 'Folders' }
  | { name: 'Workout'; session: Session }
  | { name: 'EditSession'; session?: Session; activityType?: 'general' | 'run' | 'circuit' | 'spinning'; folderId?: string }
  | { name: 'Settings' }
  | { name: 'PrivacyPolicy' };
