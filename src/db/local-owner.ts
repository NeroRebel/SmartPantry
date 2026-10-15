import { initializeDatabase } from './database';
import { getLocalUserId, notifyLocalChange, serializeLocal } from './local-state';
import { Platform } from 'react-native';
import { assertAccountWritable } from '@/services/account-lock';

export async function claimLegacyData(userId: string): Promise<void> {
  if (!userId) throw new Error('An authenticated account is required');
  await serializeLocal(async () => {
    const db = await initializeDatabase();
    assertAccountWritable(userId);
    const claim = async (connection: Pick<typeof db, 'getFirstAsync' | 'runAsync'>) => {
      const claimed = await connection.getFirstAsync<{ value: string }>('SELECT value FROM local_metadata WHERE key = ?', 'legacy_data_claimed_by_user_id');
      if (!claimed) {
        for (const table of ['products', 'shopping_list', 'product_history'] as const) {
          await connection.runAsync(`UPDATE ${table} SET user_id = ?, local_revision = local_revision + 1 WHERE user_id = ''`, userId);
        }
        await connection.runAsync('INSERT INTO local_metadata (key, value) VALUES (?, ?)', 'legacy_data_claimed_by_user_id', userId);
      }
    };
    if (Platform.OS === 'web') await db.withTransactionAsync(() => claim(db));
    else await db.withExclusiveTransactionAsync(claim);
  });
  if (getLocalUserId() === userId) notifyLocalChange();
}
