import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/auth-context';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { hasEmailIdentity, validateNewPassword } from '@/utils/auth';

export function PasswordForm({ recovery = false }: { recovery?: boolean }) {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [nonce, setNonce] = useState('');
  const [needsReauth, setNeedsReauth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reauthSeconds, setReauthSeconds] = useState(0);
  const reauthAvailableAt = useRef(0);
  const locked = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setReauthSeconds(Math.max(0, Math.ceil((reauthAvailableAt.current - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, []);

  async function submit() {
    if (locked.current) return;
    const validation = validateNewPassword(password, confirm);
    if (validation) { setError(validation); return; }
    if (needsReauth && !nonce.trim()) { setError('password.reauthInvalid'); return; }
    locked.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      await auth.updatePassword(password, confirm, nonce);
      setPassword(''); setConfirm(''); setNonce('');
      if (!recovery) setNotice('password.updated');
    } catch (cause) {
      const key = auth.authErrorKey(cause);
      if (key === 'password.reauthRequired' || key === 'password.reauthInvalid') setNeedsReauth(true);
      setError(key);
    } finally { locked.current = false; setBusy(false); }
  }

  async function sendReauth() {
    if (locked.current || Date.now() < reauthAvailableAt.current) return;
    locked.current = true; setBusy(true); setError(null);
    try { await auth.reauthenticate(); reauthAvailableAt.current = Date.now() + 60000; setReauthSeconds(60); setNotice('password.reauthSent'); }
    catch (cause) { setError(auth.authErrorKey(cause)); }
    finally { locked.current = false; setBusy(false); }
  }

  async function leave(target: '/(auth)/sign-in' | '/(auth)/forgot-password') {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try { if (auth.session) await auth.signOut(); router.replace(target); }
    catch (cause) { setError(auth.authErrorKey(cause)); }
    finally { locked.current = false; setBusy(false); }
  }

  if (!recovery && !auth.user) return <Redirect href="/(auth)/sign-in" />;
  const valid = recovery ? auth.recovering && !!auth.session : hasEmailIdentity(auth.user);
  return <SafeAreaView style={styles.screen}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={styles.brand}>SmartPantry</Text>
      <Text accessibilityRole="header" style={styles.title}>{t(recovery ? 'password.resetTitle' : 'password.change')}</Text>
      {recovery && auth.passwordRecoveryComplete ? <>
        <Text accessibilityLiveRegion="polite" style={styles.success}>{t('password.updated')}</Text>
        <Text style={styles.label}>{t('password.updatedBody')}</Text>
        <Pressable accessibilityRole="button" onPress={() => { auth.finishPasswordRecovery(); router.replace('/(tabs)'); }} style={styles.primary}><Text style={styles.primaryText}>{t('password.continue')}</Text></Pressable>
      </> : !valid ? <>
        <Text accessibilityRole="alert" style={styles.error}>{t(recovery ? 'password.invalidLink' : 'password.googleManaged')}</Text>
        {recovery && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void leave('/(auth)/forgot-password')}><Text style={styles.link}>{t('password.requestAnother')}</Text></Pressable>}
      </> : <>
        {(['password.new', 'password.confirm'] as const).map((label, index) => <View key={label} style={styles.field}>
          <Text style={styles.label}>{t(label)}</Text><View style={styles.inputRow}>
            <TextInput accessibilityLabel={t(label)} value={index === 0 ? password : confirm} onChangeText={index === 0 ? setPassword : setConfirm} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" editable={!busy} style={styles.input} selectionColor={colors.accent} />
            {index === 0 && <Pressable accessibilityRole="button" accessibilityLabel={t(show ? 'auth.hidePassword' : 'auth.showPassword')} disabled={busy} onPress={() => setShow(!show)} style={styles.eye}><Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.secondary} /></Pressable>}
          </View>
        </View>)}
        {needsReauth && <View style={styles.field}>
          <Text style={styles.label}>{t('password.reauthCode')}</Text>
          <TextInput accessibilityLabel={t('password.reauthCode')} value={nonce} onChangeText={setNonce} autoComplete="one-time-code" textContentType="oneTimeCode" autoCapitalize="none" autoCorrect={false} keyboardType="number-pad" editable={!busy} style={[styles.inputRow, styles.input]} selectionColor={colors.accent} />
          <Pressable accessibilityRole="button" disabled={busy || reauthSeconds > 0} onPress={() => void sendReauth()}><Text style={styles.link}>{reauthSeconds ? t('confirmation.resendIn', { count: reauthSeconds }) : t('password.sendReauth')}</Text></Pressable>
        </View>}
        <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={() => void submit()} style={[styles.primary, busy && styles.disabled]}>{busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryText}>{t('password.save')}</Text>}</Pressable>
      </>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
      {notice && <Text accessibilityLiveRegion="polite" style={styles.success}>{t(notice)}</Text>}
      {recovery ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void leave('/(auth)/sign-in')}><Text style={styles.link}>{t('password.backSignIn')}</Text></Pressable>
        : <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/profile')}><Text style={styles.link}>{t('common.back')}</Text></Pressable>}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 480, alignSelf: 'center', padding: 24, gap: 20 },
  brand: { color: colors.text, fontSize: 30, fontWeight: '700' }, title: { color: colors.text, fontSize: 24, fontWeight: '600' },
  field: { gap: 8 }, label: { color: colors.secondary, fontSize: 14 },
  inputRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface },
  input: { flex: 1, minWidth: 0, padding: 16, color: colors.text, fontSize: 16 }, eye: { width: 48, height: 50, alignItems: 'center', justifyContent: 'center' },
  primary: { minHeight: 56, padding: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentFill },
  primaryText: { color: colors.onAccent, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14, lineHeight: 22 }, success: { color: colors.success, fontSize: 14, lineHeight: 22 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '600', paddingVertical: 10 }, disabled: { opacity: 0.5 },
});
