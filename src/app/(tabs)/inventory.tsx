import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { ProductCard } from '@/components/product-card';
import { getProducts } from '@/db/products';
import { useFocusedData } from '@/hooks/use-focused-data';
import type { ProductStatus } from '@/types/product';
import { getProductStatus } from '@/utils/product-status';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';

const filters = ['all', 'fresh', 'expiringSoon', 'expired'] as const;

export default function InventoryScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const filterLabel = (item: typeof filters[number]) => item === 'all' ? t('common.all') : t(item === 'expiringSoon' ? 'common.soon' : `common.${item}`);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | ProductStatus>('all');
  const { data, loading, error, reload } = useFocusedData(getProducts);
  const allProducts = data ?? [];
  const tabBarHeight = useBottomTabBarHeight();
  const search = query.trim().toLowerCase();
  const products = allProducts.filter((product) =>
    (filter === 'all' || getProductStatus(product.expirationDate) === filter) &&
    `${product.name} ${product.brand ?? ''} ${product.category}`.toLowerCase().includes(search)
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>{t('nav.inventory')}</Text>
            <Text style={styles.subtitle}>{t('inventory.subtitle')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('inventory.addManually')}
            onPress={() => router.push('/product/add')}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={26} color={colors.accent} />
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={21} color={colors.secondary} />
          <TextInput
            accessibilityLabel={t('inventory.search')}
            placeholder={t('inventory.search')}
            placeholderTextColor={colors.secondary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            selectionColor={colors.accent}
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.searchClear')} onPress={() => setQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.secondary} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filterContent}>
          {filters.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={filterLabel(item)}
              accessibilityState={{ selected: filter === item }}
              onPress={() => setFilter(item)}
              style={({ pressed }) => [styles.chip, filter === item && styles.selectedChip, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, filter === item && styles.selectedChipText]}>{filterLabel(item)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.listHeader}>
          <Text style={styles.listCount}>{t('common.productCount', { count: products.length })}</Text>
          <View style={styles.sortLabel}>
            <Ionicons name="time-outline" size={13} color={colors.secondary} />
            <Text style={styles.sortText}>{t('inventory.sort')}</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.empty}>
            <Text accessibilityRole="alert" style={styles.emptyText}>{t(error)}</Text>
            <Pressable accessibilityRole="button" onPress={reload} style={styles.emptyButton}><Text style={styles.emptyButtonText}>{t('common.tryAgain')}</Text></Pressable>
          </View>
        ) : loading && !data ? (
          <ActivityIndicator style={styles.loader} color={colors.accent} accessibilityLabel={t('inventory.loading')} />
        ) : <FlatList
          data={products}
          keyExtractor={(product) => String(product.id)}
          renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshing={loading}
          onRefresh={reload}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 36 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="leaf-outline" size={36} color={colors.secondary} />
              <Text style={styles.emptyTitle}>{allProducts.length === 0 ? t('inventory.noProducts') : !search && filter === 'expired' ? t('inventory.nothingExpired') : t('inventory.noResults')}</Text>
              <Text style={styles.emptyText}>{allProducts.length === 0 ? t('inventory.noProductsBody') : !search && filter === 'expired' ? t('inventory.lookingGood') : t('inventory.noResultsBody')}</Text>
              {allProducts.length === 0 && <Pressable accessibilityRole="button" onPress={() => router.push('/product/add')} style={styles.emptyButton}><Text style={styles.emptyButtonText}>{t('inventory.addProduct')}</Text></Pressable>}
              {allProducts.length > 0 && (search || filter !== 'all') && <Pressable accessibilityRole="button" onPress={() => { setQuery(''); setFilter('all'); }} style={styles.emptyButton}><Text style={styles.emptyButtonText}>{t('common.all')}</Text></Pressable>}
            </View>
          }
        />}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  heading: { flex: 1, gap: 7 },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '700' },
  subtitle: { color: colors.secondary, fontSize: 13, lineHeight: 18 },
  addButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  searchBar: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 17, paddingRight: 5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 16, paddingRight: 12, color: colors.text, fontSize: 14 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filters: { flexGrow: 0, flexShrink: 0, height: 46, marginTop: 18 },
  filterContent: { gap: 8, paddingBottom: 2 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selectedChip: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  chipText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  selectedChipText: { color: colors.accent },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 14 },
  listCount: { color: colors.text, fontSize: 13, fontWeight: '600' },
  sortLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { color: colors.secondary, fontSize: 11 },
  separator: { height: 12 },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 12 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  emptyText: { color: colors.secondary, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  emptyButton: { minHeight: 48, padding: 15, borderRadius: 12, backgroundColor: colors.surface },
  emptyButtonText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  loader: { marginTop: 48 },
  pressed: { opacity: 0.7 },
});
