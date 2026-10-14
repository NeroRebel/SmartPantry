import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/theme-context';
import { getAvatarInitials } from '@/utils/auth';

export function UserAvatar({ url, name = '', size = 48 }: { url: string | null; name?: string; size?: number }) {
  const { colors } = useAppTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = getAvatarInitials(name);
  return url && failedUrl !== url ? <Image accessible={false} source={{ uri: url }} onError={() => setFailedUrl(url)} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>{initials ? <Text style={{ color: colors.accent, fontSize: size * 0.32, fontWeight: '700' }}>{initials}</Text> : <Ionicons name="person-outline" size={size * 0.45} color={colors.accent} />}</View>;
}
