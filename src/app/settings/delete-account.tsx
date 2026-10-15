import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/auth-context';
import { useSync } from '@/sync/sync-context';
import { useThemedStyles } from '@/theme/theme-context';
import { accountStyles } from '@/components/account-styles';
import { canConfirmAccountDeletion } from '@/utils/account';
import { createAccountDeletion, deleteCloudAccount, finishDeletedAccountCleanup } from '@/services/account-deletion';
import { forgetDeletedAccountReceipt, recordDeletedAccount } from '@/db/account-cleanup';

export default function DeleteAccountScreen() {
  const { colors, styles } = useThemedStyles(accountStyles);
  const { t } = useTranslation();
  const auth = useAuth();
  const sync = useSync();
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  // Keep the same coordinator across context updates and cleanup retries.
  const [deleteAccount] = useState(() => createAccountDeletion({
    pause: (id) => sync.pauseForDeletion(id),
    resume: (id) => sync.resumeAfterDeletionFailure(id),
    removeCloud: deleteCloudAccount, record: recordDeletedAccount, cleanup: finishDeletedAccountCleanup,
    clearSession: (id) => auth.clearDeletedSession(id), forgetReceipt: forgetDeletedAccountReceipt,
  }));
  useEffect(() => {
    if (!busy && error !== 'account.cleanupFailed') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [busy, error]);
  async function submit() {
    if (locked.current || !auth.user || !canConfirmAccountDeletion(acknowledged, confirmation)) return;
    locked.current = true; setBusy(true); setError(null);
    try { await deleteAccount(auth.user.id, confirmation); router.replace({ pathname: '/(auth)/sign-in', params: { accountDeleted: '1' } }); }
    catch (cause) { setError(auth.authErrorKey(cause)); }
    finally { locked.current = false; setBusy(false); }
  }
  return <SafeAreaView style={styles.screen}><ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>{t('account.deleteTitle')}</Text>
    <Text style={styles.danger}>{t('account.irreversible')}</Text>
    <Text style={styles.body}>{t('account.deleteExplanation')}</Text>
    <Text style={styles.label}>{auth.user?.email}</Text>
    {!acknowledged ? <Pressable accessibilityRole="button" onPress={() => setAcknowledged(true)} style={styles.destructive}><Text style={styles.danger}>{t('account.deletePermanently')}</Text></Pressable> : <>
      <Text style={styles.label}>{t('account.typeDelete')}</Text>
      <TextInput accessibilityLabel={t('account.typeDelete')} value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} editable={!busy} selectionColor={colors.accent} style={styles.input} />
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !canConfirmAccountDeletion(acknowledged, confirmation), busy }} disabled={busy || !canConfirmAccountDeletion(acknowledged, confirmation)} onPress={() => void submit()} style={[styles.destructive, (busy || !canConfirmAccountDeletion(acknowledged, confirmation)) && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.danger}>{t('account.deleteMyAccount')}</Text>}
      </Pressable>
    </>}
    {busy && <Text accessibilityLiveRegion="polite" style={styles.body}>{t('account.deleting')}</Text>}
    {error && <Text accessibilityRole="alert" style={styles.danger}>{t(error)}</Text>}
    <Pressable accessibilityRole="button" disabled={busy || error === 'account.cleanupFailed'} onPress={() => router.canGoBack() ? router.back() : router.replace('/profile')} style={styles.secondary}><Text style={styles.link}>{t('common.cancel')}</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
