import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/auth-context';
import { UserAvatar } from '@/components/user-avatar';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { getUserProfile } from '@/utils/auth';

export default function ProfileScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { user, signOut, authErrorKey } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;
  const profile = getUserProfile(user);
  async function logout() {
    if (busy) return;
    setBusy(true); setError(null);
    try { await signOut(); }
    catch (cause) { setError(authErrorKey(cause)); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} disabled={busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/more')} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable><Text accessibilityRole="header" style={styles.title}>{t('auth.profile')}</Text></View>
    <View style={styles.identity}><UserAvatar key={profile.avatarUrl} url={profile.avatarUrl} size={88} /><Text style={styles.name}>{profile.name || t('auth.user')}</Text><Text style={styles.email}>{profile.email}</Text></View>
    <View style={styles.row}><Text style={styles.label}>{t('auth.email')}</Text><Text style={styles.value}>{profile.email}</Text></View>
    <View style={styles.row}><Text style={styles.label}>{t('auth.provider')}</Text><Text style={styles.value}>{t(`auth.provider.${profile.provider}`)}</Text></View>
    {error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void logout()} style={[styles.logout, busy && styles.disabled]}>
      {busy ? <ActivityIndicator color={colors.danger} /> : <><Ionicons name="log-out-outline" size={22} color={colors.danger} /><Text style={styles.logoutText}>{t('auth.signOut')}</Text></>}
    </Pressable>
  </ScrollView></SafeAreaView>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 24, gap: 24 },
  header: { flexDirection: 'row', gap: 16, alignItems: 'center' }, back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.text, fontSize: 26, fontWeight: '700' }, identity: { alignItems: 'center', gap: 14, paddingVertical: 24 },
  name: { color: colors.text, fontSize: 24, fontWeight: '700', textAlign: 'center' }, email: { color: colors.secondary, fontSize: 14, textAlign: 'center' },
  row: { gap: 8, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border }, label: { color: colors.secondary, fontSize: 13 }, value: { color: colors.text, fontSize: 16 },
  logout: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 16 },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '600' }, error: { color: colors.danger, fontSize: 14, lineHeight: 21 }, disabled: { opacity: 0.5 },
});
