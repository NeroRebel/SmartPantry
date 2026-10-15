import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { lookupBarcode } from '@/api/open-food-facts';
import { ProductForm } from '@/components/product-form';
import { getProductSelection } from '@/data/scanned-product-review';
import { getProducts } from '@/db/products';
import { useFocusedData } from '@/hooks/use-focused-data';
import { addProduct } from '@/services/product-lifecycle';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import type { ProductInput } from '@/types/product';
import { findBarcodeProduct, isValidBarcode, scannedProductFormValues } from '@/utils/scanned-product';

export default function ScannedProductScreen() {
  const { barcode: param, selection: selectionParam } = useLocalSearchParams<{ barcode?: string | string[]; selection?: string | string[] }>();
  const barcode = (Array.isArray(param) ? param[0] : param) ?? '';
  const selection = Array.isArray(selectionParam) ? selectionParam[0] : selectionParam;
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const [acceptedDuplicate, setAcceptedDuplicate] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!isValidBarcode(barcode)) throw new Error('Invalid barcode');
    const [product, products] = await Promise.all([selection ? Promise.resolve(getProductSelection(selection, barcode)) : lookupBarcode(barcode), getProducts()]);
    return { product, existing: findBarcodeProduct(products, barcode) };
  }, [barcode, selection]);
  const { data, loading, error, reload } = useFocusedData(load);
  const back = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/scan');
  const manual = () => router.replace({ pathname: '/product/add', params: { mode: 'custom', ...(isValidBarcode(barcode) ? { barcode } : {}) } });
  const search = () => router.push({ pathname: '/product/search', params: { barcode } });
  const button = (label: string, onPress: () => void) => <Pressable accessibilityRole="button" style={styles.button} onPress={onPress}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  const product = data?.product;
  const existing = data?.existing;

  if ((loading && !data) || error || !product || (existing && acceptedDuplicate !== existing.id)) {
    return <SafeAreaView style={styles.screen}><View style={styles.state}>
      {loading && !data ? <ActivityIndicator size="large" color={colors.accent} /> : error ? <>
        <Text style={styles.title}>{t('scan.lookupError')}</Text><Text style={styles.secondary}>{t('scan.errorBody')}</Text>
        {button(t('common.retry'), reload)}{isValidBarcode(barcode) && button(t('scan.searchByName'), search)}{button(t('scan.addManually'), manual)}
      </> : existing && acceptedDuplicate !== existing.id ? <>
        <Ionicons name="basket-outline" size={48} color={colors.warning} />
        <Text style={styles.title}>{t('scan.duplicate')}</Text><Text style={styles.secondary}>{existing.name}</Text>
        {!product && button(t('scan.searchByName'), search)}
        {button(t('scan.addAnother'), () => product ? setAcceptedDuplicate(existing.id) : manual())}
        {button(t('scan.viewExisting'), () => router.replace({ pathname: '/product/[id]', params: { id: existing.id } }))}
      </> : !product ? <>
        <Text style={styles.title}>{t('scan.notFound')}</Text><Text style={styles.secondary}>{t('scan.notFoundBody')}</Text>{button(t('scan.searchByName'), search)}{button(t('scan.createManually'), manual)}
      </> : null}
      {button(t(loading || existing ? 'common.cancel' : 'scan.again'), loading || existing ? back : () => router.dismissTo('/(tabs)/scan'))}
    </View></SafeAreaView>;
  }

  async function save(input: ProductInput) {
    const id = await addProduct(input);
    router.replace({ pathname: '/product/[id]', params: { id } });
  }

  return <ProductForm key={`${barcode}-${selection ?? 'direct'}`} title={t('scan.review')} submitLabel={t('product.addToPantry')}
    initialValues={scannedProductFormValues(product)} onBack={back} onSubmit={save}
    headerContent={<View style={styles.preview}>
      {selection && <Text style={styles.matched}>{t('scan.matchedByName')}</Text>}
      {product.imageUrl && !imageFailed ? <Image source={{ uri: product.imageUrl }} onError={() => setImageFailed(true)} style={styles.image} resizeMode="contain" accessibilityLabel={product.name} />
        : <View style={styles.placeholder}><Ionicons name="nutrition-outline" size={48} color={colors.accent} /></View>}
      <Text style={styles.secondary}>{t('scan.barcode')}: {product.barcode}</Text>
      {product.packageQuantity && <Text style={styles.secondary}>{t('scan.packageQuantity')}: {product.packageQuantity}</Text>}
      {product.nutritionGrade && <Text style={styles.grade}>{t('scan.nutriScore')}: {product.nutritionGrade}</Text>}
      <Text style={styles.secondary}>{t('scan.expirationHint')}</Text>
      <Text style={styles.attribution}>{t('scan.source')}</Text>
    </View>} />;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  state: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', gap: 18, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  secondary: { color: colors.secondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  button: { minHeight: 52, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.accent, fontWeight: '600', textAlign: 'center' },
  preview: { alignItems: 'center', gap: 12, padding: 18, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  image: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#FFFFFF' },
  placeholder: { height: 100, justifyContent: 'center' },
  grade: { color: colors.text, fontSize: 16, fontWeight: '600' },
  matched: { color: colors.warning, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  attribution: { color: colors.secondary, fontSize: 12, textAlign: 'center' },
});
