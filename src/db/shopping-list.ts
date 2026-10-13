import { initializeDatabase } from './database';
import type { NewShoppingItem, ShoppingItem, ShoppingItemSource } from '@/types/shopping-item';

interface ShoppingItemRow {
  id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  completed: number;
  source: ShoppingItemSource;
  createdAt: string;
}

const columns = `id, name, quantity, unit, category, completed, source, created_at AS createdAt`;

function mapRow(row: ShoppingItemRow): ShoppingItem {
  return { ...row, completed: row.completed === 1 };
}

function inputValues(input: NewShoppingItem) {
  const name = input.name.trim();
  if (!name) throw new Error('An item name is required.');
  const quantity = input.quantity ?? null;
  if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
    throw new Error('Quantity must be a positive number or zero.');
  }
  const optional = (value?: string | null) => value?.trim() || null;
  return [name, quantity, optional(input.unit), optional(input.category)] as const;
}

export async function getShoppingItems(): Promise<ShoppingItem[]> {
  const db = await initializeDatabase();
  const rows = await db.getAllAsync<ShoppingItemRow>(`SELECT ${columns} FROM shopping_list ORDER BY completed ASC, created_at DESC, id DESC`);
  return rows.map(mapRow);
}

export async function createShoppingItem(input: NewShoppingItem): Promise<number> {
  const params = inputValues(input);
  const db = await initializeDatabase();
  const result = await db.runAsync(`INSERT INTO shopping_list
    (name, quantity, unit, category, source, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [...params, input.source ?? 'manual', new Date().toISOString()]);
  return result.lastInsertRowId;
}

export async function updateShoppingItem(id: number, input: NewShoppingItem): Promise<void> {
  const params = inputValues(input);
  const db = await initializeDatabase();
  const result = await db.runAsync(`UPDATE shopping_list SET name = ?, quantity = ?, unit = ?, category = ? WHERE id = ?`,
    [...params, id]);
  if (!result.changes) throw new Error('This shopping item no longer exists.');
}

export async function toggleShoppingItemCompleted(id: number): Promise<void> {
  const db = await initializeDatabase();
  const result = await db.runAsync('UPDATE shopping_list SET completed = CASE completed WHEN 0 THEN 1 ELSE 0 END WHERE id = ?', id);
  if (!result.changes) throw new Error('This shopping item no longer exists.');
}

export async function deleteShoppingItem(id: number): Promise<void> {
  const db = await initializeDatabase();
  await db.runAsync('DELETE FROM shopping_list WHERE id = ?', id);
}

export async function clearCompletedShoppingItems(): Promise<number> {
  const db = await initializeDatabase();
  const result = await db.runAsync('DELETE FROM shopping_list WHERE completed = 1');
  return result.changes;
}
