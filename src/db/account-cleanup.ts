import { Platform } from 'react-native';
import { initializeDatabase } from './database';
import { notifyLocalChange, serializeLocal } from './local-state';

const receiptPrefix = 'deleted_account_cleanup:';
// Only called after the server explicitly confirms deletion. Survives an interrupted cleanup.
export async function recordDeletedAccount(userId: string): Promise<void> {
  if (!userId) throw new Error('Missing account');
  await serializeLocal(async () => {
    const db = await initializeDatabase();
    await db.runAsync('INSERT OR REPLACE INTO local_metadata (key,value) VALUES (?,?)', receiptPrefix + userId, userId);
  });
}
export async function getDeletedAccountsToClean(): Promise<string[]> {
  return serializeLocal(async () => {
    const db = await initializeDatabase();
    const rows = await db.getAllAsync<{ value: string }>('SELECT value FROM local_metadata WHERE key LIKE ?', receiptPrefix + '%');
    return rows.map((row) => row.value);
  });
}
export async function purgeDeletedAccount(userId: string): Promise<void> {
  if (!userId) throw new Error('Missing account');
  await serializeLocal(async () => {
    const db = await initializeDatabase();
    const perform = async (tx: Pick<typeof db, 'getFirstAsync' | 'runAsync'>) => {
      const receipt = await tx.getFirstAsync('SELECT value FROM local_metadata WHERE key = ? AND value = ?', receiptPrefix + userId, userId);
      if (!receipt) throw new Error('Server deletion confirmation required');
      for (const table of ['products', 'shopping_list', 'product_history'] as const) {
        await tx.runAsync(`DELETE FROM ${table} WHERE user_id = ?`, userId);
      }
      await tx.runAsync('DELETE FROM local_metadata WHERE key = ?', `last_sync:${userId}`);
      // Keep the one-time import closed without retaining the deleted account's identifier.
      await tx.runAsync("UPDATE local_metadata SET value = 'retired' WHERE key = 'legacy_data_claimed_by_user_id' AND value = ?", userId);
    };
    if (Platform.OS === 'web') await db.withTransactionAsync(() => perform(db));
    else await db.withExclusiveTransactionAsync(perform);
  });
  notifyLocalChange('account');
}
export async function forgetDeletedAccountReceipt(userId: string): Promise<void> {
  await serializeLocal(async () => {
    const db = await initializeDatabase();
    await db.runAsync('DELETE FROM local_metadata WHERE key = ? AND value = ?', receiptPrefix + userId, userId);
  });
}
