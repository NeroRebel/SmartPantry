import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';

export default function AboutScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/more')} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text accessibilityRole="header" style={styles.title}>{t('more.about')}</Text>
      </View>
      <View style={styles.brand}><View style={styles.brandIcon}><Ionicons name="nutrition" size={36} color={colors.accent} /></View><Text style={styles.brandName}>SmartPantry</Text></View>
      <Text style={styles.description}>{t('about.description')}</Text>
      <View style={styles.row}><Text style={styles.label}>{t('more.version')}</Text><Text style={styles.value}>{Constants.expoConfig?.version ?? t('common.unknown')}</Text></View>
      <View style={styles.row}><Text style={styles.label}>{t('about.builtWith')}</Text><Text style={styles.value}>React Native · Expo · TypeScript · SQLite</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 44, gap: 25 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 }, back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 26, fontWeight: '700' }, brand: { alignItems: 'center', gap: 16, paddingTop: 30 },
  brandIcon: { width: 76, height: 76, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: colors.text, fontSize: 30, fontWeight: '700' }, description: { color: colors.secondary, fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, borderTopWidth: 1, borderColor: colors.border, paddingVertical: 17 },
  label: { flex: 1, color: colors.secondary, fontSize: 14 }, value: { flex: 1.5, color: colors.text, fontSize: 14, textAlign: 'right', lineHeight: 20 },
});
