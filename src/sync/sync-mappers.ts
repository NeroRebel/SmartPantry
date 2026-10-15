import { isValidISODate } from '@/utils/product-status';
import { compareUpdatedAt } from './merge';
import { SyncInvalidData, type CloudSyncRow, type LocalSyncRow, type SyncEntity } from './sync-types';

const common = ['id', 'user_id', 'created_at', 'updated_at', 'deleted_at'] as const;
const productFields = ['name', 'brand', 'barcode', 'category', 'quantity', 'unit', 'expiration_date', 'storage_location', 'image_url', 'notes'] as const;
const historyFields = ['product_id', 'brand', 'barcode', 'category', 'quantity', 'unit', 'expiration_date', 'storage_location', 'image_url', 'notes', 'action'] as const;
export const cloudFields: Record<SyncEntity, readonly string[]> = {
  products: [...common, ...productFields],
  shopping_list: [...common, 'name', 'quantity', 'unit', 'category', 'is_purchased'],
  product_history: [...common, ...historyFields, 'name', 'processed_at'],
};
export const localFields: Record<SyncEntity, readonly string[]> = {
  products: [...common, ...productFields],
  shopping_list: [...common, 'name', 'quantity', 'unit', 'category', 'completed'],
  product_history: [...common, ...historyFields, 'product_name', 'action_date'],
};

export function validateCloudRow(entity: SyncEntity, input: unknown, owner: string): CloudSyncRow {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SyncInvalidData('Invalid cloud row');
  const row = input as Record<string, unknown>;
  if (row.user_id !== owner || typeof row.id !== 'string' || !row.id || row.id.length > 256) throw new SyncInvalidData('Invalid cloud ownership or ID');
  for (const field of cloudFields[entity]) {
    if (!(field in row)) throw new SyncInvalidData('Cloud schema does not match documented columns');
    if (field === 'quantity') {
      if (row[field] !== null && (typeof row[field] !== 'number' || !Number.isFinite(row[field]) || (row[field] as number) < 0)) throw new SyncInvalidData('Invalid cloud quantity');
    } else if (field === 'is_purchased') {
      if (typeof row[field] !== 'boolean') throw new SyncInvalidData('Invalid cloud purchase state');
    } else if (row[field] !== null && typeof row[field] !== 'string') throw new SyncInvalidData('Invalid cloud text');
  }
  if (typeof row.name !== 'string' || !row.name.trim()) throw new SyncInvalidData('Cloud product name is required');
  for (const field of ['created_at', 'updated_at', ...(entity === 'product_history' ? ['processed_at'] : [])]) {
    if (typeof row[field] !== 'string') throw new SyncInvalidData('Missing cloud timestamp');
    compareUpdatedAt(row[field] as string, row[field] as string);
  }
  if (row.deleted_at !== null) {
    if (typeof row.deleted_at !== 'string') throw new SyncInvalidData('Invalid cloud tombstone');
    compareUpdatedAt(row.deleted_at, row.deleted_at);
  }
  if (entity === 'products' && !row.deleted_at && (typeof row.expiration_date !== 'string' || !isValidISODate(row.expiration_date))) throw new SyncInvalidData('Active cloud product needs a valid expiration date');
  if (entity === 'product_history' && row.action !== 'consumed' && row.action !== 'wasted') throw new SyncInvalidData('Invalid cloud lifecycle action');
  return Object.fromEntries(cloudFields[entity].map((field) => [field, row[field]])) as CloudSyncRow;
}

export function localToCloud(entity: SyncEntity, local: LocalSyncRow): CloudSyncRow {
  const result: Record<string, unknown> = {};
  for (const field of cloudFields[entity]) {
    const localField = entity === 'shopping_list' && field === 'is_purchased' ? 'completed'
      : entity === 'product_history' && field === 'name' ? 'product_name'
        : entity === 'product_history' && field === 'processed_at' ? 'action_date' : field;
    result[field] = field === 'is_purchased' ? local.completed === 1 : local[localField] ?? null;
  }
  const created = local.created_at ?? local.action_date;
  if (typeof created !== 'string' || !Number.isFinite(Date.parse(created))) throw new SyncInvalidData('Invalid local creation timestamp');
  result.created_at = new Date(created).toISOString();
  return validateCloudRow(entity, result, local.user_id);
}

export function cloudToLocal(entity: SyncEntity, remote: CloudSyncRow): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};
  for (const field of cloudFields[entity]) {
    const localField = entity === 'shopping_list' && field === 'is_purchased' ? 'completed'
      : entity === 'product_history' && field === 'name' ? 'product_name'
        : entity === 'product_history' && field === 'processed_at' ? 'action_date' : field;
    result[localField] = field === 'is_purchased' ? (remote[field] ? 1 : 0) : remote[field] as string | number | null;
  }
  // UI date-range queries compare ISO text; +00:00 and varying fractions are not
  // lexically equivalent to the existing millisecond-Z boundaries.
  result.created_at = new Date(remote.created_at).toISOString();
  if (entity === 'product_history') result.action_date = new Date(remote.processed_at as string).toISOString();
  if (entity === 'products') {
    result.category = typeof remote.category === 'string' && remote.category.trim() ? remote.category : 'Other';
    // A tombstone is never rendered; do not invent an active expiration date.
    result.expiration_date = remote.expiration_date as string ?? '';
  }
  return result;
}
