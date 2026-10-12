import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pantryColors as colors } from '@/constants/pantry-theme';
import { getExpirationLabel, getProductStatus, type Product, type ProductStatus } from '@/data/mock-products';

export const statusColors: Record<ProductStatus, string> = {
  Fresh: colors.fresh,
  'Expiring Soon': colors.soon,
  Expired: colors.expired,
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  const color = statusColors[status];
  return (
    <View style={[styles.badge, { backgroundColor: `${color}18` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{status}</Text>
    </View>
  );
}

export function ProductIcon({ product, large = false }: { product: Product; large?: boolean }) {
  const color = statusColors[getProductStatus(product.daysUntilExpiry)];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.icon, large && styles.largeIcon, { backgroundColor: `${color}12` }]}>
      <Ionicons name={product.icon} size={large ? 52 : 27} color={color} />
    </View>
  );
}

export function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const status = getProductStatus(product.daysUntilExpiry);
  const expiration = getExpirationLabel(product.daysUntilExpiry);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${product.quantity}, ${expiration}, ${status}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.productRow}>
        <ProductIcon product={product} />
        <View style={styles.copy}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.quantity}>{product.quantity}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
      </View>
      <View style={styles.footer}>
        <Text style={[styles.expiration, { color: statusColors[status] }]}>{expiration}</Text>
        <StatusBadge status={status} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  icon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  largeIcon: { width: 100, height: 100, borderRadius: 28 },
  copy: { flex: 1, gap: 5 },
  name: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  quantity: { color: colors.secondary, fontSize: 13, lineHeight: 18 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  expiration: { fontSize: 12, lineHeight: 18 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
