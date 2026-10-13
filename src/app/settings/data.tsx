import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { clearProductHistory, clearShoppingList } from '@/db/manage-data';
import { clearAllDataAndReminders } from '@/services/manage-data';

function confirm(title: string, message: string, action: () => void, cancel: string, clear: string) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) action();
    return;
  }
  Alert.alert(title, message, [{ text: cancel, style: 'cancel' }, { text: clear, style: 'destructive', onPress: action }]);
}

function showResult(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export default function ManageDataScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    try { await action(); showResult(t('data.done'), success); }
    catch { showResult(t('data.clearError'), t('common.pleaseTryAgain')); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/more')} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text accessibilityRole="header" style={styles.title}>{t('data.title')}</Text>
      </View>
      <Text style={styles.intro}>{t('data.intro')}</Text>
      <View style={styles.group}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => confirm(t('data.clearShopping'), t('data.shoppingConfirm'), () => void run(clearShoppingList, t('data.shoppingDone')), t('common.cancel'), t('common.clear'))} style={styles.row}>
          <Ionicons name="basket-outline" size={21} color={colors.expired} /><View style={styles.copy}><Text style={styles.rowTitle}>{t('data.clearShopping')}</Text><Text style={styles.rowSubtitle}>{t('data.shoppingBody')}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.secondary} />
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => confirm(t('data.clearHistory'), t('data.historyConfirm'), () => void run(clearProductHistory, t('data.historyDone')), t('common.cancel'), t('common.clear'))} style={styles.row}>
          <Ionicons name="time-outline" size={21} color={colors.expired} /><View style={styles.copy}><Text style={styles.rowTitle}>{t('data.clearHistory')}</Text><Text style={styles.rowSubtitle}>{t('data.historyBody')}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.secondary} />
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => confirm(t('data.clearAll'), t('data.allConfirm'), () => void run(clearAllDataAndReminders, t('data.allDone')), t('common.cancel'), t('common.clear'))} style={styles.row}>
          <Ionicons name="trash-outline" size={21} color={colors.expired} /><View style={styles.copy}><Text style={[styles.rowTitle, styles.danger]}>{t('data.clearAll')}</Text><Text style={styles.rowSubtitle}>{t('data.allBody')}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.secondary} />
        </Pressable>
      </View>
      <Text style={styles.note}>{t('data.keepPreferences')}</Text>
    </ScrollView>
  </SafeAreaView>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 44, gap: 22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 }, back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  intro: { color: colors.secondary, fontSize: 14, lineHeight: 21 }, group: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden' },
  row: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 17, borderBottomWidth: 1, borderBottomColor: colors.border },
  copy: { flex: 1, gap: 4 }, rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' }, danger: { color: colors.expired }, rowSubtitle: { color: colors.secondary, fontSize: 12 },
  note: { color: colors.secondary, fontSize: 12, lineHeight: 19 },
});
