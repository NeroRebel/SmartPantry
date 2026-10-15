import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { languages } from '@/i18n';
import { useAppTheme, useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';

export default function LanguageScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { settings, updateAppearance } = useAppTheme();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  async function select(code: typeof languages[number]['code']) {
    if (locked.current || code === settings.language) return;
    locked.current = true;
    setBusy(true);
    try { await updateAppearance({ language: code }); }
    catch { Alert.alert(t('form.unableSave'), t('appearance.saveError')); }
    finally { locked.current = false; setBusy(false); }
  }

  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/more')} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text accessibilityRole="header" style={styles.title}>{t('language.title')}</Text>
      </View>
      <View style={styles.group}>
        {languages.map((language) => <Pressable key={language.code} accessibilityRole="radio" accessibilityState={{ checked: settings.language === language.code, disabled: busy }} disabled={busy} onPress={() => void select(language.code)} style={styles.row}>
          <Text style={styles.name}>{language.nativeName}</Text>
          {settings.language === language.code && <Ionicons name="checkmark-circle" size={23} color={colors.accent} />}
        </Pressable>)}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 44, gap: 28 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.surface },
  title: { flex: 1, color: colors.text, fontSize: 26, fontWeight: '700' },
  group: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' },
  row: { minHeight: 59, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { color: colors.text, fontSize: 16, fontWeight: '500' },
});
