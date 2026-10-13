import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { initializeDatabase } from './database';
import type { Product } from '@/types/product';
import type { NewProductHistoryEntry, ProductHistoryAction, ProductHistoryEntry } from '@/types/product-history';

type HistoryConnection = Pick<SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;
type ProductSnapshot = Pick<Product, 'id' | 'name' | 'brand' | 'category' | 'quantity' | 'unit' | 'expirationDate' | 'createdAt'>;

const columns = `id, product_id AS productId, product_name AS productName, brand, category,
  quantity, unit, expiration_date AS expirationDate, action, action_date AS actionDate,
  created_at AS createdAt`;

async function insertHistory(connection: HistoryConnection, input: NewProductHistoryEntry): Promise<number> {
  const name = input.productName.trim();
  if (!name || !['consumed', 'wasted'].includes(input.action)) throw new Error('Invalid product history entry.');
  const result = await connection.runAsync(`INSERT INTO product_history
    (product_id, product_name, brand, category, quantity, unit, expiration_date, action, action_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [input.productId, name, input.brand, input.category,
      input.quantity, input.unit, input.expirationDate, input.action, input.actionDate, input.createdAt]);
  return result.lastInsertRowId;
}

export async function createProductHistoryEntry(input: NewProductHistoryEntry): Promise<number> {
  const db = await initializeDatabase();
  return insertHistory(db, input);
}

export async function getProductHistory(): Promise<ProductHistoryEntry[]> {
  const db = await initializeDatabase();
  return db.getAllAsync<ProductHistoryEntry>(`SELECT ${columns} FROM product_history ORDER BY action_date DESC, id DESC`);
}

export async function getProductHistoryByDateRange(startInclusive: string, endExclusive: string): Promise<ProductHistoryEntry[]> {
  const db = await initializeDatabase();
  return db.getAllAsync<ProductHistoryEntry>(`SELECT ${columns} FROM product_history
    WHERE action_date >= ? AND action_date < ? ORDER BY action_date DESC, id DESC`, startInclusive, endExclusive);
}

export async function deleteProductHistoryEntry(id: number): Promise<void> {
  const db = await initializeDatabase();
  await db.runAsync('DELETE FROM product_history WHERE id = ?', id);
}

async function completeProduct(productId: number, action: ProductHistoryAction): Promise<void> {
  if (!Number.isSafeInteger(productId) || productId <= 0) throw new Error('Invalid product ID.');
  const db = await initializeDatabase();
  const perform = async (connection: HistoryConnection) => {
    const product = await connection.getFirstAsync<ProductSnapshot>(`SELECT id, name, brand, category, quantity, unit,
      expiration_date AS expirationDate, created_at AS createdAt FROM products WHERE id = ?`, productId);
    if (!product) throw new Error('This product no longer exists.');
    await insertHistory(connection, {
      productId: product.id, productName: product.name, brand: product.brand, category: product.category,
      quantity: product.quantity, unit: product.unit, expirationDate: product.expirationDate,
      action, actionDate: new Date().toISOString(), createdAt: product.createdAt,
    });
    const removed = await connection.runAsync('DELETE FROM products WHERE id = ?', productId);
    if (removed.changes !== 1) throw new Error('This product could not be removed.');
  };
  if (Platform.OS === 'web') await db.withTransactionAsync(() => perform(db));
  else await db.withExclusiveTransactionAsync(perform);
}

export function markProductAsConsumed(productId: number): Promise<void> {
  return completeProduct(productId, 'consumed');
}

export function markProductAsWasted(productId: number): Promise<void> {
  return completeProduct(productId, 'wasted');
}
