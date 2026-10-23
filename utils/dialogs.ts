import { Alert } from 'react-native';

/** "Are you sure?" popup for destructive actions. */
export function confirmDelete(title: string, message: string, onConfirm: () => void | Promise<void>) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void onConfirm() },
  ]);
}

/** Success popup that runs `then` when dismissed (e.g. go back to the list). */
export function notifySaved(message: string, then: () => void) {
  Alert.alert('Saved', message, [{ text: 'OK', onPress: then }], { onDismiss: then });
}
