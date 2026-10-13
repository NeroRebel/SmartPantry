import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipeCard } from '@/components/recipe-card';
import { pantryColors as colors } from '@/constants/pantry-theme';
import { getRecipeCategories, getRecipes } from '@/data/recipes';
import { useFocusedData } from '@/hooks/use-focused-data';
import { recipeCategories, type RecipeFilter } from '@/utils/recipe-filters';

export default function RecipesScreen() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category, setCategory] = useState<RecipeFilter>('All');
  useEffect(() => {
    const search = query.trim();
    const timer = setTimeout(() => setDebouncedQuery(search), search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [query]);

  const requestKey = `${category}:${debouncedQuery}`;
  const load = useCallback(async () => ({ key: requestKey, items: await getRecipes(debouncedQuery, category) }), [requestKey, debouncedQuery, category]);
  const { data, loading, error, reload } = useFocusedData(load);
  const { data: remoteCategories } = useFocusedData(getRecipeCategories);
  const insets = useSafeAreaInsets();
  const recipes = !error && data?.key === requestKey && query.trim() === debouncedQuery ? data.items : [];
  const searching = query.trim() !== debouncedQuery || loading || data?.key !== requestKey;
  const categories = remoteCategories ?? recipeCategories;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <FlatList
        data={recipes}
        keyExtractor={(recipe) => recipe.id}
        renderItem={({ item }) => <RecipeCard recipe={item} onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.id } })} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={loading && !!data && recipes.length > 0}
        onRefresh={reload}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(Platform.OS === 'ios' ? 86 : 72, insets.bottom) + 36 }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Cook with{'\n'}<Text style={styles.accent}>what you have</Text></Text>
            <Text style={styles.subtitle}>Discover something good to cook.</Text>
            <View style={styles.search}>
              <Ionicons name="search-outline" size={21} color={colors.secondary} />
              <TextInput accessibilityLabel="Search recipes" placeholder="Search recipes..." placeholderTextColor={colors.secondary} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search" selectionColor={colors.accent} style={styles.searchInput} />
              {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clearButton}><Ionicons name="close-circle" size={20} color={colors.secondary} /></Pressable>}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent} style={styles.filters}>
              {categories.map((item) => (
                <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: category === item }} onPress={() => setCategory(item)} style={({ pressed }) => [styles.chip, category === item && styles.selectedChip, pressed && styles.pressed]}>
                  <Text style={[styles.chipText, category === item && styles.selectedChipText]}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.listHeading}>
              <Text style={styles.sectionTitle}>Recipes</Text>
              {!error && !searching && <Text style={styles.count}>{recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}</Text>}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {error ? (
              <><Text accessibilityRole="header" style={styles.emptyTitle}>Couldn&apos;t load recipes</Text><Text accessibilityRole="alert" style={styles.emptyText}>Check your connection and try again.</Text><Pressable accessibilityRole="button" onPress={reload} style={styles.retryButton}><Text style={styles.retryText}>Try Again</Text></Pressable></>
            ) : searching ? (
              <ActivityIndicator color={colors.accent} accessibilityLabel="Loading recipes" />
            ) : (
              <><Ionicons name="restaurant-outline" size={38} color={colors.secondary} /><Text style={styles.emptyTitle}>No recipes found</Text><Text style={styles.emptyText}>Try another search or category.</Text></>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 22 },
  header: { marginBottom: 16 },
  title: { color: colors.text, fontSize: 35, lineHeight: 42, fontWeight: '700' },
  accent: { color: colors.accent },
  subtitle: { color: colors.secondary, fontSize: 13, lineHeight: 20, marginTop: 11 },
  search: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 17, paddingRight: 5, marginTop: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 16, paddingRight: 12, color: colors.text, fontSize: 14 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filters: { flexGrow: 0, marginTop: 18 },
  filterContent: { gap: 8, paddingBottom: 2 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selectedChip: { backgroundColor: '#FF6B3D20', borderColor: '#FF6B3D66' },
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
