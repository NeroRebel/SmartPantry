import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductIcon, StatusBadge, statusColors } from '@/components/product-card';
import { pantryColors as colors } from '@/constants/pantry-theme';
import { formatExpirationDate, getExpirationLabel, getProductStatus, mockProducts, type Product } from '@/data/mock-products';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)/inventory');
}

function BackButton() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back to inventory" onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
      <Ionicons name="chevron-back" size={24} color={colors.text} />
    </Pressable>
  );
}

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
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
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const status = getProductStatus(product.daysUntilExpiry);
  const showPlaceholder = (action: string) => Alert.alert(action, `${action} for ${product.name} is coming soon.`);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.topBarTitle}>Product Details</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.productHeader}>
          <ProductIcon product={product} large />
          <Text style={styles.category}>{product.category}</Text>
          <Text accessibilityRole="header" style={styles.name}>{product.name}</Text>
          <View style={styles.centerBadge}><StatusBadge status={status} /></View>
          <Text style={[styles.expiration, { color: statusColors[status] }]}>{getExpirationLabel(product.daysUntilExpiry)}</Text>
        </View>

        <View style={styles.details}>
          <DetailRow icon="cube-outline" label="Quantity" value={product.quantity} />
          <DetailRow icon="calendar-outline" label="Expiration date" value={formatExpirationDate(product.expirationDate)} />
          <DetailRow icon="file-tray-outline" label="Storage location" value={product.storage} />
        </View>

        <View style={styles.notes}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notesText}>{product.notes}</Text>
        </View>

        <View style={styles.reminderRow}>
          <Ionicons name="notifications-outline" size={22} color={colors.accent} />
          <View style={styles.rowCopy}>
            <Text style={styles.value}>Expiry reminder</Text>
            <Text style={styles.label}>Reminders coming soon</Text>
          </View>
          <Switch
            accessibilityLabel="Expiry reminder"
            value={reminderEnabled}
            onValueChange={setReminderEnabled}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.text}
            ios_backgroundColor={colors.border}
          />
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Edit Product" onPress={() => showPlaceholder('Edit Product')} style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
          <Ionicons name="create-outline" size={21} color={colors.background} />
          <Text style={styles.editText}>Edit Product</Text>
        </Pressable>

        <View style={styles.outcomes}>
          <Pressable accessibilityRole="button" accessibilityLabel="Mark as Consumed" onPress={() => showPlaceholder('Mark as Consumed')} style={({ pressed }) => [styles.outcomeButton, pressed && styles.pressed]}>
            <Ionicons name="checkmark-circle-outline" size={23} color={colors.fresh} />
            <Text style={styles.outcomeText}>Mark as Consumed</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Mark as Wasted" onPress={() => showPlaceholder('Mark as Wasted')} style={({ pressed }) => [styles.outcomeButton, pressed && styles.pressed]}>
            <Ionicons name="trash-outline" size={23} color={colors.soon} />
            <Text style={styles.outcomeText}>Mark as Wasted</Text>
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Delete Product" onPress={() => showPlaceholder('Delete Product')} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
          <Ionicons name="trash-outline" size={18} color={colors.expired} />
          <Text style={styles.deleteText}>Delete Product</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const product = mockProducts.find((item) => item.id === id);

  if (!product) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <BackButton />
          <Text accessibilityRole="header" style={styles.name}>Product not found</Text>
          <Text style={styles.notesText}>This product is not in your pantry.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return <ProductDetails key={product.id} product={product} />;
}

const styles = StyleSheet.create({
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
  editText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  outcomes: { flexDirection: 'row', gap: 12 },
  outcomeButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
  outcomeText: { color: colors.text, textAlign: 'center', fontSize: 13, lineHeight: 20, fontWeight: '600' },
  deleteButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { color: colors.expired, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
