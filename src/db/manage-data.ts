import { Platform } from 'react-native';
import { initializeDatabase } from './database';

export async function clearShoppingList(): Promise<void> {
  const db = await initializeDatabase();
  await db.runAsync('DELETE FROM shopping_list');
}

export async function clearProductHistory(): Promise<void> {
  const db = await initializeDatabase();
  await db.runAsync('DELETE FROM product_history');
}

export async function clearAllAppData(): Promise<string[]> {
  const db = await initializeDatabase();
  const clear = async (connection: Pick<typeof db, 'getAllAsync' | 'runAsync'>) => {
    const rows = await connection.getAllAsync<{ notificationId: string | null }>('SELECT notification_id AS notificationId FROM products WHERE notification_id IS NOT NULL');
    await connection.runAsync('DELETE FROM products');
    await connection.runAsync('DELETE FROM shopping_list');
    await connection.runAsync('DELETE FROM product_history');
    return rows.flatMap((row) => row.notificationId ? [row.notificationId] : []);
  };
  let ids: string[] = [];
  if (Platform.OS === 'web') await db.withTransactionAsync(async () => { ids = await clear(db); });
  else await db.withExclusiveTransactionAsync(async (connection) => { ids = await clear(connection); });
  return ids;
}
