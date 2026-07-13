import { i18n } from './i18n';
import { appAlert } from './appAlert';

export function confirmDeleteSession(name: string, onConfirm: () => void, onCancel?: () => void) {
  appAlert(
    'warning',
    i18n.t('sessions.deleteTitle'),
    i18n.t('sessions.deleteMessage', { name }),
    [
      { text: i18n.t('common.cancel'), style: 'cancel', onPress: onCancel },
      { text: i18n.t('common.delete'), style: 'destructive', onPress: onConfirm },
    ],
  );
}
