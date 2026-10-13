import type { ProductHistoryEntry } from '@/types/product-history';

export type StatisticsPeriod = '7d' | '30d' | 'all';

export function getStatisticsDateRange(period: StatisticsPeriod, now = new Date()) {
  if (period === 'all') return null;
  const days = period === '7d' ? 7 : 30;
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1).toISOString(),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString(),
  };
}

export function calculateWasteRate(consumed: number, wasted: number): number {
  const total = consumed + wasted;
  return total === 0 ? 0 : (wasted / total) * 100;
}

export function groupWastedByCategory(entries: readonly ProductHistoryEntry[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.action !== 'wasted') continue;
    const category = entry.category?.trim() || 'Other';
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts].map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)).slice(0, 5);
}

export function calculateStatistics(entries: readonly ProductHistoryEntry[]) {
  const consumed = entries.filter((entry) => entry.action === 'consumed').length;
  const wasted = entries.filter((entry) => entry.action === 'wasted').length;
  return {
    consumed,
    wasted,
    total: consumed + wasted,
    wasteRate: calculateWasteRate(consumed, wasted),
    wastedCategories: groupWastedByCategory(entries),
    recent: [...entries].sort((a, b) => b.actionDate.localeCompare(a.actionDate) || b.id - a.id).slice(0, 7),
  };
}

export function getActivityDateLabel(actionDate: string, now = new Date()): string {
  const date = new Date(actionDate);
  const daysAgo = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86_400_000);
  if (daysAgo === 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  if (daysAgo > 1 && daysAgo < 7) return `${daysAgo} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
