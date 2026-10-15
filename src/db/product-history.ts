import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { newLocalId, withOwnedData } from './owned-data';
import { localTimestamp } from './local-state';
import type { Product } from '@/types/product';
import type { NewProductHistoryEntry, ProductHistoryAction, ProductHistoryEntry } from '@/types/product-history';

type HistoryConnection = Pick<SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;
type ProductSnapshot = Pick<Product, 'id' | 'name' | 'brand' | 'category' | 'quantity' | 'unit' | 'expirationDate' | 'createdAt' | 'barcode' | 'storageLocation' | 'imageUrl' | 'notes'>;

const columns = `id, product_id AS productId, product_name AS productName, brand, category,
  quantity, unit, expiration_date AS expirationDate, action, action_date AS actionDate,
  created_at AS createdAt, barcode, storage_location AS storageLocation, image_url AS imageUrl, notes`;

async function insertHistory(connection: HistoryConnection, input: NewProductHistoryEntry, owner: string): Promise<string> {
  const name = input.productName.trim();
  if (!name || !['consumed', 'wasted'].includes(input.action)) throw new Error('Invalid product history entry.');
  const id = await newLocalId(connection);
  await connection.runAsync(`INSERT INTO product_history
    (product_id, product_name, brand, category, quantity, unit, expiration_date, action, action_date, created_at, id, user_id, updated_at, barcode, storage_location, image_url, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [input.productId, name, input.brand, input.category,
      input.quantity, input.unit, input.expirationDate, input.action, input.actionDate, input.createdAt, id, owner, localTimestamp(), input.barcode ?? null, input.storageLocation ?? null, input.imageUrl ?? null, input.notes ?? null]);
  return id;
}

export async function createProductHistoryEntry(input: NewProductHistoryEntry): Promise<string> {
  return withOwnedData((db, owner) => insertHistory(db, input, owner), true);
}

export async function getProductHistory(): Promise<ProductHistoryEntry[]> {
  return withOwnedData((db, owner) => db.getAllAsync<ProductHistoryEntry>(`SELECT ${columns} FROM product_history WHERE user_id = ? AND deleted_at IS NULL ORDER BY action_date DESC, id DESC`, owner));
}

export async function getProductHistoryByDateRange(startInclusive: string, endExclusive: string): Promise<ProductHistoryEntry[]> {
  return withOwnedData((db, owner) => db.getAllAsync<ProductHistoryEntry>(`SELECT ${columns} FROM product_history
    WHERE action_date >= ? AND action_date < ? AND user_id = ? AND deleted_at IS NULL ORDER BY action_date DESC, id DESC`, startInclusive, endExclusive, owner));
}

export async function deleteProductHistoryEntry(id: string): Promise<void> {
  await withOwnedData(async (db, owner) => {
    const row = await db.getFirstAsync<{ updated_at: string }>('SELECT updated_at FROM product_history WHERE id = ? AND user_id = ? AND deleted_at IS NULL', id, owner);
    if (!row) return;
    const now = localTimestamp(row.updated_at);
    await db.runAsync('UPDATE product_history SET deleted_at = ?, updated_at = ?, local_revision = local_revision + 1 WHERE id = ? AND user_id = ? AND deleted_at IS NULL', now, now, id, owner);
  }, true);
}

async function completeProduct(productId: string, action: ProductHistoryAction): Promise<void> {
  if (!productId) throw new Error('Invalid product ID.');
  await withOwnedData(async (db, owner) => {
    const perform = async (connection: HistoryConnection) => {
      const product = await connection.getFirstAsync<ProductSnapshot & { updated_at: string }>(`SELECT id, name, brand, category, quantity, unit,
        expiration_date AS expirationDate, created_at AS createdAt, updated_at, barcode, storage_location AS storageLocation, image_url AS imageUrl, notes FROM products WHERE id = ? AND user_id = ? AND deleted_at IS NULL`, productId, owner);
      if (!product) throw new Error('This product no longer exists.');
      await insertHistory(connection, {
        productId: product.id, productName: product.name, brand: product.brand, category: product.category,
        quantity: product.quantity, unit: product.unit, expirationDate: product.expirationDate,
        barcode: product.barcode, storageLocation: product.storageLocation, imageUrl: product.imageUrl, notes: product.notes,
        action, actionDate: localTimestamp(), createdAt: product.createdAt,
      }, owner);
      const now = localTimestamp(product.updated_at);
      const removed = await connection.runAsync('UPDATE products SET deleted_at = ?, updated_at = ?, local_revision = local_revision + 1 WHERE id = ? AND user_id = ? AND deleted_at IS NULL', now, now, productId, owner);
      if (removed.changes !== 1) throw new Error('This product could not be removed.');
    };
    if (Platform.OS === 'web') await db.withTransactionAsync(() => perform(db));
    else await db.withExclusiveTransactionAsync(perform);
  }, true);
}

export function markProductAsConsumed(productId: string): Promise<void> {
  return completeProduct(productId, 'consumed');
}

export function markProductAsWasted(productId: string): Promise<void> {
  return completeProduct(productId, 'wasted');
}
