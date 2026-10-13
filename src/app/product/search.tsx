import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { rememberProductSelection } from '@/data/scanned-product-review';
import { categoryLabel } from '@/i18n/format';
import { useProductSearch } from '@/hooks/use-product-search';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import type { ProductSearchResult } from '@/types/scanned-product';
import { isValidBarcode } from '@/utils/scanned-product';

function SearchResult({ product, onPress }: { product: ProductSearchResult; onPress: () => void }) {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [failedImage, setFailedImage] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={product.name} onPress={onPress} style={styles.card}>
    {product.imageUrl && !failedImage ? <Image source={{ uri: product.imageUrl }} resizeMode="contain" onError={() => setFailedImage(true)} style={styles.image} />
      : <View style={styles.placeholder}><Ionicons name="nutrition-outline" size={28} color={colors.accent} /></View>}
    <View style={styles.details}>
      <Text style={styles.name}>{product.name}</Text>
      {product.brand && <Text style={styles.secondary}>{product.brand}</Text>}
      <Text style={styles.secondary}>{categoryLabel(product.category, t)}</Text>
      {product.packageQuantity && <Text style={styles.secondary}>{product.packageQuantity}</Text>}
      {product.nutritionGrade && <Text style={styles.secondary}>{t('scan.nutriScore')}: {product.nutritionGrade}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={20} color={colors.secondary} />
  </Pressable>;
}

export default function ProductSearchScreen() {
  const params = useLocalSearchParams<{ barcode?: string | string[] }>();
  const barcode = (Array.isArray(params.barcode) ? params.barcode[0] : params.barcode) ?? '';
  const valid = isValidBarcode(barcode);
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { status, products, retry } = useProductSearch(valid ? query : '');
  const back = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/scan');
  const manual = () => router.push({ pathname: '/product/add', params: { mode: 'custom', ...(valid ? { barcode } : {}) } });
  const select = (product: ProductSearchResult) => {
    if (!valid) return;
    const selection = rememberProductSelection(product, barcode);
    router.push({ pathname: '/product/scanned', params: { barcode, selection } });
  };

  return <SafeAreaView style={styles.screen}>
    <FlatList data={products} keyExtractor={(product, index) => `${product.barcode ?? product.name}-${index}`} renderItem={({ item }) => <SearchResult product={item} onPress={() => select(item)} />}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}
      ListHeaderComponent={<View style={styles.headerContent}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={back} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
          <Text accessibilityRole="header" style={styles.title}>{t('scan.searchTitle')}</Text>
        </View>
        {valid && <Text style={styles.secondary}>{t('scan.barcode')}: {barcode}</Text>}
        <View style={styles.search}>
          <Ionicons name="search-outline" size={21} color={colors.secondary} />
          <TextInput accessibilityLabel={t('scan.searchPlaceholder')} placeholder={t('scan.searchPlaceholder')} placeholderTextColor={colors.secondary} selectionColor={colors.accent}
            value={query} onChangeText={setQuery} editable={valid} maxLength={120} autoCorrect={false} style={styles.input} />
          {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={t('common.searchClear')} onPress={() => setQuery('')} style={styles.clear}><Ionicons name="close-circle" size={20} color={colors.secondary} /></Pressable>}
        </View>
        <Pressable accessibilityRole="button" onPress={manual} style={styles.action}><Ionicons name="create-outline" size={21} color={colors.accent} /><Text style={styles.actionText}>{t('scan.createManually')}</Text></Pressable>
      </View>}
      ListEmptyComponent={<View style={styles.state}>
        {status === 'loading' ? <ActivityIndicator size="large" color={colors.accent} /> : <>
          <Ionicons name={status === 'error' ? 'cloud-offline-outline' : 'search-outline'} size={36} color={status === 'error' ? colors.danger : colors.secondary} />
          <Text style={styles.stateTitle}>{t(!valid ? 'scan.invalid' : status === 'error' ? 'scan.searchError' : status === 'idle' ? 'scan.searchHint' : 'scan.searchEmpty')}</Text>
          {status === 'error' && <><Text style={styles.secondary}>{t('scan.errorBody')}</Text><Pressable accessibilityRole="button" onPress={retry} style={styles.action}><Text style={styles.actionText}>{t('common.retry')}</Text></Pressable></>}
        </>}
      </View>}
      ListFooterComponent={<View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={() => router.dismissTo('/(tabs)/scan')} style={styles.action}><Ionicons name="scan-outline" size={21} color={colors.accent} /><Text style={styles.actionText}>{t('scan.again')}</Text></Pressable>
      </View>} />
  </SafeAreaView>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 24, paddingTop: 12, gap: 12 },
  headerContent: { gap: 18, marginBottom: 12 },
  header: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 26, fontWeight: '700', color: colors.text },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 4, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, minWidth: 0, minHeight: 54, paddingVertical: 14, fontSize: 14, color: colors.text },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  image: { width: 76, height: 90, borderRadius: 8, backgroundColor: colors.surfaceElevated },
  placeholder: { width: 76, height: 90, borderRadius: 8, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, gap: 4 }, name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  secondary: { color: colors.secondary, fontSize: 13, lineHeight: 19 },
  state: { alignItems: 'center', gap: 14, paddingVertical: 40 },
  stateTitle: { color: colors.text, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  footer: { gap: 12, paddingTop: 20, paddingBottom: 16 },
  action: { width: '100%', minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionText: { color: colors.accent, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
});
