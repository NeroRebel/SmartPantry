import { Platform } from 'react-native';
import { assertAccountWritable } from '@/services/account-lock';
import { withOwnedData } from '@/db/owned-data';
import { getLocalUserId, localTimestamp, notifyLocalChange } from '@/db/local-state';
import { cloudToLocal } from './sync-mappers';
import { compareUpdatedAt } from './merge';
import { SyncAccountChanged, SyncInvalidData, type CloudSyncRow, type LocalSyncRow, type SyncEntity } from './sync-types';

export function assertLocalOwner(owner: string): void {
  assertAccountWritable(owner);
  if (!owner || getLocalUserId() !== owner) throw new SyncAccountChanged();
}

export const localSyncStore = {
  async read(entity: SyncEntity, owner: string): Promise<LocalSyncRow[]> {
    assertLocalOwner(owner);
    return withOwnedData((db, captured) => {
      assertLocalOwner(owner); if (captured !== owner) throw new SyncAccountChanged();
      return db.getAllAsync<LocalSyncRow>(`SELECT * FROM ${entity} WHERE user_id = ?`, owner);
    });
  },
  async apply(entity: SyncEntity, owner: string, remote: CloudSyncRow): Promise<boolean> {
    assertLocalOwner(owner);
    if (remote.user_id !== owner) throw new SyncAccountChanged();
    const changed = await withOwnedData(async (db, captured) => {
      assertLocalOwner(owner); if (captured !== owner) throw new SyncAccountChanged();
      let applied = false;
      const perform = async (connection: Pick<typeof db, 'getFirstAsync' | 'runAsync'>) => {
        const current = await connection.getFirstAsync<LocalSyncRow>(`SELECT * FROM ${entity} WHERE user_id = ? AND id = ?`, owner, remote.id);
        if (current && compareUpdatedAt(current.updated_at, remote.updated_at) >= 0) return;
        const values = cloudToLocal(entity, remote);
        const fields = Object.keys(values);
        const updates = fields.filter((field) => field !== 'id' && field !== 'user_id').map((field) => `${field} = excluded.${field}`);
        if (entity === 'products' && (!current || current.name !== values.name || current.expiration_date !== values.expiration_date || current.deleted_at !== values.deleted_at)) updates.push('reminder_dirty = 1');
        await connection.runAsync(`INSERT INTO ${entity} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})
          ON CONFLICT(user_id, id) DO UPDATE SET ${updates.join(', ')}, local_revision = local_revision + 1`, fields.map((field) => values[field]));
        applied = true;
      };
      if (Platform.OS === 'web') await db.withTransactionAsync(() => perform(db));
      else await db.withExclusiveTransactionAsync(perform);
      return applied;
    });
    return changed;
  },
  notifyApplied() { notifyLocalChange('remote'); },
  async acknowledge(entity: SyncEntity, sent: LocalSyncRow, remote: CloudSyncRow): Promise<boolean> {
    if (sent.id !== remote.id || sent.user_id !== remote.user_id) throw new SyncInvalidData('Acknowledgement identity mismatch');
    assertLocalOwner(sent.user_id);
    return withOwnedData(async (db, captured) => {
      assertLocalOwner(sent.user_id); if (captured !== sent.user_id) throw new SyncAccountChanged();
      const current = await db.getFirstAsync<LocalSyncRow>(`SELECT * FROM ${entity} WHERE user_id = ? AND id = ?`, sent.user_id, sent.id);
      if (!current) return false;
      if (current.local_revision === sent.local_revision && current.updated_at === sent.updated_at) {
        await db.runAsync(`UPDATE ${entity} SET updated_at = ? WHERE user_id = ? AND id = ? AND local_revision = ? AND updated_at = ?`, remote.updated_at, sent.user_id, sent.id, sent.local_revision, sent.updated_at);
        return false;
      }
      // A local edit after the sent snapshot causally follows this acknowledgement.
      const latest = compareUpdatedAt(current.updated_at, remote.updated_at) > 0 ? current.updated_at : remote.updated_at;
      const now = localTimestamp(latest);
      await db.runAsync(`UPDATE ${entity} SET updated_at = ?, deleted_at = CASE WHEN deleted_at IS NULL THEN NULL ELSE ? END WHERE user_id = ? AND id = ?`, now, now, sent.user_id, sent.id);
      return true;
    });
  },
  async lastSuccessful(owner: string): Promise<string | null> {
    assertLocalOwner(owner);
    return withOwnedData(async (db) => (await db.getFirstAsync<{ value: string }>('SELECT value FROM local_metadata WHERE key = ?', `last_sync:${owner}`))?.value ?? null);
  },
  async recordSuccess(owner: string, timestamp: string): Promise<void> {
    assertLocalOwner(owner);
    await withOwnedData(async (db, captured) => {
      assertLocalOwner(owner); if (captured !== owner) throw new SyncAccountChanged();
      await db.runAsync('INSERT INTO local_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', `last_sync:${owner}`, timestamp);
    });
  },
};
