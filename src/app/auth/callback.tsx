import * as Linking from 'expo-linking';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/auth-context';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';

export default function AuthCallbackScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { completeCallback, authErrorKey, signOut } = useAuth();
  const nativeUrl = Linking.useLinkingURL();
  const url = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : nativeUrl;
  const [result, setResult] = useState<{ url: string; status: 'confirmed' | 'email-changed' | 'error' | 'recovery' | 'authenticated'; error?: string } | null>(null);
  const [returnTo, setReturnTo] = useState<'/(auth)/sign-in' | '/(auth)/forgot-password' | null>(null);
  useEffect(() => {
    if (!url) return;
    let active = true;
    const timeout = setTimeout(() => { if (active) setResult({ url, status: 'error', error: 'auth.networkError' }); }, 15000);
    void completeCallback(url).then((status) => {
      if (active) setResult({ url, status });
    }).catch((cause) => { if (active) setResult({ url, status: 'error', error: authErrorKey(cause) }); }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); };
  }, [url, completeCallback, authErrorKey]);
  if (returnTo) return <Redirect href={returnTo} />;
  const current = result?.url === url ? result : null;
  if (current?.status === 'recovery') return <Redirect href="/(auth)/reset-password" />;
  if (current?.status === 'authenticated') return <Redirect href="/(tabs)" />;
  const confirmedWithoutSession = current?.status === 'confirmed' || current?.status === 'email-changed';
  const callbackError = current?.error ?? (!url ? 'auth.oauthError' : null);
  return <SafeAreaView style={styles.screen}><View style={styles.content}>
    {confirmedWithoutSession ? <Text accessibilityLiveRegion="polite" style={styles.success}>{t(current?.status === 'email-changed' ? 'account.emailCallback' : 'confirmation.confirmedSignIn')}</Text> : callbackError ? <Text accessibilityRole="alert" style={styles.error}>{t(callbackError)}</Text>
      : <><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.label}>{t('auth.completing')}</Text></>}
    <Text style={styles.label}>{t('confirmation.callbackHelp')}</Text>
    {callbackError && <Pressable accessibilityRole="button" onPress={() => { void signOut().then(() => setReturnTo('/(auth)/forgot-password')).catch(() => setResult({ url: url ?? '', status: 'error', error: 'auth.networkError' })); }} style={styles.button}><Text style={styles.buttonText}>{t('password.requestAnother')}</Text></Pressable>}
    <Pressable accessibilityRole="button" onPress={() => setReturnTo('/(auth)/sign-in')} style={styles.button}><Text style={styles.buttonText}>{t('auth.signIn')}</Text></Pressable>
  </View></SafeAreaView>;
}
const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 20 },
  label: { color: colors.secondary, textAlign: 'center' }, error: { color: colors.danger, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  success: { color: colors.success, textAlign: 'center', fontSize: 18, lineHeight: 26, fontWeight: '600' },
  button: { minHeight: 52, padding: 16, borderRadius: 14, backgroundColor: colors.surface }, buttonText: { color: colors.accent, fontWeight: '600' },
});
