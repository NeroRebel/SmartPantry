import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const colors = {
  background: '#050505', surface: '#141416', border: '#252528', white: '#FFFFFF',
  secondary: '#99999F', orange: '#FF6B3D', red: '#FF625C', yellow: '#FFBE55', green: '#68D8A0',
};

const pantryStatus = [
  { label: 'Expired', overviewLabel: 'Expired', count: 2, color: colors.red, icon: 'alert-circle-outline' },
  { label: 'Soon', overviewLabel: 'Expiring soon', count: 3, color: colors.yellow, icon: 'time-outline' },
  { label: 'Good', overviewLabel: 'Fresh', count: 12, color: colors.green, icon: 'checkmark-circle-outline' },
] as const;
const totalItems = pantryStatus.reduce((total, status) => total + status.count, 0);

function openInventory() {
  router.navigate('/(tabs)/inventory');
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          // Leave room for the absolute tab bar and its raised Scan icon.
          { paddingBottom: Math.max(Platform.OS === 'ios' ? 86 : 72, insets.bottom) + 36 },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text accessibilityRole="header" style={styles.headline}>
              {"Let's make\n"}
              <Text style={styles.accent}>food count.</Text>
            </Text>
          </View>
          <View accessible accessibilityLabel="Profile avatar placeholder" style={styles.avatar}>
            <Ionicons name="person-outline" size={23} color={colors.white} />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search your pantry"
          onPress={openInventory}
          style={({ pressed }) => [styles.search, pressed && styles.pressed]}
        >
          <Ionicons name="search-outline" size={21} color={colors.secondary} />
          <Text style={styles.searchPlaceholder}>Search your pantry...</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="3 items expiring soon. View inventory"
          onPress={openInventory}
          style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={['#AE2E2C', '#D6412D', '#EF7135']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroContent}
          >
            <View style={styles.heroCopy}>
              <View style={styles.heroEyebrow}>
                <Ionicons name="time-outline" size={15} color="#FFE2D6" />
                <Text style={styles.heroEyebrowText}>USE THEM FIRST</Text>
              </View>
              <Text style={styles.heroCount}>3 items</Text>
              <Text style={styles.heroTitle}>expiring soon</Text>
              <View style={styles.heroAction}>
                <Text style={styles.heroActionText}>View items</Text>
                <Ionicons name="arrow-forward" size={17} color={colors.white} />
              </View>
            </View>
            <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.foodArt}>
              <Ionicons name="nutrition" size={83} color="#FFE1AC" style={styles.foodIcon} />
              <Ionicons name="leaf" size={36} color="#CAE7BA" style={styles.leafIcon} />
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.statusRow}>
          {pantryStatus.map((status) => (
            <View key={status.label} accessible accessibilityLabel={`${status.count} ${status.label}`} style={styles.statusCard}>
              <Ionicons name={status.icon} size={20} color={status.color} />
              <Text style={[styles.statusCount, { color: status.color }]}>{status.count}</Text>
              <Text style={styles.statusLabel}>{status.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.overview}>
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Pantry Overview</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all pantry items"
              onPress={openInventory}
              style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
            >
              <Text style={styles.seeAllText}>See all</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.orange} />
            </Pressable>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalCount}>{totalItems}</Text>
            <Text style={styles.totalLabel}>total items</Text>
          </View>
          <View accessible accessibilityLabel="Pantry breakdown: 2 expired, 3 expiring soon, 12 fresh" style={styles.breakdownBar}>
            {pantryStatus.map((status) => (
              <View key={status.label} style={{ flex: status.count, backgroundColor: status.color }} />
            ))}
          </View>
          <View style={styles.legend}>
            {pantryStatus.map((status) => (
              <View key={status.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: status.color }]} />
                <Text style={styles.legendText}>
                  <Text style={styles.legendCount}>{status.count}</Text> {status.overviewLabel}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan Product"
          onPress={() => router.navigate('/(tabs)/scan')}
          style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
        >
          <Ionicons name="scan-outline" size={24} color={colors.background} />
          <Text style={styles.scanButtonText}>Scan Product</Text>
        </Pressable>

        <View style={styles.quickActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find Recipes. Cook with what you have"
            onPress={() => router.navigate('/(tabs)/recipes')}
            style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
          >
            <Ionicons name="restaurant-outline" size={26} color={colors.orange} />
            <Text style={styles.quickTitle}>Find Recipes</Text>
            <Text style={styles.quickSubtitle}>Cook with what you have</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Shopping List. Never forget essentials"
            onPress={() => Alert.alert('Shopping List', 'Your shopping list is coming soon.')}
            style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
          >
            <Ionicons name="basket-outline" size={26} color={colors.yellow} />
            <Text style={styles.quickTitle}>Shopping List</Text>
            <Text style={styles.quickSubtitle}>Never forget essentials</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 22, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  headerText: { flex: 1 },
  greeting: { color: colors.secondary, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  headline: { color: colors.white, fontSize: 36, lineHeight: 42, fontWeight: '700' },
  accent: { color: colors.orange },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 17, paddingVertical: 14, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  searchPlaceholder: { flex: 1, color: colors.secondary, fontSize: 14 },
  hero: { borderRadius: 24, overflow: 'hidden' },
  heroContent: { minHeight: 194, flexDirection: 'row', alignItems: 'center', padding: 22, gap: 8 },
  heroCopy: { flex: 1, zIndex: 1 },
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  heroEyebrowText: { color: '#FFE2D6', fontSize: 10, fontWeight: '700' },
  heroCount: { color: colors.white, fontSize: 34, lineHeight: 40, fontWeight: '700' },
  heroTitle: { color: colors.white, fontSize: 20, lineHeight: 26, fontWeight: '500' },
  heroAction: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 17 },
  heroActionText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  foodArt: { width: 85, height: 120, alignItems: 'center', justifyContent: 'center' },
  foodIcon: { transform: [{ rotate: '16deg' }] },
  leafIcon: { position: 'absolute', top: 0, right: 0, transform: [{ rotate: '-25deg' }] },
  statusRow: { flexDirection: 'row', gap: 10 },
  statusCard: { flex: 1, paddingHorizontal: 12, paddingVertical: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', gap: 7 },
  statusCount: { fontSize: 26, lineHeight: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statusLabel: { color: colors.secondary, fontSize: 12, fontWeight: '500' },
  overview: { paddingVertical: 4, gap: 17 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { flex: 1, color: colors.white, fontSize: 18, fontWeight: '600' },
  seeAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllText: { color: colors.orange, fontSize: 12, fontWeight: '600' },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  totalCount: { color: colors.white, fontSize: 38, lineHeight: 44, fontWeight: '700', fontVariant: ['tabular-nums'] },
  totalLabel: { color: colors.secondary, fontSize: 13 },
  breakdownBar: { height: 10, flexDirection: 'row', gap: 4, borderRadius: 5, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { color: colors.secondary, fontSize: 11, lineHeight: 16 },
  legendCount: { color: colors.white, fontWeight: '600' },
  scanButton: { minHeight: 58, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, backgroundColor: colors.white },
  scanButtonText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  quickActions: { flexDirection: 'row', gap: 12 },
  quickCard: { flex: 1, padding: 17, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 9 },
  quickTitle: { color: colors.white, fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 5 },
  quickSubtitle: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.75 },
});
