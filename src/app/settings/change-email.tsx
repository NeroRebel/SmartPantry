import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/auth-context';
import { useThemedStyles } from '@/theme/theme-context';
import { hasEmailIdentity } from '@/utils/auth';
import { validateEmailChange } from '@/utils/account';
import { accountStyles } from '@/components/account-styles';

export default function ChangeEmailScreen() {
  const { colors, styles } = useThemedStyles(accountStyles);
  const { t } = useTranslation();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const lock = useRef(false);
  async function submit() {
    if (lock.current || !auth.user) return;
    const validation = validateEmailChange(email, auth.user.email);
    if (validation) { setError(validation); return; }
    lock.current = true; setBusy(true); setError(null);
    try { await auth.updateEmail(email); setSent(true); }
    catch (cause) { setError(auth.authErrorKey(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <SafeAreaView style={styles.screen}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>{t('account.changeEmail')}</Text>
      {!hasEmailIdentity(auth.user) ? <Text style={styles.body}>{t('account.googleManaged')}</Text> : sent ? <>
        <Text accessibilityLiveRegion="polite" style={styles.success}>{t('account.emailRequested')}</Text>
        <Text style={styles.body}>{t('account.emailInstructions')}</Text>
      </> : <>
        <Text style={styles.body}>{auth.user?.email}</Text>
        <Text style={styles.label}>{t('account.newEmail')}</Text>
        <TextInput accessibilityLabel={t('account.newEmail')} value={email} onChangeText={(value) => { setEmail(value); setError(null); }} keyboardType="email-address" autoComplete="email" autoCapitalize="none" autoCorrect={false} editable={!busy} selectionColor={colors.accent} style={styles.input} />
        <Text style={styles.body}>{t('account.emailInstructions')}</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit()} style={[styles.primary, busy && styles.disabled]}>{busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryText}>{t('account.changeEmail')}</Text>}</Pressable>
      </>}
      {error && <Text accessibilityRole="alert" style={styles.danger}>{t(error)}</Text>}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/profile')} style={styles.secondary}><Text style={styles.link}>{t('common.back')}</Text></Pressable>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
