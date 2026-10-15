import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/auth-context';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { isValidVerificationEmail, resendSecondsRemaining } from '@/utils/email-verification';

export default function CheckEmailScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const auth = useAuth();
  const [email, setEmail] = useState(auth.pendingVerification?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const locked = useRef(false);
  const deadline = auth.pendingVerification?.resendAvailableAt ?? 0;
  const remaining = resendSecondsRemaining(deadline, now);
  const disabled = !!busy || !auth.configured;
  const verificationEmail = auth.pendingVerification?.email ?? email;
  const validEmail = isValidVerificationEmail(verificationEmail);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function resend() {
    if (locked.current || disabled || !validEmail || resendSecondsRemaining(deadline) > 0) return;
    locked.current = true; setBusy(true); setError(null); setResent(false);
    try {
      if (await auth.resendConfirmationEmail(verificationEmail)) { setResent(true); setNow(Date.now()); }
    } catch (cause) { setError(auth.authErrorKey(cause)); }
    finally { locked.current = false; setBusy(false); }
  }

  return <SafeAreaView style={styles.screen}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.brand}><View style={styles.brandIcon}><Ionicons name="leaf-outline" size={30} color={colors.accent} /></View><Text style={styles.brandName}>SmartPantry</Text></View>
        <Text accessibilityRole="header" style={styles.title}>{t('confirmation.title')}</Text>
        <Text style={styles.body}>{t(auth.pendingVerification ? 'confirmation.sent' : 'confirmation.enterEmail')}</Text>
        <View style={styles.field}>
          <Text style={styles.label}>{t('auth.email')}</Text>
          {auth.pendingVerification ? <Text selectable style={styles.email}>{verificationEmail}</Text> :
            <TextInput accessibilityLabel={t('auth.email')} value={email} onChangeText={(value) => { setEmail(value); setError(null); }} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" maxLength={254} selectionColor={colors.accent} style={styles.input} />}
        </View>
        <Text style={styles.body}>{t('confirmation.finish')}</Text>
        {Platform.OS !== 'web' && <Text style={styles.body}>{t('confirmation.desktopHelp')}</Text>}
        {!auth.configured && <Text accessibilityRole="alert" style={styles.error}>{t('auth.unavailable')}</Text>}
        {error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
        {resent && <Text accessibilityLiveRegion="polite" style={styles.success}>{t('confirmation.resent')}</Text>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || !validEmail || remaining > 0, busy }} disabled={disabled || !validEmail || remaining > 0} onPress={() => void resend()} style={[styles.secondaryButton, (disabled || !validEmail || remaining > 0) && styles.disabled]}>
          {busy ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.link}>{remaining > 0 ? t('confirmation.resendIn', { count: remaining }) : t('confirmation.resend')}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.replace('/(auth)/sign-in')} style={styles.primary}><Text style={styles.primaryText}>{t('confirmation.back')}</Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 480, alignSelf: 'center', padding: 24, paddingVertical: 36, gap: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }, brandIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: colors.accentSoft, justifyContent: 'center', alignItems: 'center' },
  brandName: { flex: 1, color: colors.text, fontSize: 30, fontWeight: '700' }, title: { color: colors.text, fontSize: 24, fontWeight: '600' },
  body: { color: colors.secondary, fontSize: 14, lineHeight: 21 }, field: { gap: 8 }, label: { color: colors.secondary, fontSize: 14 }, email: { color: colors.text, fontSize: 16 },
  input: { minHeight: 54, borderRadius: 14, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 16 },
  primary: { minHeight: 56, borderRadius: 14, padding: 16, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: colors.onAccent, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 12 }, link: { color: colors.accent, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.5 }, error: { color: colors.danger, fontSize: 14, lineHeight: 21 }, success: { color: colors.success, fontSize: 14, lineHeight: 21 },
});
