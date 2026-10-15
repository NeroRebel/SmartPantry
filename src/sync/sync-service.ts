import { syncEntity, type SyncDependencies } from './entity-sync';
import { SyncAccountChanged, SyncConflict, SyncInvalidData } from './sync-types';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
export interface SyncState {
  userId: string | null;
  status: SyncStatus;
  lastSuccessfulSyncAt: string | null;
  errorKey: string | null;
}

export function createSyncService(dependencies: SyncDependencies & { reconcileReminders: () => Promise<void> }) {
  let owner: string | null = null;
  const paused = new Set<string>();
  let generation = 0;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  type SyncJob = { owner: string; generation: number; promise: Promise<void> };
  let running: SyncJob | null = null;
  const jobs = new Set<SyncJob>();
  let pending = false;
  let retries = 0;
  let state: SyncState = { userId: null, status: 'idle', lastSuccessfulSyncAt: null, errorKey: null };
  const listeners = new Set<() => void>();
  function publish(patch: Partial<SyncState>) { state = { ...state, ...patch }; for (const listener of listeners) listener(); }
  function schedule(delay = 1500, resetRetries = true) {
    if (!owner || paused.has(owner)) return;
    if (resetRetries) retries = 0;
    if (running?.generation === generation) { pending = true; return; }
    clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; void syncNow(); }, delay);
  }
  function syncNow(): Promise<void> {
    if (!owner || paused.has(owner)) return Promise.resolve();
    if (running?.generation === generation) return running.promise;
    clearTimeout(timer); timer = undefined;
    const currentOwner = owner; const currentGeneration = generation;
    const previous = running?.promise;
    const job = { owner: currentOwner, generation: currentGeneration, promise: Promise.resolve() };
    const stillCurrent = () => owner === currentOwner && generation === currentGeneration;
    job.promise = Promise.resolve().then(async () => {
      if (previous) await previous;
      if (!stillCurrent()) return;
      const abort = new AbortController(); controller = abort;
      const timeout = setTimeout(() => abort.abort(), 60000);
      const start = Date.now();
      pending = false;
      publish({ status: 'syncing', errorKey: null });
      try {
        dependencies.assertOwner(currentOwner);
        for (const entity of ['products', 'shopping_list', 'product_history'] as const) {
          try { await syncEntity(entity, currentOwner, abort.signal, dependencies); }
          finally {
            if (entity === 'products' && stillCurrent()) await dependencies.reconcileReminders().catch(() => {});
          }
          if (!stillCurrent()) throw new SyncAccountChanged();
        }
        if (abort.signal.aborted || !stillCurrent()) throw new SyncAccountChanged();
        const now = new Date().toISOString();
        await dependencies.local.recordSuccess(currentOwner, now);
        if (!stillCurrent()) return;
        retries = 0;
        publish({ status: 'synced', lastSuccessfulSyncAt: now, errorKey: null });
        if (typeof __DEV__ !== 'undefined' && __DEV__) console.info('[SmartPantry] Sync completed', { duration_ms: Date.now() - start });
      } catch (error) {
        if (!stillCurrent()) return;
        const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
        const offline = abort.signal.aborted || error instanceof TypeError || /network|failed to fetch|fetch failed|timeout/i.test(message);
        publish({ status: offline ? 'offline' : 'error', errorKey: error instanceof SyncInvalidData ? 'sync.invalidData' : error instanceof SyncConflict ? 'sync.conflict' : offline ? 'sync.offlineHelp' : 'sync.errorHelp' });
        if (retries < 2) {
          const delay = error instanceof SyncConflict ? 1000 : retries === 0 ? 10000 : 30000;
          retries++;
          timer = setTimeout(() => { timer = undefined; void syncNow(); }, delay);
        }
      } finally {
        clearTimeout(timeout);
        if (controller === abort) controller = null;
        if (running === job) running = null;
        if (stillCurrent() && pending) { pending = false; schedule(1000, false); }
      }
    }).finally(() => { jobs.delete(job); });
    jobs.add(job);
    running = job;
    return job.promise;
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate(userId: string | null) {
      if (userId && paused.has(userId)) return;
      if (owner === userId) return;
      owner = userId; generation++; pending = false; retries = 0;
      controller?.abort(); clearTimeout(timer); timer = undefined;
      publish({ userId, status: 'idle', lastSuccessfulSyncAt: null, errorKey: null });
      if (!userId) return;
      const expected = generation;
      void dependencies.local.lastSuccessful(userId).then((timestamp) => {
        if (generation === expected && !state.lastSuccessfulSyncAt) publish({ lastSuccessfulSyncAt: timestamp });
      }).catch(() => {});
      schedule(0);
    },
    async pauseAndDrain(userId: string) {
      paused.add(userId);
      if (owner === userId) {
        owner = null; generation++; pending = false;
        controller?.abort(); clearTimeout(timer); timer = undefined;
        publish({ userId: null, status: 'idle', lastSuccessfulSyncAt: null, errorKey: null });
      }
      await Promise.all([...jobs].filter((job) => job.owner === userId).map((job) => job.promise));
    },
    resume(userId: string) { paused.delete(userId); },
    syncNow, schedule,
    dispose() { owner = null; generation++; controller?.abort(); clearTimeout(timer); listeners.clear(); },
  };
}
