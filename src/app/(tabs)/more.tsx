import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAppTheme, useThemedStyles } from '@/theme/theme-context';
import { useAuth } from '@/auth/auth-context';
import { UserAvatar } from '@/components/user-avatar';
import { getUserProfile } from '@/utils/auth';
import type { AppColors } from '@/theme/theme';
import { getNotificationSettings } from '@/db/notification-settings';
import { useFocusedData } from '@/hooks/use-focused-data';
import { getNotificationPermissionStatus, setDefaultReminderDays, setNotificationsEnabled } from '@/services/notifications';
import type { NotificationSettings } from '@/types/notification-settings';
import { languages } from '@/i18n';
import { showFeedback } from '@/services/feedback';

const timings: { days: NotificationSettings['defaultReminderDays']; key: string }[] = [
  { days: 0, key: 'timing.sameDay' }, { days: 1, key: 'timing.day1' },
  { days: 2, key: 'timing.day2' }, { days: 3, key: 'timing.day3' },
];

function Row({ icon, title, subtitle, value, onPress, trailing, disabled = false }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; value?: string;
  onPress?: () => void; trailing?: React.ReactNode; disabled?: boolean;
}) {
  const { colors, styles } = useThemedStyles(createStyles);
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? [title, value, subtitle].filter(Boolean).join(', ') : undefined} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <View style={styles.icon}><Ionicons name={icon} size={20} color={colors.accent} /></View>
    <View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text>{subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}</View>
    {value && <Text style={styles.rowValue}>{value}</Text>}
    {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={17} color={colors.secondary} /> : null)}
  </Pressable>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { styles } = useThemedStyles(createStyles);
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.group}>{children}</View></View>;
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { colors, styles } = useThemedStyles(createStyles);
  const { settings: appearance } = useAppTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const profile = user ? getUserProfile(user) : null;
  const load = useCallback(async () => {
    const [settings, permission] = await Promise.all([getNotificationSettings(), getNotificationPermissionStatus()]);
    return { settings, permission };
  }, []);
  const { data, loading, error, reload } = useFocusedData(load);
  const settings = data?.settings;
  const [timingOpen, setTimingOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  async function changeEnabled(enabled: boolean) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try { await setNotificationsEnabled(enabled); }
    catch (cause) { showFeedback(cause && typeof cause === 'object' && 'code' in cause && cause.code === 'notification_permission_denied' ? 'more.permissionDenied' : 'more.timingError', { tone: 'error', owner: user?.id ?? '' }); }
    finally { locked.current = false; reload(); setBusy(false); }
  }

  async function changeTiming(days: NotificationSettings['defaultReminderDays']) {
    if (locked.current) return;
    locked.current = true;
    setTimingOpen(false);
    setBusy(true);
    try { await setDefaultReminderDays(days); }
    catch { showFeedback('more.timingError', { tone: 'error', owner: user?.id ?? '' }); }
    finally { locked.current = false; reload(); setBusy(false); }
  }

  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: 108 + insets.bottom }]}>
      <Text accessibilityRole="header" style={styles.title}>{t('nav.more')}</Text>
      {profile && <Pressable accessibilityRole="button" accessibilityLabel={t('auth.profile')} onPress={() => router.push('/profile')} style={styles.profile}>
        <UserAvatar key={profile.avatarUrl} url={profile.avatarUrl} name={profile.name || t('auth.user')} /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{profile.name || t('auth.user')}</Text><Text style={styles.rowSubtitle}>{profile.email}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.secondary} />
      </Pressable>}
      <Section title={t('more.activity')}>
        <Row icon="bar-chart-outline" title={t('statistics.title')} subtitle={t('more.statisticsBody')} onPress={() => router.push('/statistics')} />
        <Row icon="basket-outline" title={t('shopping.title')} subtitle={t('more.shoppingBody')} onPress={() => router.push('/shopping-list')} />
      </Section>
      <Section title={t('more.preferences')}>
        <Row icon="notifications-outline" title={t('more.notifications')} subtitle={Platform.OS === 'web' ? t('more.webUnavailable') : data?.permission === 'denied' ? t('more.permissionDenied') : t('more.expirationReminders')} trailing={<Switch accessibilityLabel={t('more.notifications')} value={settings?.notificationsEnabled ?? false} disabled={busy || loading || !!error || Platform.OS === 'web'} onValueChange={(value) => void changeEnabled(value)} trackColor={{ false: colors.border, true: colors.accentFill }} thumbColor={colors.text} ios_backgroundColor={colors.border} />} />
        <Row icon="time-outline" disabled={busy || loading || !!error} title={t('more.reminderTiming')} value={t(timings.find((item) => item.days === settings?.defaultReminderDays)?.key ?? 'timing.day1')} onPress={() => setTimingOpen(true)} />
        <Row icon="language-outline" title={t('more.language')} value={languages.find((item) => item.code === appearance.language)?.nativeName ?? 'English'} onPress={() => router.push('/settings/language')} />
        <Row icon="moon-outline" title={t('more.appearance')} value={`${t(`appearance.${appearance.themeMode}`)} · ${t(`appearance.${appearance.accentColor}`)}${appearance.highContrast ? ` · ${t('appearance.highContrast')}` : ''}`} onPress={() => router.push('/settings/appearance')} />
      </Section>
      <Section title={t('more.data')}><Row icon="server-outline" title={t('more.manageData')} subtitle={t('more.manageDataBody')} onPress={() => router.push('/settings/data')} /></Section>
      <Section title={t('more.about')}>
        <Row icon="information-circle-outline" title={t('more.aboutApp')} onPress={() => router.push('/about')} />
        <Row icon="code-slash-outline" title={t('more.version')} value={Constants.expoConfig?.version ?? t('common.unknown')} />
      </Section>
      {loading && !settings && <ActivityIndicator color={colors.accent} />}
      {error && <Pressable accessibilityRole="button" onPress={reload} style={styles.retry}><Text style={styles.retryText}>{t('more.settingsError')}</Text></Pressable>}
    </ScrollView>
    <Modal visible={timingOpen} transparent animationType="fade" onRequestClose={() => setTimingOpen(false)}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setTimingOpen(false)} accessibilityLabel={t('common.close')} />
        <View accessibilityViewIsModal style={styles.sheet}>
          <Text style={styles.sheetTitle}>{t('more.reminderTiming')}</Text>
          {timings.map((item) => <Pressable key={item.days} accessibilityRole="button" onPress={() => void changeTiming(item.days)} style={styles.timingRow}>
            <Text style={[styles.timingText, settings?.defaultReminderDays === item.days && styles.timingSelected]}>{t(item.key)}</Text>
            {settings?.defaultReminderDays === item.days && <Ionicons name="checkmark" size={20} color={colors.accent} />}
          </Pressable>)}
          <Pressable accessibilityRole="button" onPress={() => setTimingOpen(false)} style={styles.cancel}><Text style={styles.cancelText}>{t('common.cancel')}</Text></Pressable>
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 18, paddingBottom: 48, gap: 30 },
  title: { color: colors.text, fontSize: 34, fontWeight: '700' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  section: { gap: 12 },
  sectionTitle: { color: colors.secondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  group: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden' },
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 }, rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' }, rowSubtitle: { color: colors.secondary, fontSize: 12, lineHeight: 17 },
  rowValue: { flexShrink: 1, maxWidth: '45%', textAlign: 'right', color: colors.secondary, fontSize: 12 }, pressed: { opacity: 0.7 }, retry: { minHeight: 44, padding: 14 }, retryText: { color: colors.accent },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 42 },
  sheetTitle: { color: colors.text, fontSize: 19, fontWeight: '700', marginBottom: 14 },
  timingRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
  timingText: { color: colors.text, fontSize: 15 }, timingSelected: { color: colors.accent, fontWeight: '700' },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, cancelText: { color: colors.secondary, fontSize: 15 },
});
