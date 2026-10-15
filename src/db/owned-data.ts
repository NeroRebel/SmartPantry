import type { SQLiteDatabase } from 'expo-sqlite';
import { initializeDatabase } from './database';
import { getLocalUserId, notifyLocalChange, serializeLocal } from './local-state';
import { assertAccountWritable } from '@/services/account-lock';

export function withOwnedData<T>(task: (db: SQLiteDatabase, userId: string) => Promise<T>, mutation = false): Promise<T> {
  // Capture before awaiting: an account switch must not retarget an in-flight operation.
  const userId = getLocalUserId();
  return serializeLocal(async () => {
    const db = await initializeDatabase();
    if (mutation) assertAccountWritable(userId);
    const result = await task(db, userId);
    if (mutation) notifyLocalChange();
    return result;
  });
}

export async function newLocalId(db: Pick<SQLiteDatabase, 'getFirstAsync'>): Promise<string> {
  const row = await db.getFirstAsync<{ id: string }>('SELECT lower(hex(randomblob(16))) AS id');
  if (!row) throw new Error('Could not generate a local record ID');
  return row.id;
}
