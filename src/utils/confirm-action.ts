import { Alert, Platform } from 'react-native';

let pending = false;
export function confirmAction(options: {
  title: string; message: string; cancel: string; confirm: string;
  destructive?: boolean; onConfirm: () => void;
}) {
  if (pending) return;
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${options.title}\n\n${options.message}`)) options.onConfirm();
    return;
  }
  pending = true;
  const release = () => { pending = false; };
  Alert.alert(options.title, options.message, [
    { text: options.cancel, style: 'cancel', onPress: release },
    { text: options.confirm, style: options.destructive ? 'destructive' : 'default', onPress: () => { release(); options.onConfirm(); } },
  ], { cancelable: true, onDismiss: release });
}
