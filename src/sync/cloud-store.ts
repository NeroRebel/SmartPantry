import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudFields, validateCloudRow } from './sync-mappers';
import { SyncAccountChanged, type CloudSyncRow, type SyncEntity } from './sync-types';

export function createCloudStore(client: SupabaseClient) {
  const pageSize = 250;
  async function assertSession(owner: string, signal: AbortSignal) {
    if (signal.aborted) throw new SyncAccountChanged();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session || data.session.user.id !== owner || signal.aborted) throw new SyncAccountChanged();
  }
  return {
    async read(entity: SyncEntity, owner: string, signal: AbortSignal): Promise<CloudSyncRow[]> {
      const rows: CloudSyncRow[] = [];
      for (let offset = 0; ; offset += pageSize) {
        await assertSession(owner, signal);
        const { data, error } = await client.from(entity).select(cloudFields[entity].join(',')).eq('user_id', owner).order('id').range(offset, offset + pageSize - 1).abortSignal(signal);
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Invalid sync response');
        rows.push(...data.map((row) => validateCloudRow(entity, row, owner)));
        if (data.length < pageSize) return rows;
      }
    },
    async write(entity: SyncEntity, row: CloudSyncRow, previous: CloudSyncRow | undefined, signal: AbortSignal): Promise<CloudSyncRow | null> {
      await assertSession(row.user_id, signal);
      const columns = cloudFields[entity].join(',');
      // Conditional updates prevent overwriting a remote edit made since the read.
      const request = previous
        ? client.from(entity).update(row).eq('user_id', row.user_id).eq('id', row.id).eq('updated_at', previous.updated_at)
        : client.from(entity).upsert(row, { onConflict: 'user_id,id', ignoreDuplicates: true });
      const { data, error } = await request.select(columns).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Invalid sync response');
      return data.length ? validateCloudRow(entity, data[0], row.user_id) : null;
    },
  };
}
