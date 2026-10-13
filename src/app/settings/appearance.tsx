import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme, useThemedStyles } from '@/theme/theme-context';
import { createTheme, type AppColors } from '@/theme/theme';
import type { AccentColor, ThemeMode } from '@/types/app-settings';

const modes: ThemeMode[] = ['system', 'light', 'dark'];
const accents: AccentColor[] = ['orange', 'purple', 'green', 'red', 'yellow'];

export default function AppearanceScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { settings, mode, updateAppearance } = useAppTheme();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function change(patch: Parameters<typeof updateAppearance>[0]) {
    if (busy) return;
    setBusy(true);
    try { await updateAppearance(patch); }
    catch { Alert.alert(t('form.unableSave'), t('appearance.saveError')); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/more')} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text accessibilityRole="header" style={styles.title}>{t('appearance.title')}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('appearance.theme')}</Text>
        <View style={styles.group}>
          {modes.map((option) => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: settings.themeMode === option, disabled: busy }} disabled={busy} onPress={() => void change({ themeMode: option })} style={styles.row}>
            <Text style={styles.rowText}>{t(`appearance.${option}`)}</Text>
            <Ionicons name={settings.themeMode === option ? 'radio-button-on' : 'radio-button-off'} size={22} color={settings.themeMode === option ? colors.accent : colors.secondary} />
          </Pressable>)}
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('appearance.accessibility')}</Text>
        <View style={styles.group}><View style={styles.row}>
          <Text style={styles.rowText}>{t('appearance.highContrast')}</Text>
          <Switch accessibilityLabel={t('appearance.highContrast')} value={settings.highContrast} disabled={busy} onValueChange={(value) => void change({ highContrast: value })} trackColor={{ false: colors.border, true: colors.accentFill }} thumbColor={settings.highContrast ? colors.onAccent : colors.text} ios_backgroundColor={colors.border} />
        </View></View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('appearance.accent')}</Text>
        <View style={styles.swatches}>
          {accents.map((accent) => {
            const preview = createTheme(mode, settings.highContrast, accent).colors;
            const selected = settings.accentColor === accent;
            return <Pressable key={accent} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: busy }} accessibilityLabel={t(`appearance.${accent}`)} disabled={busy} onPress={() => void change({ accentColor: accent })} style={[styles.swatch, selected && styles.selectedSwatch]}>
              <View style={[styles.swatchColor, { backgroundColor: preview.accentFill }]}>{selected && <Ionicons name="checkmark" size={21} color={preview.onAccent} />}</View>
              <Text style={[styles.swatchLabel, selected && styles.selectedLabel]}>{t(`appearance.${accent}`)}</Text>
            </Pressable>;
          })}
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 44, gap: 28 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  section: { gap: 12 }, sectionTitle: { color: colors.secondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  group: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' },
  row: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: '30%', minWidth: 84, alignItems: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  selectedSwatch: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  swatchColor: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  swatchLabel: { color: colors.secondary, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  selectedLabel: { color: colors.text },
});
