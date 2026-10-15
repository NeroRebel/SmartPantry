import { newLocalId, withOwnedData } from './owned-data';
import { localTimestamp } from './local-state';
import type { Product, ProductInput, ProductStats } from '@/types/product';
import { getProductStatus, isValidISODate } from '@/utils/product-status';

const columns = `id, name, brand, barcode, category, quantity, unit,
  expiration_date AS expirationDate, storage_location AS storageLocation,
  image_url AS imageUrl, notes, notification_id AS notificationId, created_at AS createdAt`;

function values(input: ProductInput) {
  if (!input.name.trim() || !input.category.trim() || !isValidISODate(input.expirationDate)) {
    throw new Error('A product name, category and valid expiration date are required.');
  }
  if (input.quantity !== null && (!Number.isFinite(input.quantity) || input.quantity < 0)) {
    throw new Error('Quantity must be a positive number or zero.');
  }
  const optional = (value: string | null) => value?.trim() || null;
  return [input.name.trim(), optional(input.brand), optional(input.barcode), input.category.trim(),
    input.quantity, optional(input.unit), input.expirationDate, optional(input.storageLocation),
    optional(input.imageUrl), optional(input.notes)];
}

export async function getProducts(): Promise<Product[]> {
  return withOwnedData((db, owner) => db.getAllAsync<Product>(`SELECT ${columns} FROM products WHERE user_id = ? AND deleted_at IS NULL ORDER BY expiration_date ASC, id ASC`, owner));
}

export async function getProductStats(): Promise<ProductStats> {
  const products = await getProducts();
  const today = new Date();
  const stats: ProductStats = { total: products.length, fresh: 0, expiringSoon: 0, expired: 0 };
  for (const product of products) {
    stats[getProductStatus(product.expirationDate, today)]++;
  }
  return stats;
}

export async function getProductById(id: string): Promise<Product | null> {
  return withOwnedData((db, owner) => db.getFirstAsync<Product>(`SELECT ${columns} FROM products WHERE id = ? AND user_id = ? AND deleted_at IS NULL`, id, owner));
}

export async function createProduct(input: ProductInput): Promise<string> {
  const params = values(input);
  return withOwnedData(async (db, owner) => {
    const id = await newLocalId(db); const now = localTimestamp();
    await db.runAsync(`INSERT INTO products
      (name, brand, barcode, category, quantity, unit, expiration_date, storage_location, image_url, notes, created_at, updated_at, id, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [...params, now, now, id, owner]);
    return id;
  }, true);
}

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  const params = values(input);
  await withOwnedData(async (db, owner) => {
    const current = await db.getFirstAsync<{ updated_at: string }>('SELECT updated_at FROM products WHERE id = ? AND user_id = ? AND deleted_at IS NULL', id, owner);
    if (!current) throw new Error('This product no longer exists.');
    await db.runAsync(`UPDATE products SET name = ?, brand = ?, barcode = ?, category = ?,
      quantity = ?, unit = ?, expiration_date = ?, storage_location = ?, image_url = ?, notes = ?, updated_at = ?, reminder_dirty = 1, local_revision = local_revision + 1 WHERE id = ? AND user_id = ? AND deleted_at IS NULL`, [...params, localTimestamp(current.updated_at), id, owner]);
  }, true);
}

export async function deleteProduct(id: string): Promise<void> {
  await withOwnedData(async (db, owner) => {
    const row = await db.getFirstAsync<{ updated_at: string }>('SELECT updated_at FROM products WHERE id = ? AND user_id = ? AND deleted_at IS NULL', id, owner);
    if (!row) return;
    const now = localTimestamp(row.updated_at);
    await db.runAsync('UPDATE products SET deleted_at = ?, updated_at = ?, local_revision = local_revision + 1 WHERE id = ? AND user_id = ? AND deleted_at IS NULL', now, now, id, owner);
  }, true);
}

export async function setProductNotificationId(id: string, notificationId: string | null, expectedOwner?: string): Promise<void> {
  await withOwnedData(async (db, owner) => {
    if (expectedOwner !== undefined && expectedOwner !== owner) throw new Error('Account changed');
    const result = await db.runAsync('UPDATE products SET notification_id = ?, reminder_dirty = 0 WHERE id = ? AND user_id = ? AND deleted_at IS NULL', notificationId, id, owner);
    if (!result.changes) throw new Error('This product no longer exists.');
  });
}

export function getProductReminderCandidates(): Promise<Product[]> {
  return withOwnedData((db, owner) => db.getAllAsync<Product>(`SELECT ${columns} FROM products WHERE user_id = ? AND deleted_at IS NULL AND (notification_id IS NULL OR reminder_dirty = 1)`, owner));
}
