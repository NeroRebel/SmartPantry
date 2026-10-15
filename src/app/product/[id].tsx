import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ProductIcon, StatusBadge, statusColor } from '@/components/product-card';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { ProductLoadState } from '@/components/product-load-state';
import { getProductById } from '@/db/products';
import { useFocusedData } from '@/hooks/use-focused-data';
import { finishProduct, removeProduct } from '@/services/product-lifecycle';
import type { Product } from '@/types/product';
import type { ProductHistoryAction } from '@/types/product-history';
import { formatQuantity, getProductStatus } from '@/utils/product-status';
import { categoryLabel, expirationLabel, storageLabel } from '@/i18n/format';
import { getLocalUserId } from '@/db/local-state';
import { confirmAction } from '@/utils/confirm-action';
import { showFeedback } from '@/services/feedback';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)/inventory');
}

function BackButton() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('product.backInventory')} onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
      <Ionicons name="chevron-back" size={24} color={colors.text} />
    </Pressable>
  );
}

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={20} color={colors.secondary} />
      <View style={styles.rowCopy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

function ProductDetails({ product }: { product: Product }) {
  const owner = getLocalUserId();
  const { colors, styles } = useThemedStyles(createStyles);
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState<'delete' | ProductHistoryAction | null>(null);
  const busyRef = useRef(false);
  const status = getProductStatus(product.expirationDate);

  async function remove() {
    if (busyRef.current || owner !== getLocalUserId()) return;
    busyRef.current = true;
    setBusy('delete');
    try {
      await removeProduct(product.id);
      showFeedback('polish.productDeleted', { owner });
      router.dismissTo('/(tabs)/inventory');
    } catch {
      showFeedback('product.deleteError', { tone: 'error', owner });
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function complete(action: ProductHistoryAction) {
    if (busyRef.current || owner !== getLocalUserId()) return;
    busyRef.current = true;
    setBusy(action);
    try {
      await finishProduct(product.id, action);
      showFeedback(action === 'consumed' ? 'polish.consumed' : 'polish.wasted', { owner });
      router.dismissTo('/(tabs)/inventory');
    } catch {
      showFeedback('product.outcomeError', { tone: 'error', owner });
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  function confirmOutcome(action: ProductHistoryAction) {
    const label = action === 'consumed' ? t('common.consumed') : t('common.wasted');
    const message = t('product.outcomeConfirm', { name: product.name, action: label });
    confirmAction({ title: t(action === 'consumed' ? 'product.markConsumed' : 'product.markWasted'), message,
      cancel: t('common.cancel'), confirm: t('common.confirm'), destructive: action === 'wasted', onConfirm: () => void complete(action) });
  }

  function confirmDelete() {
    const message = t('product.deleteConfirm', { name: product.name });
    confirmAction({ title: t('product.delete'), message, cancel: t('common.cancel'), confirm: t('common.delete'), destructive: true, onConfirm: () => void remove() });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.topBarTitle}>{t('product.details')}</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.productHeader}>
          <ProductIcon product={product} large />
          <Text style={styles.category}>{categoryLabel(product.category, t)}</Text>
          <Text accessibilityRole="header" style={styles.name}>{product.name}</Text>
          {product.brand && <Text style={styles.category}>{product.brand}</Text>}
          <View style={styles.centerBadge}><StatusBadge status={status} /></View>
          <Text style={[styles.expiration, { color: statusColor(status, colors) }]}>{expirationLabel(product.expirationDate, t)}</Text>
        </View>

        <View style={styles.details}>
          <DetailRow icon="cube-outline" label={t('product.quantity')} value={product.quantity === null ? t('common.notSpecified') : formatQuantity(product)} />
          <DetailRow icon="calendar-outline" label={t('product.expirationDate')} value={new Date(`${product.expirationDate}T12:00:00`).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' })} />
          <DetailRow icon="file-tray-outline" label={t('product.storage')} value={product.storageLocation ? storageLabel(product.storageLocation, t) : t('common.notSpecified')} />
        </View>

        <View style={styles.notes}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{t('product.notes')}</Text>
          <Text style={styles.notesText}>{product.notes || t('product.noNotes')}</Text>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={t('product.reminder')} onPress={() => router.push('/(tabs)/more')} style={styles.reminderRow}>
          <Ionicons name="notifications-outline" size={22} color={colors.accent} />
          <View style={styles.rowCopy}>
            <Text style={styles.value}>{t('product.reminder')}</Text>
            <Text style={styles.label}>{t('product.manageMore')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel={t('product.edit')} disabled={busy !== null} onPress={() => router.push({ pathname: '/product/[id]/edit', params: { id: product.id } })} style={({ pressed }) => [styles.editButton, (pressed || busy !== null) && styles.pressed]}>
          <Ionicons name="create-outline" size={21} color={colors.background} />
          <Text style={styles.editText}>{t('product.edit')}</Text>
        </Pressable>

        <View style={styles.outcomes}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('product.markConsumed')} disabled={busy !== null} onPress={() => confirmOutcome('consumed')} style={({ pressed }) => [styles.outcomeButton, (pressed || busy !== null) && styles.pressed]}>
            {busy === 'consumed' ? <ActivityIndicator color={colors.fresh} /> : <Ionicons name="checkmark-circle-outline" size={23} color={colors.fresh} />}
            <Text style={styles.outcomeText}>{busy === 'consumed' ? t('common.saving') : t('product.markConsumed')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('product.markWasted')} disabled={busy !== null} onPress={() => confirmOutcome('wasted')} style={({ pressed }) => [styles.outcomeButton, (pressed || busy !== null) && styles.pressed]}>
            {busy === 'wasted' ? <ActivityIndicator color={colors.soon} /> : <Ionicons name="trash-outline" size={23} color={colors.soon} />}
            <Text style={styles.outcomeText}>{busy === 'wasted' ? t('common.saving') : t('product.markWasted')}</Text>
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={t('product.delete')} disabled={busy !== null} onPress={confirmDelete} style={({ pressed }) => [styles.deleteButton, (pressed || busy !== null) && styles.pressed]}>
          {busy === 'delete' ? <ActivityIndicator color={colors.danger} /> : <Ionicons name="trash-outline" size={18} color={colors.expired} />}
          <Text style={styles.deleteText}>{busy === 'delete' ? t('common.saving') : t('product.delete')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const productId = typeof id === 'string' && id.length > 0 && id.length <= 256 ? id : null;
  const load = useCallback(() => productId ? getProductById(productId) : Promise.resolve(null), [productId]);
  const { data: product, loading, error, reload } = useFocusedData(load);

  if ((loading && !product) || error || !product) {
    return <ProductLoadState loading={loading} error={error} onRetry={reload} onBack={() => router.dismissTo('/(tabs)/inventory')} />;
  }

  return <ProductDetails key={product.id} product={product} />;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 22 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { flex: 1, textAlign: 'center', color: colors.secondary, fontSize: 13, fontWeight: '600' },
  topBarSpacer: { width: 44 },
  productHeader: { alignItems: 'center', gap: 12, paddingVertical: 10 },
  category: { color: colors.secondary, fontSize: 13, marginTop: 6 },
  name: { color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: '700', textAlign: 'center' },
  centerBadge: { alignItems: 'center' },
  expiration: { fontSize: 13, lineHeight: 20 },
  details: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  rowCopy: { flex: 1, gap: 5 },
  label: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  value: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '500' },
  notes: { gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  notesText: { color: colors.secondary, fontSize: 14, lineHeight: 22 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 18 },
  editButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, backgroundColor: colors.text, borderRadius: 16 },
  editText: { color: colors.background, fontSize: 15, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  outcomes: { flexDirection: 'row', gap: 12 },
  outcomeButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
  outcomeText: { color: colors.text, textAlign: 'center', fontSize: 13, lineHeight: 20, fontWeight: '600' },
  deleteButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { color: colors.expired, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
