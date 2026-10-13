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
  const { session, completeCallback, authErrorKey } = useAuth();
  const nativeUrl = Linking.useLinkingURL();
  const url = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : nativeUrl;
  const [error, setError] = useState<string | null>(null);
  const [returnToSignIn, setReturnToSignIn] = useState(false);
  useEffect(() => {
    if (session) return;
    if (!url) return;
    let active = true;
    void completeCallback(url).catch((cause) => { if (active) setError(authErrorKey(cause)); });
    return () => { active = false; };
  }, [url, session, completeCallback, authErrorKey]);
  if (session) return <Redirect href="/(tabs)" />;
  if (returnToSignIn) return <Redirect href="/(auth)/sign-in" />;
  const callbackError = error ?? (!url ? 'auth.oauthError' : null);
  return <SafeAreaView style={styles.screen}><View style={styles.content}>
    {callbackError ? <><Text style={styles.error}>{t(callbackError)}</Text><Pressable accessibilityRole="button" onPress={() => setReturnToSignIn(true)} style={styles.button}><Text style={styles.buttonText}>{t('auth.signIn')}</Text></Pressable></>
      : <><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.label}>{t('auth.completing')}</Text></>}
  </View></SafeAreaView>;
}
const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 20 },
  label: { color: colors.secondary, textAlign: 'center' }, error: { color: colors.danger, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  button: { minHeight: 52, padding: 16, borderRadius: 14, backgroundColor: colors.surface }, buttonText: { color: colors.accent, fontWeight: '600' },
});
