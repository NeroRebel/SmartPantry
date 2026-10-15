import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSync } from '@/sync/sync-context';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';

export function SyncSection() {
  const { styles, colors } = useThemedStyles(createStyles);
  const { t, i18n } = useTranslation();
  const sync = useSync();
  const [requestPending, setRequestPending] = useState(false);
  const [manualError, setManualError] = useState<{ status: typeof sync.status; lastSuccessfulSyncAt: string | null } | null>(null);
  const locked = useRef(false);
  const busy = sync.status === 'syncing' || requestPending;
  const disabled = busy || !sync.configured || !sync.canSync;
  async function requestSync() {
    if (locked.current || disabled) return;
    locked.current = true; setRequestPending(true); setManualError(null);
    try { await sync.syncNow(); }
    catch { setManualError({ status: sync.status, lastSuccessfulSyncAt: sync.lastSuccessfulSyncAt }); }
    finally { locked.current = false; setRequestPending(false); }
  }
  const status = sync.status === 'idle' ? (sync.lastSuccessfulSyncAt ? 'synced' : 'never') : sync.status;
  const last = sync.lastSuccessfulSyncAt ? new Date(sync.lastSuccessfulSyncAt).toLocaleString(i18n.language) : null;
  const manualErrorIsCurrent = manualError?.status === sync.status && manualError.lastSuccessfulSyncAt === sync.lastSuccessfulSyncAt;
  const errorKey = !sync.configured ? 'sync.unavailable' : sync.errorKey ?? (manualErrorIsCurrent ? 'sync.errorHelp' : null);
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.title}>{t('sync.title')}</Text>
    <View style={styles.row}><Ionicons name="cloud-outline" size={22} color={colors.accent} /><View style={styles.copy}>
      <Text accessibilityLiveRegion="polite" style={styles.status}>{t(`sync.${status}`)}</Text>
      {last && <Text style={styles.secondary}>{t('sync.last', { date: last })}</Text>}
    </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('sync.now')} accessibilityState={{ busy, disabled }} disabled={disabled} onPress={() => void requestSync()} style={[styles.action, disabled && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.accent} /> : <Ionicons name="sync-outline" size={21} color={colors.accent} />}<Text style={styles.actionText}>{t('sync.now')}</Text>
      </Pressable>
    </View>
    {errorKey && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{t(errorKey)}</Text>}
    <Text style={styles.secondary}>{t('sync.localBody')}</Text>
  </View>;
}
const createStyles = (colors: AppColors) => StyleSheet.create({
  section: { gap: 12 }, title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: colors.border, paddingVertical: 14 },
  copy: { flex: 1, minWidth: 140, gap: 6 }, status: { color: colors.text, fontSize: 15, fontWeight: '600' },
  secondary: { color: colors.secondary, fontSize: 13, lineHeight: 20 }, error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: 10, borderRadius: 8, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.border },
  actionText: { color: colors.accent, fontSize: 14, fontWeight: '600', flexShrink: 1 }, disabled: { opacity: 0.5 },
});
