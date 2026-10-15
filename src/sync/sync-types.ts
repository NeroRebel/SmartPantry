export type SyncEntity = 'products' | 'shopping_list' | 'product_history';
export interface SyncMetadata {
  id: string;
  user_id: string;
  updated_at: string;
  deleted_at: string | null;
}
export type LocalSyncRow = SyncMetadata & { local_revision: number; created_at: string | null; [key: string]: string | number | null };
export type CloudSyncRow = SyncMetadata & { created_at: string; [key: string]: string | number | boolean | null };
export interface SyncCounts { pushed: number; pulled: number; tombstoned: number; conflicts: number }
export class SyncAccountChanged extends Error {}
export class SyncConflict extends Error {}
export class SyncInvalidData extends Error {}
