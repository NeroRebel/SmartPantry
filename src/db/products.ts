import { initializeDatabase } from './database';
import type { Product, ProductInput, ProductStats } from '@/types/product';
import { getProductStatus, isValidISODate } from '@/utils/product-status';

const columns = `id, name, brand, barcode, category, quantity, unit,
  expiration_date AS expirationDate, storage_location AS storageLocation,
  image_url AS imageUrl, notes, created_at AS createdAt`;

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
  const db = await initializeDatabase();
  return db.getAllAsync<Product>(`SELECT ${columns} FROM products ORDER BY expiration_date ASC, id ASC`);
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

export async function getProductById(id: number): Promise<Product | null> {
  const db = await initializeDatabase();
  return db.getFirstAsync<Product>(`SELECT ${columns} FROM products WHERE id = ?`, id);
}

export async function createProduct(input: ProductInput): Promise<number> {
  const params = values(input);
  const db = await initializeDatabase();
  const result = await db.runAsync(`INSERT INTO products
    (name, brand, barcode, category, quantity, unit, expiration_date, storage_location, image_url, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [...params, new Date().toISOString()]);
  return result.lastInsertRowId;
}

export async function updateProduct(id: number, input: ProductInput): Promise<void> {
  const params = values(input);
  const db = await initializeDatabase();
  const result = await db.runAsync(`UPDATE products SET name = ?, brand = ?, barcode = ?, category = ?,
    quantity = ?, unit = ?, expiration_date = ?, storage_location = ?, image_url = ?, notes = ? WHERE id = ?`, [...params, id]);
  if (!result.changes) throw new Error('This product no longer exists.');
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await initializeDatabase();
  await db.runAsync('DELETE FROM products WHERE id = ?', id);
}
