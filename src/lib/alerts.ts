import { Alert } from 'react-native';

export function confirmDeleteSession(name: string, onConfirm: () => void) {
  Alert.alert('Delete Session', `Remove "${name}"?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}
