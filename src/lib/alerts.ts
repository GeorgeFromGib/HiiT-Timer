import { Alert } from 'react-native';
import { i18n } from './i18n';

export function confirmDeleteSession(name: string, onConfirm: () => void, onCancel?: () => void) {
  Alert.alert(
    i18n.t('sessions.deleteTitle'),
    i18n.t('sessions.deleteMessage', { name }),
    [
      { text: i18n.t('common.cancel'), style: 'cancel', onPress: onCancel },
      { text: i18n.t('common.delete'), style: 'destructive', onPress: onConfirm },
    ],
  );
}
