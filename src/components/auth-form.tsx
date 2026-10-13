import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/auth-context';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { validateCredentials } from '@/utils/auth';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const signup = mode === 'sign-up';
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const auth = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const locked = useRef(false);
  const disabled = !!busy || !auth.configured;

  async function submit() {
    if (locked.current || !auth.configured) return;
    setNotice(null);
    const validation = validateCredentials(email, password, signup ? { name, confirmPassword: confirm } : undefined);
    if (validation) { setError(validation); return; }
    locked.current = true; setBusy('email'); setError(null);
    try {
      if (signup) {
        const confirmationRequired = await auth.signUp(name, email, password);
        if (confirmationRequired) { setNotice('auth.checkEmail'); setPassword(''); setConfirm(''); }
      } else await auth.signIn(email, password);
    } catch (cause) { setError(auth.authErrorKey(cause)); }
    finally { locked.current = false; setBusy(null); }
  }

  async function google() {
    if (locked.current || !auth.configured) return;
    locked.current = true; setBusy('google'); setError(null); setNotice(null);
    try {
      const result = await auth.signInWithGoogle();
      if (result === 'cancelled') setNotice('auth.googleCancelled');
    } catch (cause) { setError(auth.authErrorKey(cause)); }
    finally { locked.current = false; setBusy(null); }
  }

  return <SafeAreaView style={styles.screen}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.brand}><View style={styles.brandIcon}><Ionicons name="leaf-outline" size={30} color={colors.accent} /></View><Text style={styles.brandName}>SmartPantry</Text></View>
        <Text accessibilityRole="header" style={styles.title}>{t(signup ? 'auth.createAccount' : 'auth.signIn')}</Text>
        {!auth.configured && <Text accessibilityRole="alert" style={styles.error}>{t('auth.unavailable')}</Text>}
        {auth.restoreError && <View style={styles.feedback}><Text style={styles.error}>{t(auth.restoreError)}</Text><Pressable accessibilityRole="button" onPress={auth.retryRestore}><Text style={styles.link}>{t('common.retry')}</Text></Pressable></View>}
        {signup && <View style={styles.field}><Text style={styles.label}>{t('auth.name')}</Text><TextInput accessibilityLabel={t('auth.name')} value={name} onChangeText={setName} editable={!busy} autoComplete="name" textContentType="name" maxLength={80} style={styles.input} selectionColor={colors.accent} /></View>}
        <View style={styles.field}><Text style={styles.label}>{t('auth.email')}</Text><TextInput accessibilityLabel={t('auth.email')} value={email} onChangeText={setEmail} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" maxLength={254} style={styles.input} selectionColor={colors.accent} /></View>
        <View style={styles.field}><Text style={styles.label}>{t('auth.password')}</Text><View style={styles.passwordField}>
          <TextInput accessibilityLabel={t('auth.password')} value={password} onChangeText={setPassword} editable={!busy} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete={signup ? 'new-password' : 'current-password'} textContentType={signup ? 'newPassword' : 'password'} style={styles.passwordInput} selectionColor={colors.accent} />
          <Pressable accessibilityRole="button" accessibilityLabel={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')} disabled={!!busy} onPress={() => setShowPassword((current) => !current)} style={styles.eye}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.secondary} /></Pressable>
        </View></View>
        {signup && <View style={styles.field}><Text style={styles.label}>{t('auth.confirmPassword')}</Text><TextInput accessibilityLabel={t('auth.confirmPassword')} value={confirm} onChangeText={setConfirm} editable={!busy} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" style={styles.input} selectionColor={colors.accent} /></View>}
        {error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
        {notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{t(notice)}</Text>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: busy === 'email' }} disabled={disabled} onPress={() => void submit()} style={[styles.primary, disabled && styles.disabled]}>
          {busy === 'email' ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryText}>{t(signup ? 'auth.createAccount' : 'auth.signIn')}</Text>}
        </Pressable>
        <View style={styles.divider}><View style={styles.line} /><Text style={styles.secondary}>{t('auth.orContinue')}</Text><View style={styles.line} /></View>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: busy === 'google' }} disabled={disabled} onPress={() => void google()} style={[styles.google, disabled && styles.disabled]}>
          {busy === 'google' ? <ActivityIndicator color={colors.accent} /> : <><Ionicons name="logo-google" size={21} color={colors.text} /><Text style={styles.googleText}>{t('auth.google')}</Text></>}
        </Pressable>
        <View style={styles.switchMode}><Text style={styles.secondary}>{t(signup ? 'auth.haveAccount' : 'auth.noAccount')}</Text>
          <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => router.replace(signup ? '/(auth)/sign-in' : '/(auth)/sign-up')}><Text style={styles.link}>{t(signup ? 'auth.signIn' : 'auth.signUp')}</Text></Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 480, alignSelf: 'center', padding: 24, paddingVertical: 36, gap: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  brandIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: colors.accentSoft, justifyContent: 'center', alignItems: 'center' },
  brandName: { flex: 1, color: colors.text, fontSize: 30, fontWeight: '700' },
  title: { color: colors.text, fontSize: 24, fontWeight: '600', marginBottom: 6 },
  field: { gap: 8 }, label: { color: colors.secondary, fontSize: 14 },
  input: { minHeight: 54, borderRadius: 14, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 16 },
  passwordField: { minHeight: 54, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  passwordInput: { flex: 1, minWidth: 0, padding: 16, fontSize: 16, color: colors.text },
  eye: { width: 48, height: 50, alignItems: 'center', justifyContent: 'center' },
  primary: { minHeight: 56, borderRadius: 14, padding: 16, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.onAccent, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.5 }, error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
  notice: { color: colors.success, fontSize: 14, lineHeight: 21 }, feedback: { gap: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 }, line: { flex: 1, height: 1, backgroundColor: colors.border },
  secondary: { color: colors.secondary, fontSize: 13, lineHeight: 20, textAlign: 'center', flexShrink: 1 },
  google: { minHeight: 56, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  googleText: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  switchMode: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '600', paddingVertical: 6 },
});
