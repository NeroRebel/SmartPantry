import { newLocalId, withOwnedData } from './owned-data';
import { localTimestamp } from './local-state';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { NewShoppingItem, ShoppingItem, ShoppingItemSource } from '@/types/shopping-item';

interface ShoppingItemRow {
  id: string;
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
  const rows = await withOwnedData((db, owner) => db.getAllAsync<ShoppingItemRow>(`SELECT ${columns} FROM shopping_list WHERE user_id = ? AND deleted_at IS NULL ORDER BY completed ASC, created_at DESC, id DESC`, owner));
  return rows.map(mapRow);
}

export async function createShoppingItem(input: NewShoppingItem): Promise<string> {
  const params = inputValues(input);
  return withOwnedData(async (db, owner) => {
    const id = await newLocalId(db); const now = localTimestamp();
    await db.runAsync(`INSERT INTO shopping_list
      (name, quantity, unit, category, source, created_at, updated_at, id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...params, input.source ?? 'manual', now, now, id, owner]);
    return id;
  }, true);
}

export async function updateShoppingItem(id: string, input: NewShoppingItem): Promise<void> {
  const params = inputValues(input);
  await mutateItem(id, async (db, owner, now) => {
    await db.runAsync(`UPDATE shopping_list SET name = ?, quantity = ?, unit = ?, category = ?, updated_at = ?, local_revision = local_revision + 1 WHERE id = ? AND user_id = ? AND deleted_at IS NULL`, [...params, now, id, owner]);
  });
}

export async function toggleShoppingItemCompleted(id: string): Promise<void> {
  await mutateItem(id, async (db, owner, now) => {
    await db.runAsync('UPDATE shopping_list SET completed = CASE completed WHEN 0 THEN 1 ELSE 0 END, updated_at = ?, local_revision = local_revision + 1 WHERE id = ? AND user_id = ? AND deleted_at IS NULL', now, id, owner);
  });
}

export async function deleteShoppingItem(id: string): Promise<void> {
  await mutateItem(id, async (db, owner, now) => {
    await db.runAsync('UPDATE shopping_list SET deleted_at = ?, updated_at = ?, local_revision = local_revision + 1 WHERE id = ? AND user_id = ? AND deleted_at IS NULL', now, now, id, owner);
  }, false);
}

export async function clearCompletedShoppingItems(): Promise<number> {
  return withOwnedData(async (db, owner) => {
    const newest = await db.getFirstAsync<{ updated_at: string }>('SELECT MAX(updated_at) AS updated_at FROM shopping_list WHERE user_id = ?', owner);
    const now = localTimestamp(newest?.updated_at);
    const result = await db.runAsync('UPDATE shopping_list SET deleted_at = ?, updated_at = ?, local_revision = local_revision + 1 WHERE completed = 1 AND user_id = ? AND deleted_at IS NULL', now, now, owner);
    return result.changes;
  }, true);
}

async function mutateItem(id: string, apply: (db: SQLiteDatabase, owner: string, now: string) => Promise<void>, required = true) {
  await withOwnedData(async (db, owner) => {
    const row = await db.getFirstAsync<{ updated_at: string }>('SELECT updated_at FROM shopping_list WHERE id = ? AND user_id = ? AND deleted_at IS NULL', id, owner);
    if (!row) { if (required) throw new Error('This shopping item no longer exists.'); return; }
    await apply(db, owner, localTimestamp(row.updated_at));
  }, true);
}
