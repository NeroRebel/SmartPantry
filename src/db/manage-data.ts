import { Platform } from 'react-native';
import { withOwnedData } from './owned-data';
import { localTimestamp } from './local-state';

export async function clearShoppingList(): Promise<void> {
  await clearTable('shopping_list');
}

export async function clearProductHistory(): Promise<void> {
  await clearTable('product_history');
}

async function clearTable(table: 'shopping_list' | 'product_history') {
  await withOwnedData(async (db, owner) => {
    const row = await db.getFirstAsync<{ updated_at: string }>(`SELECT MAX(updated_at) AS updated_at FROM ${table} WHERE user_id = ?`, owner);
    const now = localTimestamp(row?.updated_at);
    await db.runAsync(`UPDATE ${table} SET deleted_at = ?, updated_at = ?, local_revision = local_revision + 1 WHERE user_id = ? AND deleted_at IS NULL`, now, now, owner);
  }, true);
}

export async function clearAllAppData(): Promise<string[]> {
  return withOwnedData(async (db, owner) => {
    const clear = async (connection: Pick<typeof db, 'getAllAsync' | 'runAsync'>) => {
      const rows = await connection.getAllAsync<{ notificationId: string | null }>('SELECT notification_id AS notificationId FROM products WHERE notification_id IS NOT NULL AND user_id = ?', owner);
      for (const table of ['products', 'shopping_list', 'product_history'] as const) {
        const latest = await connection.getAllAsync<{ updated_at: string }>(`SELECT MAX(updated_at) AS updated_at FROM ${table} WHERE user_id = ?`, owner);
        const now = localTimestamp(latest[0]?.updated_at);
        await connection.runAsync(`UPDATE ${table} SET deleted_at = ?, updated_at = ?, local_revision = local_revision + 1 WHERE user_id = ? AND deleted_at IS NULL`, now, now, owner);
      }
      return rows.flatMap((row) => row.notificationId ? [row.notificationId] : []);
    };
    let ids: string[] = [];
    if (Platform.OS === 'web') await db.withTransactionAsync(async () => { ids = await clear(db); });
    else await db.withExclusiveTransactionAsync(async (connection) => { ids = await clear(connection); });
    return ids;
  }, true);
}
