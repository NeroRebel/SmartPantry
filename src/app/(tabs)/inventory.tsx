import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product-card';
import { pantryColors as colors } from '@/constants/pantry-theme';
import { getProductStatus, mockProducts, type ProductStatus } from '@/data/mock-products';

const filters = ['All', 'Fresh', 'Expiring Soon', 'Expired'] as const;

export default function InventoryScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | ProductStatus>('All');
  const insets = useSafeAreaInsets();
  const search = query.trim().toLowerCase();
  const products = mockProducts.filter((product) =>
    (filter === 'All' || getProductStatus(product.daysUntilExpiry) === filter) &&
    `${product.name} ${product.category}`.toLowerCase().includes(search)
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>Inventory</Text>
            <Text style={styles.subtitle}>A little care. Less waste.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add product manually"
            onPress={() => Alert.alert('Add Product', 'Manual product entry is coming soon.')}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={26} color={colors.accent} />
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={21} color={colors.secondary} />
          <TextInput
            accessibilityLabel="Search products"
            placeholder="Search products..."
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
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.secondary} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filterContent}>
          {filters.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={item}
              accessibilityState={{ selected: filter === item }}
              onPress={() => setFilter(item)}
              style={({ pressed }) => [styles.chip, filter === item && styles.selectedChip, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, filter === item && styles.selectedChipText]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.listHeader}>
          <Text style={styles.listCount}>{products.length} {products.length === 1 ? 'product' : 'products'}</Text>
          <View style={styles.sortLabel}>
            <Ionicons name="time-outline" size={13} color={colors.secondary} />
            <Text style={styles.sortText}>Expiry date</Text>
          </View>
        </View>

        <FlatList
          data={products}
          keyExtractor={(product) => product.id}
          renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: Math.max(Platform.OS === 'ios' ? 86 : 72, insets.bottom) + 36 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="leaf-outline" size={36} color={colors.secondary} />
              <Text style={styles.emptyTitle}>{!search && filter === 'Expired' ? 'Nothing expired' : 'No products found'}</Text>
              <Text style={styles.emptyText}>{!search && filter === 'Expired' ? 'Your pantry is looking good.' : 'Try another search or filter.'}</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  heading: { flex: 1, gap: 7 },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '700' },
  subtitle: { color: colors.secondary, fontSize: 13, lineHeight: 18 },
  addButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF6B3D18', alignItems: 'center', justifyContent: 'center' },
  searchBar: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 17, paddingRight: 5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 16, paddingRight: 12, color: colors.text, fontSize: 14 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filters: { flexGrow: 0, flexShrink: 0, height: 46, marginTop: 18 },
  filterContent: { gap: 8, paddingBottom: 2 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selectedChip: { backgroundColor: '#FF6B3D20', borderColor: '#FF6B3D66' },
  chipText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  selectedChipText: { color: colors.accent },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 14 },
  listCount: { color: colors.text, fontSize: 13, fontWeight: '600' },
  sortLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortText: { color: colors.secondary, fontSize: 11 },
  separator: { height: 12 },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 12 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  emptyText: { color: colors.secondary, fontSize: 13 },
  pressed: { opacity: 0.7 },
});
