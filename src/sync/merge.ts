import { SyncInvalidData, type SyncMetadata } from './sync-types';

function timestampMicros(value: string): bigint {
  const match = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  const milliseconds = Date.parse(value);
  if (!match || !Number.isFinite(milliseconds)) throw new SyncInvalidData('Invalid sync timestamp');
  // PostgreSQL retains microseconds; Date.parse alone would equate distinct versions.
  return BigInt(milliseconds) * 1000n + BigInt((match[1] ?? '').padEnd(6, '0').slice(3, 6));
}

export function compareUpdatedAt(a: string, b: string): number {
  const left = timestampMicros(a); const right = timestampMicros(b);
  return left > right ? 1 : left < right ? -1 : 0;
}

export function planMerge<L extends SyncMetadata, R extends SyncMetadata>(local: readonly L[], remote: readonly R[], userId: string) {
  function index<T extends SyncMetadata>(rows: readonly T[]) {
    const result = new Map<string, T>();
    for (const row of rows) {
      if (!userId || row.user_id !== userId || !row.id || result.has(row.id)) throw new SyncInvalidData('Invalid sync ownership or identity');
      timestampMicros(row.updated_at);
      if (row.deleted_at) timestampMicros(row.deleted_at);
      result.set(row.id, row);
    }
    return result;
  }
  const localById = index(local); const remoteById = index(remote);
  const push: L[] = []; const pull: R[] = [];
  for (const [id, row] of localById) {
    const other = remoteById.get(id);
    if (!other || compareUpdatedAt(row.updated_at, other.updated_at) > 0) push.push(row);
  }
  for (const [id, row] of remoteById) {
    const other = localById.get(id);
    if (!other || compareUpdatedAt(row.updated_at, other.updated_at) > 0) pull.push(row);
  }
  return { push, pull, remoteById };
}
