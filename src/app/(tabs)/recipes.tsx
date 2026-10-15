import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { RecipeCard } from '@/components/recipe-card';
import { getPantryRecipeMatches } from '@/data/pantry-recipes';
import { getRecipeCategories, getRecipes } from '@/data/recipes';
import { useFocusedData } from '@/hooks/use-focused-data';
import type { Recipe, RecipeListItem } from '@/types/recipe';
import { recipeCategories, type RecipeFilter } from '@/utils/recipe-filters';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';

export default function RecipesScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [mode, setMode] = useState<'pantry' | 'all'>('pantry');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category, setCategory] = useState<RecipeFilter>('All');
  useEffect(() => {
    const search = query.trim();
    const timer = setTimeout(() => setDebouncedQuery(search), search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [query]);

  const requestKey = `${category}:${debouncedQuery}`;
  const loadAll = useCallback(async () => mode === 'all'
    ? { key: requestKey, items: await getRecipes(debouncedQuery, category) } : null,
  [mode, requestKey, debouncedQuery, category]);
  const loadPantry = useCallback(() => mode === 'pantry' ? getPantryRecipeMatches() : Promise.resolve(null), [mode]);
  const loadCategories = useCallback(() => mode === 'all' ? getRecipeCategories() : Promise.resolve([...recipeCategories]), [mode]);
  const { data: allData, loading: allLoading, error: allError, reload: reloadAll } = useFocusedData(loadAll, { localChanges: false, midnight: false, remote: true });
  const { data: pantryData, loading: pantryLoading, error: pantryError, reload: reloadPantry } = useFocusedData(loadPantry, { remote: true });
  const { data: remoteCategories } = useFocusedData(loadCategories, { localChanges: false, midnight: false, remote: true });
  const insets = useSafeAreaInsets();
  const searching = mode === 'all' && (query.trim() !== debouncedQuery || allData?.key !== requestKey);
  const pantryPending = mode === 'pantry' && !pantryData;
  const pending = mode === 'pantry' ? pantryPending : searching;
  const error = mode === 'pantry' ? pantryError : allError;
  const pantryMatches = mode === 'pantry' && !error && !pending ? pantryData?.matches ?? [] : [];
  const matchById = new Map(pantryMatches.map((match) => [match.recipe.id, match]));
  const recipes = mode === 'pantry' ? pantryMatches.map((match) => match.recipe)
    : !error && !pending && allData?.key === requestKey ? allData.items : [];
  const categories = remoteCategories ?? recipeCategories;
  const reload = mode === 'pantry' ? reloadPantry : reloadAll;
  const loading = mode === 'pantry' ? pantryLoading : allLoading;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <FlatList<Recipe | RecipeListItem>
        data={recipes}
        keyExtractor={(recipe) => recipe.id}
        renderItem={({ item }) => <RecipeCard recipe={item} match={mode === 'pantry' ? matchById.get(item.id) : undefined} onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.id, source: mode } })} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={loading && recipes.length > 0}
        onRefresh={reload}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(Platform.OS === 'ios' ? 86 : 72, insets.bottom) + 36 }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>{t('recipes.headline')}{'\n'}<Text style={styles.accent}>{t('recipes.headlineAccent')}</Text></Text>
            <Text style={styles.subtitle}>{mode === 'pantry' ? t('recipes.pantrySubtitle') : t('recipes.allSubtitle')}</Text>
            <View style={styles.segmented} accessibilityRole="tablist">
              {([['pantry', t('recipes.fromPantry')], ['all', t('recipes.allRecipes')]] as const).map(([value, label]) => (
                <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: mode === value }} onPress={() => setMode(value)} style={({ pressed }) => [styles.segment, mode === value && styles.selectedSegment, pressed && styles.pressed]}>
                  <Text style={[styles.segmentText, mode === value && styles.selectedSegmentText]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {mode === 'all' && <>
              <View style={styles.search}>
                <Ionicons name="search-outline" size={21} color={colors.secondary} />
                <TextInput accessibilityLabel={t('recipes.search')} placeholder={t('recipes.search')} placeholderTextColor={colors.secondary} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search" selectionColor={colors.accent} style={styles.searchInput} />
                {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={t('common.searchClear')} onPress={() => setQuery('')} style={styles.clearButton}><Ionicons name="close-circle" size={20} color={colors.secondary} /></Pressable>}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent} style={styles.filters}>
                {categories.map((item) => (
                  <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: category === item }} onPress={() => setCategory(item)} style={({ pressed }) => [styles.chip, category === item && styles.selectedChip, pressed && styles.pressed]}>
                    <Text style={[styles.chipText, category === item && styles.selectedChipText]}>{item === 'All' ? t('common.all') : t(`category.${item}`, { defaultValue: item })}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>}
            <View style={styles.listHeading}>
              <Text style={styles.sectionTitle}>{mode === 'pantry' ? t('recipes.bestMatches') : t('nav.recipes')}</Text>
              {!error && !pending && <Text style={styles.count}>{t('common.recipeCount', { count: recipes.length })}</Text>}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {error ? (
              <><Text accessibilityRole="header" style={styles.emptyTitle}>{t('recipes.loadError')}</Text><Text accessibilityRole="alert" style={styles.emptyText}>{t(error)}</Text><Pressable accessibilityRole="button" onPress={reload} style={styles.retryButton}><Text style={styles.retryText}>{t('common.tryAgain')}</Text></Pressable></>
            ) : pending ? (
              <ActivityIndicator color={colors.accent} accessibilityLabel={t('recipes.loading')} />
            ) : mode === 'pantry' && pantryData?.totalProducts === 0 ? (
              <><Ionicons name="basket-outline" size={38} color={colors.secondary} /><Text style={styles.emptyTitle}>{t('recipes.pantryEmpty')}</Text><Text style={styles.emptyText}>{t('recipes.pantryEmptyBody')}</Text><Pressable accessibilityRole="button" onPress={() => router.push('/product/add')} style={styles.retryButton}><Text style={styles.retryText}>{t('inventory.addProduct')}</Text></Pressable></>
            ) : mode === 'pantry' ? (
              <><Ionicons name="restaurant-outline" size={38} color={colors.secondary} /><Text style={styles.emptyTitle}>{t('recipes.noMatches')}</Text><Text style={styles.emptyText}>{t('recipes.noMatchesBody')}</Text><Pressable accessibilityRole="button" onPress={() => router.navigate('/(tabs)/inventory')} style={styles.retryButton}><Text style={styles.retryText}>{t('recipes.openInventory')}</Text></Pressable></>
            ) : (
              <><Ionicons name="restaurant-outline" size={38} color={colors.secondary} /><Text style={styles.emptyTitle}>{t('recipes.noResults')}</Text><Text style={styles.emptyText}>{t('recipes.noResultsBody')}</Text></>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 22 },
  header: { marginBottom: 16 },
  title: { color: colors.text, fontSize: 35, lineHeight: 42, fontWeight: '700' },
  accent: { color: colors.accent },
  subtitle: { color: colors.secondary, fontSize: 13, lineHeight: 20, marginTop: 11 },
  segmented: { flexDirection: 'row', padding: 4, marginTop: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, borderRadius: 9 },
  selectedSegment: { backgroundColor: colors.accentSoft },
  segmentText: { color: colors.secondary, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  selectedSegmentText: { color: colors.accent },
  search: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 17, paddingRight: 5, marginTop: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 16, paddingRight: 12, color: colors.text, fontSize: 14 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filters: { flexGrow: 0, marginTop: 18 },
  filterContent: { gap: 8, paddingBottom: 2 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selectedChip: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  chipText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  selectedChipText: { color: colors.accent },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  count: { color: colors.secondary, fontSize: 12 },
  separator: { height: 12 },
  empty: { alignItems: 'center', paddingVertical: 56, gap: 12 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  emptyText: { color: colors.secondary, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  retryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface },
  retryText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
