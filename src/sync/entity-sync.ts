import { localToCloud } from './sync-mappers';
import { planMerge } from './merge';
import type { localSyncStore } from './local-store';
import type { createCloudStore } from './cloud-store';
import { SyncAccountChanged, SyncConflict, type SyncCounts, type SyncEntity } from './sync-types';

export interface SyncDependencies {
  local: typeof localSyncStore;
  cloud: ReturnType<typeof createCloudStore>;
  assertOwner: (owner: string) => void;
}

export async function syncEntity(entity: SyncEntity, owner: string, signal: AbortSignal, dependencies: SyncDependencies): Promise<SyncCounts> {
  const { local, cloud, assertOwner } = dependencies;
  const check = () => { assertOwner(owner); if (signal.aborted) throw new SyncAccountChanged(); };
  check();
  const remote = await cloud.read(entity, owner, signal); check();
  const rows = await local.read(entity, owner); check();
  const plan = planMerge(rows, remote, owner);
  const counts = { pushed: 0, pulled: 0, tombstoned: 0, conflicts: 0 };
  // Validate all proposed writes before changing either database for this entity.
  const pushes = plan.push.map((row) => ({ local: row, cloud: localToCloud(entity, row) }));
  try {
    for (const row of plan.pull) {
      check();
      if (await local.apply(entity, owner, row)) { counts.pulled++; if (row.deleted_at) counts.tombstoned++; }
    }
  } finally { if (counts.pulled) local.notifyApplied(); }
  for (const row of pushes) {
    check();
    const written = await cloud.write(entity, row.cloud, plan.remoteById.get(row.local.id), signal); check();
    if (!written) { counts.conflicts++; continue; }
    if (await local.acknowledge(entity, row.local, written)) counts.conflicts++;
    counts.pushed++; if (row.cloud.deleted_at) counts.tombstoned++;
  }
  if (counts.conflicts) throw new SyncConflict();
  return counts;
}
