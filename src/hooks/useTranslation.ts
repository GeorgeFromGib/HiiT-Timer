import { useCallback } from 'react';
import { i18n } from '../lib/i18n';
import { useSettings } from '../lib/settingsContext';

export function useTranslation() {
  const { settings } = useSettings();
  const locale = settings.language;
  const t = useCallback(
    (scope: string, opts?: object) => i18n.t(scope, { locale, ...opts }),
    [locale],
  );
  return { t, locale };
}
