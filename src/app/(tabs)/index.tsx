import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-context';
import { UserAvatar } from '@/components/user-avatar';
import { getProductStats } from '@/db/products';
import { useFocusedData } from '@/hooks/use-focused-data';
import type { ProductStats } from '@/types/product';
import { useThemedStyles } from '@/theme/theme-context';
import type { AppColors } from '@/theme/theme';
import { getUserProfile } from '@/utils/auth';

const emptyStats: ProductStats = { total: 0, fresh: 0, expiringSoon: 0, expired: 0 };

function openInventory() {
  router.navigate('/(tabs)/inventory');
}

export default function HomeScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const profile = !authLoading && user ? getUserProfile(user) : null;
  const insets = useSafeAreaInsets();
  const { data, loading, error, reload } = useFocusedData(getProductStats);
  const stats = data ?? emptyStats;
  const pantryStatus = [
    { label: t('common.expired'), overviewLabel: t('common.expired'), count: stats.expired, color: colors.red, icon: 'alert-circle-outline' },
    { label: t('home.soon'), overviewLabel: t('common.soon'), count: stats.expiringSoon, color: colors.yellow, icon: 'time-outline' },
    { label: t('common.good'), overviewLabel: t('common.fresh'), count: stats.fresh, color: colors.green, icon: 'checkmark-circle-outline' },
  ] as const;
  const heroCount = !data ? t('home.overview') : stats.total === 0 ? t('home.pantryEmpty') : stats.expiringSoon === 0 ? t('home.allGood') : `${stats.expiringSoon} ${t('common.item', { count: stats.expiringSoon })}`;
  const heroTitle = !data ? t(error ? 'polish.loadError' : 'common.loading') : stats.total === 0 ? t('home.addFirst') : stats.expiringSoon === 0 ? t('home.noExpiring') : t('home.expiringSoon');

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
            <Text style={styles.greeting}>{t('home.greeting')}</Text>
            <Text accessibilityRole="header" style={styles.headline}>
              {t('home.headline')}{'\n'}
              <Text style={styles.accent}>{t('home.headlineAccent')}</Text>
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('auth.profile')}
            onPress={() => router.push('/profile')}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          >
            <UserAvatar url={profile?.avatarUrl ?? null} name={profile?.name ?? ''} size={44} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.search')}
          onPress={openInventory}
          style={({ pressed }) => [styles.search, pressed && styles.pressed]}
        >
          <Ionicons name="search-outline" size={21} color={colors.secondary} />
          <Text style={styles.searchPlaceholder}>{t('home.search')}</Text>
        </Pressable>

        {error ? (
          <View style={styles.loadMessage}>
            <Text accessibilityRole="alert" style={styles.loadMessageText}>{t(error)}</Text>
            <Pressable accessibilityRole="button" onPress={reload} style={styles.retryButton}>
              <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
            </Pressable>
          </View>
        ) : loading && !data ? (
          <ActivityIndicator color={colors.orange} accessibilityLabel={t('home.overview')} />
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${heroCount}. ${heroTitle}. ${t('polish.viewInventory')}`}
          onPress={openInventory}
          style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={colors.heroGradient}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroContent}
          >
            <View style={styles.heroCopy}>
              <View style={styles.heroEyebrow}>
                <Ionicons name="time-outline" size={15} color="#FFE2D6" />
                <Text style={styles.heroEyebrowText}>{stats.expiringSoon > 0 ? t('home.useFirst') : t('home.pantryUpdate')}</Text>
              </View>
              <Text style={[styles.heroCount, stats.total === 0 && styles.heroEmptyCount]}>{heroCount}</Text>
              <Text style={styles.heroTitle}>{heroTitle}</Text>
              <View style={styles.heroAction}>
                <Text style={styles.heroActionText}>{stats.total === 0 ? t('home.openInventory') : t('home.viewItems')}</Text>
                <Ionicons name="arrow-forward" size={17} color={colors.heroText} />
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
            <View key={status.label} accessible accessibilityLabel={data ? `${status.count} ${status.label}` : `${status.label}, ${t('common.loading')}`} style={styles.statusCard}>
              <Ionicons name={status.icon} size={20} color={status.color} />
              <Text style={[styles.statusCount, { color: status.color }]}>{data ? status.count : '--'}</Text>
              <Text style={styles.statusLabel}>{status.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.overview}>
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{t('home.overview')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.seeAll')}
              onPress={openInventory}
              style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
            >
              <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.orange} />
            </Pressable>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalCount}>{data ? stats.total : '--'}</Text>
            <Text style={styles.totalLabel}>{data ? t('home.totalItems', { count: stats.total }) : t('common.loading')}</Text>
          </View>
          <View accessible accessibilityLabel={data ? t('polish.breakdown', { expired: stats.expired, soon: stats.expiringSoon, fresh: stats.fresh }) : t('common.loading')} style={styles.breakdownBar}>
            {pantryStatus.filter((status) => status.count > 0).map((status) => (
              <View key={status.label} style={{ flex: status.count, backgroundColor: status.color }} />
            ))}
          </View>
          <View style={styles.legend}>
            {pantryStatus.map((status) => (
              <View key={status.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: status.color }]} />
                <Text style={styles.legendText}>
                  <Text style={styles.legendCount}>{data ? status.count : '--'}</Text> {status.overviewLabel}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.scanProduct')}
          onPress={() => router.navigate('/(tabs)/scan')}
          style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
        >
          <Ionicons name="scan-outline" size={24} color={colors.background} />
          <Text style={styles.scanButtonText}>{t('home.scanProduct')}</Text>
        </Pressable>

        <View style={styles.quickActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('home.findRecipes')}. ${t('home.cookWith')}`}
            onPress={() => router.navigate('/(tabs)/recipes')}
            style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
          >
            <Ionicons name="restaurant-outline" size={26} color={colors.orange} />
            <Text style={styles.quickTitle}>{t('home.findRecipes')}</Text>
            <Text style={styles.quickSubtitle}>{t('home.cookWith')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('home.shoppingList')}. ${t('home.shoppingSubtitle')}`}
            onPress={() => router.push('/shopping-list')}
            style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
          >
            <Ionicons name="basket-outline" size={26} color={colors.yellow} />
            <Text style={styles.quickTitle}>{t('home.shoppingList')}</Text>
            <Text style={styles.quickSubtitle}>{t('home.shoppingSubtitle')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 22, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  headerText: { flex: 1 },
  greeting: { color: colors.secondary, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  headline: { color: colors.white, fontSize: 36, lineHeight: 42, fontWeight: '700' },
  accent: { color: colors.orange },
  avatar: { width: 46, height: 46, flexShrink: 0, borderRadius: 23, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 3, overflow: 'hidden' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 17, paddingVertical: 14, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  searchPlaceholder: { flex: 1, color: colors.secondary, fontSize: 14 },
  loadMessage: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  loadMessageText: { flex: 1, color: colors.secondary, fontSize: 12, lineHeight: 18 },
  retryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  retryText: { color: colors.orange, fontSize: 12, fontWeight: '600' },
  hero: { borderRadius: 24, overflow: 'hidden' },
  heroContent: { minHeight: 194, flexDirection: 'row', alignItems: 'center', padding: 22, gap: 8 },
  heroCopy: { flex: 1, minWidth: 0, zIndex: 1 },
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  heroEyebrowText: { color: colors.heroText, fontSize: 10, fontWeight: '700' },
  heroCount: { color: colors.heroText, fontSize: 34, lineHeight: 40, fontWeight: '700' },
  heroEmptyCount: { fontSize: 28, lineHeight: 34 },
  heroTitle: { color: colors.heroText, fontSize: 20, lineHeight: 26, fontWeight: '500' },
  heroAction: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 17 },
  heroActionText: { color: colors.heroText, fontSize: 12, fontWeight: '600' },
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
  breakdownBar: { height: 10, flexDirection: 'row', gap: 4, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.border },
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
