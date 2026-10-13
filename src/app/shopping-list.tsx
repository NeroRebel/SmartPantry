import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ShoppingItemForm } from '@/components/shopping-item-form';
import { ShoppingItemRow } from '@/components/shopping-item-row';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { clearCompletedShoppingItems, createShoppingItem, deleteShoppingItem, getShoppingItems, toggleShoppingItemCompleted, updateShoppingItem } from '@/db/shopping-list';
import { useFocusedData } from '@/hooks/use-focused-data';
import type { NewShoppingItem, ShoppingItem } from '@/types/shopping-item';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

export default function ShoppingListScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { data, setData: setItems, loading, error, reload } = useFocusedData(getShoppingItems);
  const items = data ?? [];
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);

  const toBuyCount = items.filter((item) => !item.completed).length;
  const purchasedCount = items.length - toBuyCount;
  const filtered = items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()));
  const toBuy = filtered.filter((item) => !item.completed);
  const purchased = filtered.filter((item) => item.completed);
  const sections = [
    ...(toBuy.length ? [{ id: 'toBuy', title: t('shopping.toBuyTitle'), data: toBuy }] : []),
    ...(purchased.length ? [{ id: 'purchased', title: t('shopping.purchasedTitle'), data: purchased }] : []),
  ];

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  async function saveItem(input: NewShoppingItem) {
    if (editing) await updateShoppingItem(editing.id, input);
    else await createShoppingItem(input);
    setItems(await getShoppingItems());
    setFormOpen(false);
    setEditing(null);
  }

  async function toggle(item: ShoppingItem) {
    if (workingId !== null) return;
    setWorkingId(item.id);
    setItems((current) => (current ?? []).map((entry) => entry.id === item.id ? { ...entry, completed: !entry.completed } : entry));
    try {
      await toggleShoppingItemCompleted(item.id);
      reload();
    } catch {
      setItems((current) => (current ?? []).map((entry) => entry.id === item.id ? item : entry));
      Alert.alert(t('shopping.unableUpdate'), t('common.pleaseTryAgain'));
    } finally {
      setWorkingId(null);
    }
  }

  function remove(item: ShoppingItem) {
    Alert.alert(t('shopping.deleteItem'), t('shopping.deleteConfirm', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => {
        if (workingId !== null) return;
        setWorkingId(item.id);
        void deleteShoppingItem(item.id).then(() => {
          setItems((current) => (current ?? []).filter((entry) => entry.id !== item.id));
          reload();
        }).catch(() => Alert.alert(t('shopping.unableDelete'), t('common.pleaseTryAgain'))).finally(() => setWorkingId(null));
      } },
    ]);
  }

  function clearPurchased() {
    Alert.alert(t('shopping.clearItems'), t('shopping.clearConfirm', { count: purchasedCount }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('shopping.clearPurchased'), style: 'destructive', onPress: () => {
        if (workingId !== null) return;
        setWorkingId(-1);
        void clearCompletedShoppingItems().then(() => {
          setItems((current) => (current ?? []).filter((item) => !item.completed));
          reload();
        }).catch(() => Alert.alert(t('shopping.unableClear'), t('common.pleaseTryAgain'))).finally(() => setWorkingId(null));
      } },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ShoppingItemRow item={item} disabled={workingId !== null} onToggle={() => void toggle(item)} onEdit={() => { setEditing(item); setFormOpen(true); }} onDelete={() => remove(item)} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{section.title}</Text>
            {section.id === 'purchased' && purchasedCount > 0 && <Pressable accessibilityRole="button" disabled={workingId !== null} onPress={clearPurchased} style={styles.clearPurchased}><Text style={styles.clearPurchasedText}>{t('shopping.clearPurchased')}</Text></Pressable>}
          </View>
        )}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshing={loading && !!data}
        onRefresh={reload}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.topBar}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
              <Text accessibilityRole="header" style={styles.title}>{t('shopping.title')}</Text>
            </View>
            <View style={styles.summary}>
              <View style={styles.summaryBlock}><Text style={styles.toBuyCount}>{toBuyCount}</Text><Text style={styles.summaryLabel}>{t('shopping.toBuy')}</Text></View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryBlock}><Text style={styles.purchasedCount}>{purchasedCount}</Text><Text style={styles.summaryLabel}>{t('shopping.purchased')}</Text></View>
            </View>
            <Pressable accessibilityRole="button" onPress={openAdd} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><Ionicons name="add" size={22} color={colors.background} /><Text style={styles.addButtonText}>{t('shopping.add')}</Text></Pressable>
            {items.length > 0 && <View style={styles.search}>
              <Ionicons name="search-outline" size={20} color={colors.secondary} />
              <TextInput accessibilityLabel={t('shopping.search')} placeholder={t('shopping.search')} placeholderTextColor={colors.secondary} selectionColor={colors.accent} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} style={styles.searchInput} />
              {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={t('common.searchClear')} onPress={() => setQuery('')} style={styles.clearSearch}><Ionicons name="close-circle" size={20} color={colors.secondary} /></Pressable>}
            </View>}
            {error && <View style={styles.errorRow}><Text accessibilityRole="alert" style={styles.errorText}>{t('shopping.loadError')}</Text><Pressable accessibilityRole="button" onPress={reload}><Text style={styles.retryText}>{t('common.tryAgain')}</Text></Pressable></View>}
          </View>
        }
        ListEmptyComponent={loading && !data ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : !error ? (
          <View style={styles.empty}>
            <Ionicons name={items.length ? 'search-outline' : 'basket-outline'} size={40} color={colors.secondary} />
            <Text accessibilityRole="header" style={styles.emptyTitle}>{items.length ? t('shopping.noResults') : t('shopping.empty')}</Text>
            <Text style={styles.emptyText}>{items.length ? t('shopping.noResultsBody') : t('shopping.emptyBody')}</Text>
            {items.length === 0 && <Pressable accessibilityRole="button" onPress={openAdd} style={styles.emptyAction}><Text style={styles.emptyActionText}>{t('shopping.add')}</Text></Pressable>}
          </View>
        ) : null}
      />
      {formOpen && <ShoppingItemForm key={editing?.id ?? 'new'} item={editing} onClose={() => setFormOpen(false)} onSave={saveItem} />}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 48 },
  headerContent: { gap: 20, marginBottom: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.surface },
  title: { flex: 1, color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '700' },
  summary: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  summaryBlock: { flex: 1, alignItems: 'center', gap: 3 },
  summaryDivider: { width: 1, height: 38, backgroundColor: colors.border },
  toBuyCount: { color: colors.accent, fontSize: 30, lineHeight: 35, fontWeight: '700' },
  purchasedCount: { color: colors.fresh, fontSize: 30, lineHeight: 35, fontWeight: '700' },
  summaryLabel: { color: colors.secondary, fontSize: 12 },
  addButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: colors.text },
  addButtonText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  search: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 15, paddingRight: 4, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 13, color: colors.text, fontSize: 14 },
  clearSearch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  clearPurchased: { minHeight: 44, justifyContent: 'center' },
  clearPurchasedText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  separator: { height: 9 },
  empty: { alignItems: 'center', gap: 11, paddingVertical: 62 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  emptyText: { color: colors.secondary, fontSize: 13, textAlign: 'center' },
  emptyAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.surface },
  emptyActionText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  loader: { marginTop: 65 },
  errorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  errorText: { flex: 1, color: colors.secondary, fontSize: 12 },
  retryText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  pressed: { opacity: 0.75 },
});
