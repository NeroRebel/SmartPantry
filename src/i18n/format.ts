import type { TFunction } from 'i18next';
import { getDaysUntilExpiry } from '@/utils/product-status';

export function categoryLabel(value: string, t: TFunction): string {
  return t(`category.${value}`, { defaultValue: value });
}

export function storageLabel(value: string, t: TFunction): string {
  return t(`storage.${value}`, { defaultValue: value });
}

export function expirationLabel(date: string, t: TFunction): string {
  const days = getDaysUntilExpiry(date);
  if (days < 0) return t('status.expiredAgo', { count: Math.abs(days) });
  if (days === 0) return t('status.expiresToday');
  if (days === 1) return t('status.expiresTomorrow');
  return t('status.expiresIn', { count: days });
}

export function activityDateLabel(date: string, language: string, t: TFunction, now = new Date()): string {
  const value = new Date(date);
  const days = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())) / 86_400_000);
  if (days === 0) return t('common.today');
  if (days === 1) return t('common.yesterday');
  if (days > 1 && days < 7) return t('common.daysAgo', { count: days });
  return value.toLocaleDateString(language, { month: 'short', day: 'numeric' });
}
