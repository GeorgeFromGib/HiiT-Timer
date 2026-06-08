import { Alert } from 'react-native';

export function confirmDeleteSession(name: string, onConfirm: () => void, onCancel?: () => void) {
  Alert.alert('Delete Session', `Remove "${name}"?`, [
    { text: 'Cancel', style: 'cancel', onPress: onCancel },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}
