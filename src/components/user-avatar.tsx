import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { useAppTheme } from '@/theme/theme-context';

export function UserAvatar({ url, size = 48 }: { url: string | null; size?: number }) {
  const { colors } = useAppTheme();
  const [failed, setFailed] = useState(false);
  return url && !failed ? <Image source={{ uri: url }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person-outline" size={size * 0.45} color={colors.accent} /></View>;
}
