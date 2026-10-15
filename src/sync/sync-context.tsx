import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { useLocalAccount } from '@/hooks/use-local-account';
import { subscribeLocalChanges } from '@/db/local-state';
import { supabase } from '@/lib/supabase';
import { reconcileAccountReminders, restoreProductReminders } from '@/services/notifications';
import { createCloudStore } from './cloud-store';
import { assertLocalOwner, localSyncStore } from './local-store';
import { createSyncService, type SyncState } from './sync-service';

const empty: SyncState = { userId: null, status: 'idle', lastSuccessfulSyncAt: null, errorKey: null };
const noSubscribe = () => () => {};
function useSyncState() {
  const { session, loading, recovering, passwordRecoveryComplete, processingCallback, clearDeletedSession } = useAuth();
  const owner = session?.user.id ?? null;
  const local = useLocalAccount(loading ? null : owner, clearDeletedSession);
  const service = useMemo(() => supabase ? createSyncService({
    local: localSyncStore, cloud: createCloudStore(supabase), assertOwner: assertLocalOwner,
    reconcileReminders: async () => { await reconcileAccountReminders(); await restoreProductReminders(); },
  }) : null, []);
  const state = useSyncExternalStore(service?.subscribe ?? noSubscribe, service?.getSnapshot ?? (() => empty), () => empty);
  const active = !!owner && !loading && local.ready && !recovering && !passwordRecoveryComplete && !processingCallback;
  useEffect(() => { service?.activate(active ? owner : null); return () => service?.activate(null); }, [service, owner, active]);
  useEffect(() => {
    if (!service) return;
    const unsubscribe = subscribeLocalChanges((reason) => { if (reason === 'local') service.schedule(); });
    const subscription = AppState.addEventListener('change', (next) => { if (next === 'active') service.schedule(0); });
    return () => { unsubscribe(); subscription.remove(); };
  }, [service]);
  const visible = state.userId === owner ? state : empty;
  const canSync = !!service && active && state.userId === owner;
  return { ...visible, configured: !!supabase, canSync, localReady: local.ready, localError: local.error, retryLocal: local.retry,
    pauseForDeletion: async (userId: string) => { await service?.pauseAndDrain(userId); },
    resumeAfterDeletionFailure: (userId: string) => { service?.resume(userId); if (active && owner === userId && service?.getSnapshot().userId === null) service.activate(userId); },
    syncNow: () => canSync ? service!.syncNow() : Promise.resolve() };
}

const SyncContext = createContext<ReturnType<typeof useSyncState> | null>(null);
export function SyncProvider({ children }: { children: ReactNode }) {
  const value = useSyncState();
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error('SyncProvider is missing');
  return context;
}
