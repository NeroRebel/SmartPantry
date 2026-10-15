import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/auth-context';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { isValidVerificationEmail } from '@/utils/email-verification';

export default function ForgotPasswordScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const availableAt = useRef(0);
  const locked = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.max(0, Math.ceil((availableAt.current - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, []);
  async function submit() {
    if (locked.current || availableAt.current > Date.now()) return;
    if (!isValidVerificationEmail(email)) { setError('auth.invalidEmail'); return; }
    locked.current = true; setBusy(true); setError(null);
    try { await auth.sendPasswordReset(email); setSent(true); availableAt.current = Date.now() + 60000; setSeconds(60); }
    catch (cause) { setError(auth.authErrorKey(cause)); }
    finally { locked.current = false; setBusy(false); }
  }
  const disabled = busy || seconds > 0 || !auth.configured;
  return <SafeAreaView style={styles.screen}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={styles.brand}>SmartPantry</Text><Text accessibilityRole="header" style={styles.title}>{t('password.forgotTitle')}</Text>
      <Text style={styles.label}>{t('password.emailHelp')}</Text>
      <TextInput accessibilityLabel={t('auth.email')} placeholder={t('auth.email')} placeholderTextColor={colors.secondary} value={email} onChangeText={(value) => { setEmail(value); setSent(false); }} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" maxLength={254} selectionColor={colors.accent} style={styles.input} />
      {sent && <Text accessibilityLiveRegion="polite" style={styles.success}>{t('password.sent')}</Text>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy }} disabled={disabled} onPress={() => void submit()} style={[styles.primary, disabled && styles.disabled]}>{busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryText}>{seconds ? t('confirmation.resendIn', { count: seconds }) : t('password.sendLink')}</Text>}</Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.replace('/(auth)/sign-in')}><Text style={styles.link}>{t('password.backSignIn')}</Text></Pressable>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 480, alignSelf: 'center', padding: 24, gap: 20 },
  brand: { color: colors.text, fontSize: 30, fontWeight: '700' }, title: { color: colors.text, fontSize: 24, fontWeight: '600' }, label: { color: colors.secondary, fontSize: 15, lineHeight: 22 },
  input: { minHeight: 54, padding: 16, borderWidth: 1, borderRadius: 14, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 16 },
  primary: { minHeight: 56, padding: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentFill }, primaryText: { color: colors.onAccent, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  success: { color: colors.success, fontSize: 14, lineHeight: 22 }, error: { color: colors.danger, fontSize: 14, lineHeight: 22 }, link: { color: colors.accent, paddingVertical: 10, fontSize: 14, fontWeight: '600' }, disabled: { opacity: 0.5 },
});
