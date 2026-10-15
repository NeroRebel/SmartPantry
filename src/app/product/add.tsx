import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ProductForm } from '@/components/product-form';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { filterProductPresets, getPresetFormValues, presetCategories } from '@/data/product-presets';
import { addProduct } from '@/services/product-lifecycle';
import type { ProductInput } from '@/types/product';
import type { ProductPreset } from '@/types/product-preset';
import { categoryLabel } from '@/i18n/format';

type AddMode = 'quick' | 'custom';

function ModeSwitch({ mode, onChange }: { mode: AddMode; onChange: (mode: AddMode) => void }) {
  const { styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {([['quick', t('product.quickAdd')], ['custom', t('product.custom')]] as const).map(([value, label]) => (
        <Pressable
          key={value}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === value }}
          onPress={() => onChange(value)}
          style={({ pressed }) => [styles.segment, mode === value && styles.selectedSegment, pressed && styles.pressed]}
        >
          <Text style={[styles.segmentText, mode === value && styles.selectedSegmentText]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function PresetCard({ preset, onPress }: { preset: ProductPreset; onPress: () => void }) {
  const { styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('polish.addPreset', { name: preset.name })} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Text style={styles.emoji}>{preset.emoji ?? '🥫'}</Text>
      <Text numberOfLines={2} style={styles.cardName}>{preset.name}</Text>
      <Text numberOfLines={1} style={styles.cardCategory}>{categoryLabel(preset.category, t)}</Text>
    </Pressable>
  );
}

export default function AddProductScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ mode?: string; barcode?: string }>();
  const [mode, setMode] = useState<AddMode>(params.mode === 'custom' ? 'custom' : 'quick');
  const [selectedPreset, setSelectedPreset] = useState<ProductPreset | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const presets = filterProductPresets(query, category);
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/inventory');
  const changeMode = (next: AddMode) => {
    setMode(next);
    setSelectedPreset(null);
  };
  const save = async (input: ProductInput) => {
    await addProduct(input);
    router.dismissTo('/(tabs)/inventory');
  };

  if (mode === 'custom' || selectedPreset) {
    return (
      <ProductForm
        key={selectedPreset?.id ?? 'custom'}
        title={t('product.add')}
        submitLabel={t('product.addToPantry')}
        initialValues={{ barcode: params.barcode ?? null, ...(selectedPreset ? getPresetFormValues(selectedPreset) : {}) }}
        headerContent={<ModeSwitch mode={mode} onChange={changeMode} />}
        onBack={selectedPreset ? () => setSelectedPreset(null) : goBack}
        onSubmit={save}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={presets}
        keyExtractor={(preset) => preset.id}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        renderItem={({ item }) => <PresetCard preset={item} onPress={() => setSelectedPreset(item)} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.header}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
              <Text accessibilityRole="header" style={styles.title}>{t('product.add')}</Text>
            </View>
            <ModeSwitch mode={mode} onChange={changeMode} />
            <View style={styles.search}>
              <Ionicons name="search-outline" size={20} color={colors.secondary} />
              <TextInput
                accessibilityLabel={t('product.search')}
                placeholder={t('product.search')}
                placeholderTextColor={colors.secondary}
                selectionColor={colors.accent}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.searchInput}
              />
              {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={t('common.searchClear')} onPress={() => setQuery('')} style={styles.clear}>
                <Ionicons name="close-circle" size={20} color={colors.secondary} />
              </Pressable>}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.filters} contentContainerStyle={styles.filterContent}>
              {['All', ...presetCategories].map((item) => (
                <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: category === item }} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.selectedChip]}>
                  <Text style={[styles.chipText, category === item && styles.selectedChipText]}>{item === 'All' ? t('common.all') : categoryLabel(item, t)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.listHeading}>
              <Text style={styles.sectionTitle}>{t('product.common')}</Text>
              <Text style={styles.count}>{presets.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="search-outline" size={32} color={colors.secondary} /><Text style={styles.emptyTitle}>{t('inventory.noResults')}</Text><Text style={styles.emptyText}>{t('product.searchEmpty')}</Text></View>}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  headerContent: { marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.surface },
  title: { flex: 1, color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '700' },
  segmented: { flexDirection: 'row', padding: 4, marginTop: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, borderRadius: 9 },
  selectedSegment: { backgroundColor: colors.accentSoft },
  segmentText: { color: colors.secondary, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  selectedSegmentText: { color: colors.accent },
  search: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 5, marginTop: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 15, color: colors.text, fontSize: 15 },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filters: { flexGrow: 0, marginTop: 18 },
  filterContent: { gap: 8, paddingBottom: 2 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selectedChip: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  chipText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  selectedChipText: { color: colors.accent },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 16 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  count: { color: colors.secondary, fontSize: 12 },
  columns: { justifyContent: 'space-between', marginBottom: 12 },
  card: { width: '48%', minHeight: 142, justifyContent: 'space-between', padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emoji: { fontSize: 30 },
  cardName: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '600', marginTop: 12 },
  cardCategory: { color: colors.secondary, fontSize: 12, marginTop: 4 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 54 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  emptyText: { color: colors.secondary, fontSize: 13 },
  pressed: { opacity: 0.7 },
});
