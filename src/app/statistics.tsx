import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pantryColors as colors } from '@/constants/pantry-theme';
import { getProductHistory, getProductHistoryByDateRange } from '@/db/product-history';
import { getProductStats } from '@/db/products';
import { useFocusedData } from '@/hooks/use-focused-data';
import { calculateStatistics, getActivityDateLabel, getStatisticsDateRange, type StatisticsPeriod } from '@/utils/statistics';

const periods: { id: StatisticsPeriod; label: string }[] = [
  { id: '7d', label: '7 Days' }, { id: '30d', label: '30 Days' }, { id: 'all', label: 'All Time' },
];

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)/more');
}

export default function StatisticsScreen() {
  const [period, setPeriod] = useState<StatisticsPeriod>('30d');
  const load = useCallback(async () => {
    const range = getStatisticsDateRange(period);
    const [history, inventory] = await Promise.all([
      range ? getProductHistoryByDateRange(range.start, range.end) : getProductHistory(),
      getProductStats(),
    ]);
    return { history, expired: inventory.expired };
  }, [period]);
  const { data, loading, error, reload } = useFocusedData(load);
  const stats = data && !loading && !error ? calculateStatistics(data.history) : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to More" onPress={goBack} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
          <Text accessibilityRole="header" style={styles.title}>Statistics</Text>
        </View>

        <View style={styles.segmented} accessibilityRole="tablist">
          {periods.map((option) => (
            <Pressable key={option.id} accessibilityRole="tab" accessibilityState={{ selected: period === option.id }} onPress={() => setPeriod(option.id)} style={[styles.segment, period === option.id && styles.selectedSegment]}>
              <Text style={[styles.segmentText, period === option.id && styles.selectedSegmentText]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <View style={styles.loadState}>
          <Text accessibilityRole="alert" style={styles.emptyTitle}>Couldn&apos;t load statistics</Text>
          <Text style={styles.muted}>Please try again.</Text>
          <Pressable accessibilityRole="button" onPress={reload} style={styles.retry}><Text style={styles.retryText}>Try Again</Text></Pressable>
        </View> : !stats ? <ActivityIndicator color={colors.accent} style={styles.loader} accessibilityLabel="Loading statistics" /> : <>
          <View style={styles.metrics}>
            <View style={styles.metric}><Ionicons name="checkmark-circle-outline" size={22} color={colors.fresh} /><Text style={styles.metricValue}>{stats.consumed}</Text><Text style={styles.metricLabel}>Consumed</Text></View>
            <View style={styles.metric}><Ionicons name="trash-outline" size={22} color={colors.expired} /><Text style={styles.metricValue}>{stats.wasted}</Text><Text style={styles.metricLabel}>Wasted</Text></View>
            <View style={styles.metric}><Ionicons name="layers-outline" size={22} color={colors.accent} /><Text style={styles.metricValue}>{stats.total}</Text><Text style={styles.metricLabel}>Total</Text></View>
          </View>

          <View style={styles.wasteRate}>
            <View style={styles.wasteRateCopy}><Text style={styles.sectionTitle}>Waste Rate</Text><Text style={styles.muted}>Wasted out of all processed products</Text></View>
            <Text style={[styles.wasteRateValue, { color: stats.wasted ? colors.expired : colors.fresh }]}>{stats.wasteRate.toFixed(1)}%</Text>
          </View>

          <View style={styles.inventoryNote}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.soon} />
            <Text style={styles.inventoryNoteText}>Currently expired in Inventory</Text>
            <Text style={styles.inventoryNoteCount}>{data?.expired ?? 0}</Text>
          </View>

          {stats.total === 0 ? <View style={styles.empty}>
            <Ionicons name="bar-chart-outline" size={42} color={colors.secondary} />
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptyText}>Mark products as consumed or wasted to see your statistics.</Text>
          </View> : <>
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Food Activity</Text>
              <View style={styles.barRow}><Text style={styles.barLabel}>Consumed</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: `${(stats.consumed / stats.total) * 100}%`, backgroundColor: colors.fresh }]} /></View><Text style={styles.barCount}>{stats.consumed}</Text></View>
              <View style={styles.barRow}><Text style={styles.barLabel}>Wasted</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: `${(stats.wasted / stats.total) * 100}%`, backgroundColor: colors.expired }]} /></View><Text style={styles.barCount}>{stats.wasted}</Text></View>
            </View>

            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Most Wasted Categories</Text>
              {stats.wastedCategories.length === 0 ? <Text style={styles.muted}>No wasted products yet.</Text> : stats.wastedCategories.map((item) => (
                <View key={item.category} style={styles.categoryRow}>
                  <View style={styles.categoryDot} /><Text style={styles.categoryName}>{item.category}</Text><Text style={styles.categoryCount}>{item.count}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Recent Activity</Text>
              {stats.recent.map((entry) => (
                <View key={entry.id} style={styles.activityRow}>
                  <View style={[styles.activityIcon, { backgroundColor: entry.action === 'consumed' ? `${colors.fresh}18` : `${colors.expired}18` }]}>
                    <Ionicons name={entry.action === 'consumed' ? 'checkmark' : 'close'} size={20} color={entry.action === 'consumed' ? colors.fresh : colors.expired} />
                  </View>
                  <View style={styles.activityCopy}><Text style={styles.activityName}>{entry.productName}</Text><Text style={styles.activityMeta}>{entry.action === 'consumed' ? 'Consumed' : 'Wasted'} {getActivityDateLabel(entry.actionDate)}</Text></View>
                </View>
              ))}
            </View>
          </>}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 48, gap: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.surface },
  title: { flex: 1, color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '700' },
  segmented: { flexDirection: 'row', padding: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  selectedSegment: { backgroundColor: '#38251F' },
  segmentText: { color: colors.secondary, fontSize: 13, fontWeight: '600' },
  selectedSegmentText: { color: colors.accent },
  metrics: { flexDirection: 'row', gap: 9 },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', gap: 7, paddingVertical: 17, paddingHorizontal: 5, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  metricValue: { color: colors.text, fontSize: 27, fontWeight: '700', fontVariant: ['tabular-nums'] },
  metricLabel: { color: colors.secondary, fontSize: 11 },
  wasteRate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  wasteRateCopy: { flex: 1, gap: 5 },
  wasteRateValue: { fontSize: 27, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  muted: { color: colors.secondary, fontSize: 13, lineHeight: 19 },
  inventoryNote: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  inventoryNoteText: { flex: 1, color: colors.secondary, fontSize: 13 },
  inventoryNoteCount: { color: colors.soon, fontSize: 16, fontWeight: '700' },
  section: { gap: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 73, color: colors.secondary, fontSize: 12 },
  barTrack: { flex: 1, height: 10, overflow: 'hidden', borderRadius: 5, backgroundColor: colors.border },
  barFill: { height: '100%', borderRadius: 5 },
  barCount: { width: 24, textAlign: 'right', color: colors.text, fontSize: 12, fontWeight: '600' },
  categoryRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  categoryDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.expired },
  categoryName: { flex: 1, color: colors.text, fontSize: 14 },
  categoryCount: { color: colors.expired, fontSize: 14, fontWeight: '700' },
  activityRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12 },
  activityIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activityCopy: { flex: 1, gap: 4 },
  activityName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  activityMeta: { color: colors.secondary, fontSize: 12 },
  empty: { alignItems: 'center', gap: 12, paddingTop: 40 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  emptyText: { color: colors.secondary, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  loadState: { alignItems: 'center', gap: 12, paddingTop: 52 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.surface },
  retryText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  loader: { marginTop: 50 },
});
