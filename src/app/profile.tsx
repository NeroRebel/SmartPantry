import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/auth-context';
import { UserAvatar } from '@/components/user-avatar';
import { SyncSection } from '@/components/sync-section';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { formatAccountDate, getUserProfile, hasEmailIdentity, validateDisplayName } from '@/utils/auth';
import { avatarErrorKey, customAvatarPath } from '@/utils/avatar';

export default function ProfileScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t, i18n } = useTranslation();
  const { user, signOut, updateDisplayName, uploadAvatar, removeAvatar, authErrorKey } = useAuth();
  const [busy, setBusy] = useState<'save' | 'logout' | 'pick-photo' | 'photo' | 'remove-photo' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirmation, setConfirmation] = useState<'logout' | 'remove-photo' | null>(null);
  const photoLocked = useRef(false);
  const actionLocked = useRef(false);
  if (!user) return null;
  const profile = getUserProfile(user);
  const name = profile.name || t('auth.user');
  const created = formatAccountDate(user.created_at, i18n.language);

  async function saveName() {
    if (actionLocked.current || photoLocked.current) return;
    const validation = validateDisplayName(draft);
    setNotice(null);
    if (validation) { setError(validation); return; }
    actionLocked.current = true;
    setBusy('save'); setError(null);
    try { await updateDisplayName(draft); setEditing(false); setNotice('profile.saved'); }
    catch (cause) { setError(authErrorKey(cause)); }
    finally { actionLocked.current = false; setBusy(null); }
  }

  async function logout() {
    if (actionLocked.current || photoLocked.current) return;
    actionLocked.current = true;
    setConfirmation(null); setBusy('logout'); setError(null); setNotice(null);
    try { await signOut(); }
    catch (cause) { setError(authErrorKey(cause)); }
    finally { actionLocked.current = false; setBusy(null); }
  }

  async function changePhoto() {
    if (busy || photoLocked.current || actionLocked.current) return;
    photoLocked.current = true; setBusy('pick-photo'); setError(null); setNotice(null);
    let choosing = true;
    try {
      // Keep native picker initialization out of profile/session restoration.
      const { pickAvatar } = await import('@/services/avatar-picker');
      const buffer = await pickAvatar();
      if (buffer) { choosing = false; setBusy('photo'); await uploadAvatar(buffer); setNotice('avatar.updated'); }
    } catch (cause) { setError(avatarErrorKey(cause, choosing ? 'avatar.pickFailed' : 'avatar.uploadFailed')); }
    finally { photoLocked.current = false; setBusy(null); }
  }

  async function removePhoto() {
    if (busy || photoLocked.current || actionLocked.current) return;
    photoLocked.current = true; setConfirmation(null); setBusy('remove-photo'); setError(null); setNotice(null);
    try { await removeAvatar(); setNotice('avatar.removed'); }
    catch (cause) { setError(avatarErrorKey(cause, 'avatar.removeFailed')); }
    finally { photoLocked.current = false; setBusy(null); }
  }

  return <SafeAreaView style={styles.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} disabled={!!busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/more')} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>{t('auth.profile')}</Text>
      </View>
      <View style={styles.identity}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('avatar.change')} accessibilityState={{ disabled: !!busy, busy: busy === 'photo' }} disabled={!!busy} onPress={() => void changePhoto()} style={styles.avatarButton}>
          <UserAvatar url={profile.avatarUrl} name={name} size={88} />
          {(busy === 'photo' || busy === 'remove-photo') && <View pointerEvents="none" style={styles.avatarProgress}><ActivityIndicator color={colors.accent} /></View>}
        </Pressable>
        <View style={styles.photoActions}>
          <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => void changePhoto()} style={styles.photoAction}><Ionicons name="images-outline" size={18} color={colors.accent} /><Text style={styles.photoActionText}>{t('avatar.chooseGallery')}</Text></Pressable>
          {customAvatarPath(user) && <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => setConfirmation('remove-photo')} style={styles.photoAction}><Text style={styles.logoutText}>{t('avatar.remove')}</Text></Pressable>}
        </View>
        {busy === 'photo' && <Text accessibilityLiveRegion="polite" style={styles.email}>{t('avatar.uploading')}</Text>}
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
              <Pressable accessibilityRole="button" accessibilityLabel={t('profile.editName')} disabled={!!busy} onPress={() => { setDraft(profile.name); setEditing(true); setNotice(null); setError(null); }} style={styles.edit}>
                <Ionicons name="pencil-outline" size={20} color={colors.accent} />
              </Pressable>
            </View>}
          </View>
          <View style={styles.row}><Text style={styles.label}>{t('auth.email')}</Text><Text selectable style={styles.value}>{profile.email || t('common.unknown')}</Text></View>
          <View style={styles.row}><Text style={styles.label}>{t('auth.provider')}</Text><Text style={styles.value}>{t(`auth.provider.${profile.provider}`)}</Text></View>
          {created && <View style={styles.row}><Text style={styles.label}>{t('profile.created')}</Text><Text style={styles.value}>{created}</Text></View>}
          {hasEmailIdentity(user) && <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => router.push('/settings/change-email')} style={styles.row}><View style={styles.nameRow}><Ionicons name="mail-outline" size={20} color={colors.accent} /><Text style={[styles.value, styles.flex]}>{t('account.changeEmail')}</Text><Ionicons name="chevron-forward" size={20} color={colors.secondary} /></View></Pressable>}
          {hasEmailIdentity(user) ? <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => router.push('/settings/change-password')} style={styles.row}><View style={styles.nameRow}><Ionicons name="lock-closed-outline" size={20} color={colors.accent} /><Text style={[styles.value, styles.flex]}>{t('password.change')}</Text><Ionicons name="chevron-forward" size={20} color={colors.secondary} /></View></Pressable>
            : profile.provider === 'google' && <View style={styles.row}><Text style={styles.label}>{t('password.googleManaged')}</Text></View>}
        </View>
      </View>
      {notice && <Text accessibilityLiveRegion="polite" style={styles.success}>{t(notice)}</Text>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text>}
      <SyncSection />
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!busy, busy: busy === 'logout' }} disabled={!!busy} onPress={() => setConfirmation('logout')} style={[styles.logout, !!busy && styles.disabled]}>
        {busy === 'logout' ? <ActivityIndicator color={colors.danger} /> : <><Ionicons name="log-out-outline" size={22} color={colors.danger} /><Text style={styles.logoutText}>{t('auth.signOut')}</Text></>}
      </Pressable>
      <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => router.push('/settings/delete-account')} style={styles.logout}><Ionicons name="trash-outline" size={22} color={colors.danger} /><Text style={styles.logoutText}>{t('account.deleteTitle')}</Text></Pressable>
    </ScrollView>
    <Modal visible={!!confirmation} transparent animationType="fade" onRequestClose={() => setConfirmation(null)}>
      <SafeAreaView style={styles.modalBackdrop}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>{t(confirmation === 'remove-photo' ? 'avatar.removeTitle' : 'profile.logoutTitle')}</Text>
          <Text style={styles.infoBody}>{t(confirmation === 'remove-photo' ? 'avatar.removeBody' : 'profile.logoutBody')}</Text>
          <Pressable accessibilityRole="button" onPress={() => void (confirmation === 'remove-photo' ? removePhoto() : logout())} style={styles.logout}><Text style={styles.logoutText}>{t(confirmation === 'remove-photo' ? 'avatar.removeConfirm' : 'auth.signOut')}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setConfirmation(null)} style={styles.cancel}><Text style={styles.cancelText}>{t('common.cancel')}</Text></Pressable>
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
  avatarButton: { width: 90, height: 90, borderRadius: 45, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarProgress: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, opacity: 0.85, alignItems: 'center', justifyContent: 'center' },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }, photoAction: { minHeight: 44, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, photoActionText: { color: colors.accent, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  section: { gap: 12 }, sectionTitle: { color: colors.secondary, fontSize: 13, fontWeight: '700' },
  group: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden' },
  row: { gap: 8, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }, label: { color: colors.secondary, fontSize: 13 }, value: { color: colors.text, fontSize: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1, minWidth: 0 }, edit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft, borderRadius: 8 },
  input: { minHeight: 50, color: colors.text, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 16 },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, save: { minHeight: 48, padding: 14, backgroundColor: colors.accentFill, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  saveText: { color: colors.onAccent, fontSize: 15, fontWeight: '600' }, cancel: { minHeight: 48, padding: 14, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: colors.secondary, fontSize: 15 },
  infoBody: { color: colors.secondary, fontSize: 14, lineHeight: 21 },
  logout: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 16 },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '600' }, error: { color: colors.danger, fontSize: 14, lineHeight: 21 }, success: { color: colors.fresh, fontSize: 14, lineHeight: 21 }, disabled: { opacity: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 24, gap: 16 }, dialogTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
});
