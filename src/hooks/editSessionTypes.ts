import { type Interval } from '../lib/workout';
import { type Session } from '../lib/sessions';

export type LocalInterval = Interval & { _key: string };

export const toLocal = (iv: Interval): LocalInterval =>
  ({ ...iv, _key: Math.random().toString(36).slice(2) });

export type TimeField = 'warmup' | 'work' | 'rest' | 'cooldown';

export type SavePayload =
  | { ok: true; session: Session; isNew: boolean }
  | { ok: false; titleKey: string; messageKey: string };
