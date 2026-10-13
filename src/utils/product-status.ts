import type { Product, ProductStatus } from '@/types/product';

const DAY = 86_400_000;

export function toLocalISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000 || year > 9999) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function getDaysUntilExpiry(expirationDate: string, today = new Date()): number {
  if (!isValidISODate(expirationDate)) throw new Error('Invalid expiration date');
  const [year, month, day] = expirationDate.split('-').map(Number);
  // Compare calendar days in UTC to avoid 23/25-hour daylight-saving days.
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / DAY);
}

export function getProductStatus(expirationDate: string, today = new Date()): ProductStatus {
  const days = getDaysUntilExpiry(expirationDate, today);
  return days < 0 ? 'expired' : days <= 3 ? 'expiringSoon' : 'fresh';
}

export function getExpirationLabel(expirationDate: string): string {
  const days = getDaysUntilExpiry(expirationDate);
  if (days < 0) return `Expired ${Math.abs(days)} ${days === -1 ? 'day' : 'days'} ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

export function formatExpirationDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatQuantity(product: Pick<Product, 'quantity' | 'unit'>): string {
  if (product.quantity === null) return 'Not specified';
  return [product.quantity, product.unit].filter((value) => value !== null && value !== '').join(' ');
}
