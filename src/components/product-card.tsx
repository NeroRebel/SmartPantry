import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import type { Product, ProductStatus } from '@/types/product';
import { expirationLabel } from '@/i18n/format';
import { formatQuantity, getProductStatus } from '@/utils/product-status';

export function statusColor(status: ProductStatus, colors: AppColors): string {
  return status === 'fresh' ? colors.fresh : status === 'expiringSoon' ? colors.soon : colors.expired;
}

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Dairy: 'water-outline', Meat: 'restaurant-outline', 'Meat & Fish': 'restaurant-outline', Vegetables: 'nutrition-outline',
  Fruit: 'nutrition-outline', Fruits: 'nutrition-outline', Bakery: 'pizza-outline', Drinks: 'cafe-outline',
  Frozen: 'snow-outline', Pantry: 'file-tray-outline',
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const color = statusColor(status, colors);
  return (
    <View style={[styles.badge, { backgroundColor: `${color}18` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{t(status === 'expiringSoon' ? 'common.soon' : `common.${status}`)}</Text>
    </View>
  );
}

export function ProductIcon({ product, large = false }: { product: Product; large?: boolean }) {
  const { colors, styles } = useThemedStyles(createStyles);
  const color = statusColor(getProductStatus(product.expirationDate), colors);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.icon, large && styles.largeIcon, { backgroundColor: `${color}12` }]}>
      <Ionicons name={categoryIcons[product.category] ?? 'cube-outline'} size={large ? 52 : 27} color={color} />
    </View>
  );
}

export function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const status = getProductStatus(product.expirationDate);
  const expiration = expirationLabel(product.expirationDate, t);
  const quantity = product.quantity === null ? t('common.notSpecified') : formatQuantity(product);
  const statusLabel = t(status === 'expiringSoon' ? 'common.soon' : `common.${status}`);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${quantity}, ${expiration}, ${statusLabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.productRow}>
        <ProductIcon product={product} />
        <View style={styles.copy}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.quantity}>{quantity}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
      </View>
      <View style={styles.footer}>
        <Text style={[styles.expiration, { color: statusColor(status, colors) }]}>{expiration}</Text>
        <StatusBadge status={status} />
      </View>
    </Pressable>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  card: { padding: 16, gap: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  icon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  largeIcon: { width: 100, height: 100, borderRadius: 28 },
  copy: { flex: 1, gap: 5 },
  name: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  quantity: { color: colors.secondary, fontSize: 13, lineHeight: 18 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  expiration: { fontSize: 12, lineHeight: 18 },
  badge: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { flexShrink: 1, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
