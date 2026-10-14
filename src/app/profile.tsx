import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/auth-context';
import { UserAvatar } from '@/components/user-avatar';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { formatAccountDate, getUserProfile, validateDisplayName } from '@/utils/auth';

export default function ProfileScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t, i18n } = useTranslation();
  const { user, signOut, updateDisplayName, authErrorKey } = useAuth();
  const [busy, setBusy] = useState<'save' | 'logout' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirmLogout, setConfirmLogout] = useState(false);
  if (!user) return null;
  const profile = getUserProfile(user);
  const name = profile.name || t('auth.user');
  const created = formatAccountDate(user.created_at, i18n.language);

  async function saveName() {
    if (busy) return;
    const validation = validateDisplayName(draft);
    setSaved(false);
    if (validation) { setError(validation); return; }
    setBusy('save'); setError(null);
    try { await updateDisplayName(draft); setEditing(false); setSaved(true); }
    catch (cause) { setError(authErrorKey(cause)); }
    finally { setBusy(null); }
  }

  async function logout() {
    if (busy) return;
    setConfirmLogout(false); setBusy('logout'); setError(null); setSaved(false);
    try { await signOut(); }
    catch (cause) { setError(authErrorKey(cause)); }
    finally { setBusy(null); }
  }

  return <SafeAreaView style={styles.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} disabled={!!busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/more')} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>{t('auth.profile')}</Text>
      </View>
      <View style={styles.identity}>
        <UserAvatar url={profile.avatarUrl} name={name} size={88} />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{profile.email}</Text>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{t('profile.account')}</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <Text style={styles.label}>{t('profile.displayName')}</Text>
            {editing ? <>
              <TextInput autoFocus accessibilityLabel={t('profile.displayName')} value={draft} onChangeText={(value) => { setDraft(value); setError(null); }} editable={!busy} autoCapitalize="words" autoCorrect={false} returnKeyType="done" onSubmitEditing={() => void saveName()} selectionColor={colors.accent} style={styles.input} />
              <View style={styles.formActions}>
                <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => { setEditing(false); setError(null); }} style={styles.cancel}>
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!busy, busy: busy === 'save' }} disabled={!!busy} onPress={() => void saveName()} style={[styles.save, !!busy && styles.disabled]}>
                  {busy === 'save' ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.saveText}>{t('profile.save')}</Text>}
                </Pressable>
              </View>
            </> : <View style={styles.nameRow}>
              <Text style={[styles.value, styles.flex]}>{name}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('profile.editName')} disabled={!!busy} onPress={() => { setDraft(profile.name); setEditing(true); setSaved(false); setError(null); }} style={styles.edit}>
                <Ionicons name="pencil-outline" size={20} color={colors.accent} />
              </Pressable>
            </View>}
          </View>
          <View style={styles.row}><Text style={styles.label}>{t('auth.email')}</Text><Text selectable style={styles.value}>{profile.email || t('common.unknown')}</Text></View>
          <View style={styles.row}><Text style={styles.label}>{t('auth.provider')}</Text><Text style={styles.value}>{t(`auth.provider.${profile.provider}`)}</Text></View>
          {created && <View style={styles.row}><Text style={styles.label}>{t('profile.created')}</Text><Text style={styles.value}>{created}</Text></View>}
        </View>
      </View>
      {saved && <Text accessibilityLiveRegion="polite" style={styles.success}>{t('profile.saved')}</Text>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
      <View style={styles.localInfo}>
        <Ionicons name="phone-portrait-outline" size={24} color={colors.secondary} />
        <View style={styles.flex}><Text style={styles.infoTitle}>{t('profile.localTitle')}</Text><Text style={styles.infoBody}>{t('profile.localBody')}</Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!busy, busy: busy === 'logout' }} disabled={!!busy} onPress={() => setConfirmLogout(true)} style={[styles.logout, !!busy && styles.disabled]}>
        {busy === 'logout' ? <ActivityIndicator color={colors.danger} /> : <><Ionicons name="log-out-outline" size={22} color={colors.danger} /><Text style={styles.logoutText}>{t('auth.signOut')}</Text></>}
      </Pressable>
    </ScrollView>
    <Modal visible={confirmLogout} transparent animationType="fade" onRequestClose={() => setConfirmLogout(false)}>
      <SafeAreaView style={styles.modalBackdrop}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>{t('profile.logoutTitle')}</Text>
          <Text style={styles.infoBody}>{t('profile.logoutBody')}</Text>
          <Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.logout}><Text style={styles.logoutText}>{t('auth.signOut')}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setConfirmLogout(false)} style={styles.cancel}><Text style={styles.cancelText}>{t('common.cancel')}</Text></Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 24, gap: 24 },
  header: { flexDirection: 'row', gap: 16, alignItems: 'center' }, back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.text, fontSize: 26, fontWeight: '700' }, identity: { alignItems: 'center', gap: 14, paddingVertical: 24 },
  name: { color: colors.text, fontSize: 24, fontWeight: '700', textAlign: 'center' }, email: { color: colors.secondary, fontSize: 14, textAlign: 'center' },
  section: { gap: 12 }, sectionTitle: { color: colors.secondary, fontSize: 13, fontWeight: '700' },
  group: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden' },
  row: { gap: 8, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }, label: { color: colors.secondary, fontSize: 13 }, value: { color: colors.text, fontSize: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1, minWidth: 0 }, edit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft, borderRadius: 8 },
  input: { minHeight: 50, color: colors.text, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 16 },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, save: { minHeight: 48, padding: 14, backgroundColor: colors.accentFill, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  saveText: { color: colors.onAccent, fontSize: 15, fontWeight: '600' }, cancel: { minHeight: 48, padding: 14, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: colors.secondary, fontSize: 15 },
  localInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, infoTitle: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 6 }, infoBody: { color: colors.secondary, fontSize: 14, lineHeight: 21 },
  logout: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 16 },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '600' }, error: { color: colors.danger, fontSize: 14, lineHeight: 21 }, success: { color: colors.fresh, fontSize: 14, lineHeight: 21 }, disabled: { opacity: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 24, gap: 16 }, dialogTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
});
