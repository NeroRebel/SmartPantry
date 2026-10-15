import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/theme-context';
import { getAvatarInitials } from '@/utils/auth';
import { useAuth } from '@/auth/auth-context';

export function UserAvatar({ url, name = '', size = 48 }: { url: string | null; name?: string; size?: number }) {
  const { colors } = useAppTheme();
  const { avatarUrl } = useAuth();
  const sources = [...new Set([avatarUrl, url].filter((value): value is string => !!value))];
  const key = sources.join('|');
  const [failures, setFailures] = useState<{ key: string; urls: string[] } | null>(null);
  const failed = failures?.key === key ? failures.urls : [];
  const imageUrl = sources.find((value) => !failed.includes(value));
  const initials = getAvatarInitials(name);
  return imageUrl ? <Image accessible={false} source={{ uri: imageUrl }} onError={() => setFailures((current) => ({ key, urls: [...(current?.key === key ? current.urls : []), imageUrl] }))} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>{initials ? <Text style={{ color: colors.accent, fontSize: size * 0.32, fontWeight: '700' }}>{initials}</Text> : <Ionicons name="person-outline" size={size * 0.45} color={colors.accent} />}</View>;
}
